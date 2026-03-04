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

  // Send Twilio SMS with Daily.co browser link (no app required for recipient)
  let smsSent = false;
  console.log("Twilio check - SID:", !!env.TWILIO_ACCOUNT_SID, "Token:", !!env.TWILIO_AUTH_TOKEN, "MsgSid:", !!env.TWILIO_MESSAGING_SERVICE_SID, "Phone:", !!person.phone);
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID && person.phone) {
    try {
      const smsBody = videoRoomUrl
        ? `${user.name} is reaching out - join the video call: ${videoRoomUrl}`
        : `${user.name} is reaching out and wants to connect.`;

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

      const formData = new URLSearchParams();
      formData.append("To", person.phone);
      formData.append("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
      formData.append("Body", smsBody);

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (twilioRes.ok) {
        smsSent = true;
        console.log("Twilio SMS sent successfully to:", person.phone);
      } else {
        const errData = await twilioRes.text();
        console.error("Twilio SMS FAILED:", twilioRes.status, errData);
      }
    } catch (err) {
      console.error("Twilio SMS error:", err);
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
