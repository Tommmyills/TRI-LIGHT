import { Hono } from "hono";
import { env } from "../env";
import { prisma } from "../prisma";
import type { auth } from "../auth";

const reachRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

async function sendInviteEmail(
  toEmail: string,
  senderName: string,
  token: string
): Promise<void> {
  if (!env.RESEND_API_KEY) return;

  const inviteUrl = `${env.BACKEND_URL}/consent/${token}`;
  const html = `
    <p>${senderName} added you as their accountability contact on <strong>TRI-LIGHT</strong>.</p>
    <p><a href="${inviteUrl}">Tap here to accept and receive their check-in notifications</a></p>
    <p style="color:#999;font-size:12px;">If you did not expect this, you can ignore this email.</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TRI-LIGHT <support@trilightapp.com>",
      to: [toEmail],
      subject: `${senderName} added you as their accountability contact`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Failed to send invite email:", res.status, errText);
  } else {
    console.log("Invite email sent to:", toEmail);
  }
}

// POST /api/reach - Called when user presses the REACH button
reachRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  // Get the saved person for this user
  const person = await prisma.person.findUnique({
    where: { userId: user.id },
  });

  if (!person) {
    return c.json({ error: { message: "No person saved", code: "NO_PERSON" } }, 404);
  }

  // Check consent before sending any SMS
  const invitation = await prisma.consentInvitation.findUnique({
    where: { userId: user.id },
  });

  if (!invitation?.consentedAt) {
    // Resend invite email so the accountability person gets another chance to accept
    if (invitation && env.RESEND_API_KEY) {
      try {
        await sendInviteEmail(invitation.personPhone, invitation.senderName, invitation.token);
      } catch (err) {
        console.error("Error resending invite email:", err);
      }
    }
    return c.json(
      {
        error: {
          message:
            "Waiting for your accountability person to accept the invitation. We've resent the invite.",
          code: "CONSENT_PENDING",
        },
      },
      403
    );
  }

  let videoRoomUrl: string | null = null;
  let roomName: string = `reach-${Date.now()}`;

  // Create Daily.co room
  if (env.DAILY_API_KEY) {
    try {
      const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            enable_knocking: false,
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
          },
        }),
      });

      if (dailyRes.ok) {
        const dailyData = await dailyRes.json() as { url?: string; name?: string };
        videoRoomUrl = dailyData.url || null;
        if (dailyData.name) {
          roomName = dailyData.name;
        }
      }
    } catch (err) {
      console.error("Daily.co error:", err);
    }
  }

  // Save CallSession to DB
  const callSession = await prisma.callSession.create({
    data: {
      callerId: user.id,
      callerName: user.name,
      recipientPhone: person.phone,
      roomUrl: videoRoomUrl || "",
      roomName: roomName,
      status: "pending",
    },
  });

  // Send Resend email with Daily.co browser link (no app required for recipient)
  let smsSent = false;
  console.log("Resend check - API key present:", !!env.RESEND_API_KEY, "Phone/email:", !!person.phone);
  if (env.RESEND_API_KEY && person.phone) {
    try {
      const emailHtml = videoRoomUrl
        ? `<p><strong>${user.name}</strong> is reaching out to you.</p><p><a href="${videoRoomUrl}" style="background:#007AFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Join Video Call</a></p><p style="color:#999;font-size:12px;">${videoRoomUrl}</p>`
        : `<p><strong>${user.name}</strong> is reaching out and wants to connect with you.</p>`;

      const emailSubject = videoRoomUrl
        ? `${user.name} is reaching out — join the video call`
        : `${user.name} is reaching out to you`;

      const reachRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TRI-LIGHT <support@trilightapp.com>",
          to: [person.phone],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      if (reachRes.ok) {
        smsSent = true;
        console.log("Resend email sent successfully to:", person.phone);
      } else {
        const errData = await reachRes.text();
        console.error("Resend email FAILED:", reachRes.status, errData);
      }
    } catch (err) {
      console.error("Resend email error:", err);
    }
  }

  return c.json({
    data: {
      videoRoomUrl,
      sessionId: callSession.id,
      smsSent,
    },
  });
});

// GET /api/reach/session/:sessionId - Get call session (public, no auth required)
reachRouter.get("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  const callSession = await prisma.callSession.findUnique({
    where: { id: sessionId },
  });

  if (!callSession) {
    return c.json({ error: { message: "Session not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({ data: callSession });
});

// PATCH /api/reach/session/:sessionId - Update session status (public, no auth required)
reachRouter.patch("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  const body = await c.req.json() as { status?: string };
  const { status } = body;

  if (!status || !["accepted", "declined", "ended"].includes(status)) {
    return c.json({ error: { message: "Invalid status. Must be accepted, declined, or ended", code: "INVALID_STATUS" } }, 400);
  }

  const existing = await prisma.callSession.findUnique({
    where: { id: sessionId },
  });

  if (!existing) {
    return c.json({ error: { message: "Session not found", code: "NOT_FOUND" } }, 404);
  }

  const updated = await prisma.callSession.update({
    where: { id: sessionId },
    data: { status },
  });

  return c.json({ data: updated });
});

// DELETE /api/reach/session/:sessionId - End/delete session (caller use, no auth required)
reachRouter.delete("/session/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  const existing = await prisma.callSession.findUnique({
    where: { id: sessionId },
  });

  if (!existing) {
    return c.json({ error: { message: "Session not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.callSession.delete({
    where: { id: sessionId },
  });

  return c.json({ data: { deleted: true } });
});

export { reachRouter };
