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

// POST /api/person - Save or update a contact for a given slot (1, 2, or 3)
personRouter.post("/", async (c) => {
  const body = await c.req.json();
  const { name, phone, deviceId, slot: rawSlot } = body;
  const user = c.get("user");

  if (!name || !phone || !deviceId) {
    return c.json(
      { error: { message: "Name, phone, and deviceId are required", code: "VALIDATION_ERROR" } },
      400
    );
  }

  const slot: number = Number(rawSlot) || 1;
  if (slot < 1 || slot > 3) {
    return c.json(
      { error: { message: "Slot must be 1, 2, or 3", code: "VALIDATION_ERROR" } },
      400
    );
  }

  const userId = user?.id ?? null;

  let person;
  if (userId) {
    const existingBySlot = await prisma.person.findFirst({
      where: { userId, slot },
    });

    if (existingBySlot) {
      person = await prisma.person.update({
        where: { id: existingBySlot.id },
        data: { name, phone },
      });
    } else {
      person = await prisma.person.upsert({
        where: { deviceId },
        update: { name, phone, userId, slot },
        create: { name, phone, deviceId, userId, slot },
      });
    }
  } else {
    person = await prisma.person.upsert({
      where: { deviceId },
      update: { name, phone },
      create: { name, phone, deviceId, slot },
    });
  }

  // If logged in, manage ConsentInvitation for this slot
  if (userId && user) {
    const senderName = user.name;

    const existingInv = await prisma.consentInvitation.findFirst({
      where: { userId, slot },
    });

    const phoneChanged = existingInv?.personPhone !== phone;

    if (!existingInv) {
      const invitation = await prisma.consentInvitation.create({
        data: { personPhone: phone, personName: name, senderName, userId, slot },
      });
      try {
        await sendInviteEmail(phone, senderName, invitation.token);
      } catch (err) {
        console.error("Error sending invite email:", err);
      }
    } else if (phoneChanged) {
      const updated = await prisma.consentInvitation.update({
        where: { id: existingInv.id },
        data: { personPhone: phone, personName: name, senderName, consentedAt: null, declinedAt: null },
      });
      try {
        await sendInviteEmail(phone, senderName, updated.token);
      } catch (err) {
        console.error("Error sending invite email:", err);
      }
    } else {
      await prisma.consentInvitation.update({
        where: { id: existingInv.id },
        data: { personName: name, senderName },
      });
    }
  }

  // Return person with consentStatus
  let consentStatus: "confirmed" | "declined" | "pending" | "none" = "none";
  if (userId) {
    const inv = await prisma.consentInvitation.findFirst({
      where: { userId, slot },
    });
    consentStatus = inv?.consentedAt
      ? "confirmed"
      : inv?.declinedAt
        ? "declined"
        : inv
          ? "pending"
          : "none";
  }

  return c.json({ data: { ...person, consentStatus } });
});

// GET /api/person/for-user - Get all contacts for logged-in user (array)
personRouter.get("/for-user", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ data: [] });
  }

  const persons = await prisma.person.findMany({
    where: { userId: user.id },
    orderBy: { slot: "asc" },
  });

  const invitations = await prisma.consentInvitation.findMany({
    where: { userId: user.id },
  });

  const result = persons.map((person) => {
    const inv = invitations.find((i) => i.slot === person.slot);
    const consentStatus: "confirmed" | "declined" | "pending" | "none" =
      inv?.consentedAt ? "confirmed" : inv?.declinedAt ? "declined" : inv ? "pending" : "none";
    return { ...person, consentStatus };
  });

  return c.json({ data: result });
});

// DELETE /api/person/slot/:slot - Remove a contact by slot
personRouter.delete("/slot/:slot", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const slot = Number(c.req.param("slot"));
  if (!slot || slot < 1 || slot > 3) {
    return c.json({ error: { message: "Invalid slot", code: "VALIDATION_ERROR" } }, 400);
  }

  await prisma.consentInvitation.deleteMany({ where: { userId: user.id, slot } });
  await prisma.person.deleteMany({ where: { userId: user.id, slot } });

  return c.json({ data: { deleted: true } });
});

// POST /api/person/resend/:slot - Resend invite for a specific slot
personRouter.post("/resend/:slot", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const slot = Number(c.req.param("slot"));
  if (!slot || slot < 1 || slot > 3) {
    return c.json({ error: { message: "Invalid slot", code: "VALIDATION_ERROR" } }, 400);
  }

  const invitation = await prisma.consentInvitation.findFirst({
    where: { userId: user.id, slot },
  });

  if (!invitation) {
    return c.json({ error: { message: "No invitation found for this slot", code: "NOT_FOUND" } }, 404);
  }

  try {
    await sendInviteEmail(invitation.personPhone, invitation.senderName, invitation.token);
  } catch (err) {
    console.error("Error resending invite:", err);
    return c.json({ error: { message: "Failed to resend invite", code: "SEND_ERROR" } }, 500);
  }

  return c.json({ data: { sent: true } });
});

// GET /api/person/:deviceId - backward compat
personRouter.get("/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId");
  const person = await prisma.person.findUnique({ where: { deviceId } });
  return c.json({ data: person ?? null });
});

export { personRouter };
