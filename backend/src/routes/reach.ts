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
      from: "TRI-LIGHT <support@updates.trilightapp.com>",
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

  // Get all persons for this user ordered by slot
  const persons = await prisma.person.findMany({
    where: { userId: user.id },
    orderBy: { slot: "asc" },
  });

  if (persons.length === 0) {
    return c.json({ error: { message: "No person saved", code: "NO_PERSON" } }, 404);
  }

  // Get all invitations
  const invitations = await prisma.consentInvitation.findMany({
    where: { userId: user.id },
  });

  // Find confirmed contacts
  const confirmedContacts = persons.filter((p) => {
    const inv = invitations.find((i) => i.slot === p.slot);
    return inv?.consentedAt != null;
  });

  if (confirmedContacts.length === 0) {
    // Resend invites to all pending contacts
    for (const person of persons) {
      const inv = invitations.find((i) => i.slot === person.slot);
      if (inv && !inv.consentedAt && !inv.declinedAt && env.RESEND_API_KEY) {
        try {
          await sendInviteEmail(inv.personPhone, inv.senderName, inv.token);
        } catch (err) {
          console.error("Error resending invite:", err);
        }
      }
    }
    return c.json(
      {
        error: {
          message: "Waiting for your accountability person to accept the invitation. We've resent the invite.",
          code: "CONSENT_PENDING",
        },
      },
      403
    );
  }

  // Use first confirmed contact as primary (for CallSession record)
  const primaryContact = confirmedContacts[0]!;

  let videoRoomUrl: string | null = null;
  let roomName: string = `reach-${Date.now()}`;

  // Create ONE Daily.co room
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
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
      });

      if (dailyRes.ok) {
        const dailyData = await dailyRes.json() as { url?: string; name?: string };
        videoRoomUrl = dailyData.url || null;
        if (dailyData.name) roomName = dailyData.name;
      }
    } catch (err) {
      console.error("Daily.co error:", err);
    }
  }

  // Save CallSession
  const callSession = await prisma.callSession.create({
    data: {
      callerId: user.id,
      callerName: user.name,
      recipientPhone: primaryContact.phone,
      roomUrl: videoRoomUrl || "",
      roomName,
      status: "pending",
    },
  });

  // Send email to ALL confirmed contacts
  let smsSent = false;
  if (env.RESEND_API_KEY) {
    for (const contact of confirmedContacts) {
      console.log("Resend check - API key present:", !!env.RESEND_API_KEY, "Phone/email:", !!contact.phone);
      try {
        const emailHtml = videoRoomUrl
          ? `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;min-height:100vh;padding:40px 20px;text-align:center;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border-radius:20px;padding:40px 32px;">
    <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:#888;margin-bottom:24px;">TRI-LIGHT APP</div>
    <div style="font-size:48px;margin-bottom:16px;">🚨</div>
    <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0 0 12px;">${user.name} needs you right now</h1>
    <p style="color:#aaa;font-size:16px;line-height:1.6;margin:0 0 36px;">They're reaching out for support. Please join the call immediately.</p>
    <a href="${videoRoomUrl}" style="display:block;background:#e00;color:#fff;font-size:20px;font-weight:800;padding:20px 24px;border-radius:14px;text-decoration:none;letter-spacing:0.5px;margin-bottom:20px;">JOIN VIDEO CALL NOW</a>
    <p style="color:#555;font-size:12px;word-break:break-all;">${videoRoomUrl}</p>
  </div>
</div>`
          : `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;min-height:100vh;padding:40px 20px;text-align:center;"><div style="max-width:480px;margin:0 auto;background:#1a1a1a;border-radius:20px;padding:40px 32px;"><div style="font-size:13px;font-weight:700;letter-spacing:3px;color:#888;margin-bottom:24px;">TRI-LIGHT APP</div><h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 12px;">${user.name} is reaching out</h1><p style="color:#aaa;font-size:16px;line-height:1.6;margin:0;">They want to connect with you. Please reach back as soon as you can.</p></div></div>`;

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
            from: "TRI-LIGHT <support@updates.trilightapp.com>",
            to: [contact.phone],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (reachRes.ok) {
          smsSent = true;
          console.log("Resend email sent successfully to:", contact.phone);
        } else {
          const errData = await reachRes.text();
          console.error("Resend email FAILED:", reachRes.status, errData);
        }
      } catch (err) {
        console.error("Resend email error:", err);
      }
    }
  }

  return c.json({
    data: { videoRoomUrl, sessionId: callSession.id, smsSent },
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
