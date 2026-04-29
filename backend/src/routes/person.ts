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

async function sendInviteSms(
  toPhone: string,
  senderName: string,
  token: string
): Promise<void> {
  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.TWILIO_MESSAGING_SERVICE_SID
  ) {
    return;
  }

  const inviteUrl = `${env.BACKEND_URL}/consent/${token}`;
  const body = `${senderName} added you as their accountability contact on TRI-LIGHT APP.\n\nTap to accept and receive their check-in messages:\n${inviteUrl}\n\nReply STOP to opt out.`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const formData = new URLSearchParams();
  formData.append("To", toPhone);
  formData.append("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  formData.append("Body", body);

  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Failed to send invite SMS:", res.status, errText);
  } else {
    console.log("Invite SMS sent to:", toPhone);
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
        await sendInviteSms(phone, senderName, invitation.token);
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
        await sendInviteSms(phone, senderName, updated.token);
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
