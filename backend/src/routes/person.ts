import { Hono } from "hono";
import { prisma } from "../prisma";
import { env } from "../env";
import type { auth } from "../auth";

const personRouter = new Hono<{
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

// Save or update a person (supports both deviceId and userId)
personRouter.post("/", async (c) => {
  const body = await c.req.json();
  const { name, phone, deviceId } = body;
  const user = c.get("user");

  if (!name || !phone || !deviceId) {
    return c.json(
      {
        error: {
          message: "Name, phone, and deviceId are required",
          code: "VALIDATION_ERROR",
        },
      },
      400
    );
  }

  const userId = user?.id ?? null;

  const person = await prisma.person.upsert({
    where: { deviceId },
    update: { name, phone, ...(userId ? { userId } : {}) },
    create: { name, phone, deviceId, ...(userId ? { userId } : {}) },
  });

  // If user is logged in, upsert a ConsentInvitation and send invite SMS
  if (userId && user) {
    const senderName = user.name;

    // Check if there's an existing invitation with the same phone (no need to resend)
    const existing = await prisma.consentInvitation.findUnique({
      where: { userId },
    });

    const phoneChanged = existing?.personPhone !== phone;

    if (!existing) {
      // Create new invitation
      const invitation = await prisma.consentInvitation.create({
        data: {
          personPhone: phone,
          personName: name,
          senderName,
          userId,
        },
      });

      // Send invite SMS
      try {
        await sendInviteEmail(phone, senderName, invitation.token);
      } catch (err) {
        console.error("Error sending invite SMS:", err);
      }
    } else if (phoneChanged) {
      // Phone changed - reset consent and send new invite
      const updated = await prisma.consentInvitation.update({
        where: { userId },
        data: {
          personPhone: phone,
          personName: name,
          senderName,
          consentedAt: null,
          declinedAt: null,
        },
      });

      try {
        await sendInviteEmail(phone, senderName, updated.token);
      } catch (err) {
        console.error("Error sending invite SMS:", err);
      }
    } else {
      // Same phone, just update the name/senderName fields silently
      await prisma.consentInvitation.update({
        where: { userId },
        data: {
          personName: name,
          senderName,
        },
      });
    }
  }

  return c.json({ data: person });
});

// Get person for logged-in user
personRouter.get("/for-user", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ data: null });
  }

  const person = await prisma.person.findUnique({
    where: { userId: user.id },
  });

  if (!person) {
    return c.json({ data: null });
  }

  const invitation = await prisma.consentInvitation.findUnique({
    where: { userId: user.id },
  });

  const consentStatus: "confirmed" | "declined" | "pending" | "none" =
    invitation?.consentedAt
      ? "confirmed"
      : invitation?.declinedAt
        ? "declined"
        : invitation
          ? "pending"
          : "none";

  return c.json({ data: { ...person, consentStatus } });
});

// Get person by deviceId (keep for backward compat)
personRouter.get("/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId");
  const person = await prisma.person.findUnique({
    where: { deviceId },
  });

  return c.json({ data: person ?? null });
});

export { personRouter };
