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

  // Create Daily.co room
  if (env.DAILY_API_KEY) {
    try {
      const roomName = `reach-${Date.now()}`;
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
        const dailyData = await dailyRes.json() as { url?: string };
        videoRoomUrl = dailyData.url || null;
      }
    } catch (err) {
      console.error("Daily.co error:", err);
    }
  }

  // Send Twilio SMS
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
      smsSent,
    },
  });
});

export { reachRouter };
