import { Hono } from "hono";
import { env } from "../env";
import { prisma } from "../prisma";
import type { auth } from "../auth";
import twilio from "twilio";

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
  let smsError: { message: string; code?: string | number; status?: number; moreInfo?: string } | null = null;

  console.log("[REACH] Twilio env check:", {
    hasSid: !!env.TWILIO_ACCOUNT_SID,
    hasToken: !!env.TWILIO_AUTH_TOKEN,
    hasPhone: !!env.TWILIO_PHONE_NUMBER,
    fromNumber: env.TWILIO_PHONE_NUMBER || "(not set)",
  });

  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
    try {
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

      let messageBody = `Hey, ${user.name} is reaching out.`;
      if (videoRoomUrl) {
        messageBody += `\n${videoRoomUrl}`;
      }

      console.log("[REACH] Sending SMS:", {
        to: person.phone,
        from: env.TWILIO_PHONE_NUMBER,
        body: messageBody,
      });

      const twilioMessage = await client.messages.create({
        body: messageBody,
        from: env.TWILIO_PHONE_NUMBER,
        to: person.phone,
      });

      console.log("[REACH] Twilio response:", {
        sid: twilioMessage.sid,
        status: twilioMessage.status,
        to: twilioMessage.to,
        from: twilioMessage.from,
        errorCode: twilioMessage.errorCode,
        errorMessage: twilioMessage.errorMessage,
      });

      smsSent = true;
    } catch (err) {
      const twilioErr = err as { message?: string; code?: string | number; status?: number; moreInfo?: string };
      console.error("[REACH] Twilio error (full object):", err);
      console.error("[REACH] Twilio error details:", {
        message: twilioErr.message,
        code: twilioErr.code,
        status: twilioErr.status,
        moreInfo: twilioErr.moreInfo,
      });
      smsError = {
        message: twilioErr.message || "Unknown Twilio error",
        code: twilioErr.code,
        status: twilioErr.status,
        moreInfo: twilioErr.moreInfo,
      };
    }
  } else {
    console.warn("[REACH] Twilio not configured - missing one or more env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)");
  }

  return c.json({
    data: {
      smsSent,
      videoRoomUrl,
      person: { name: person.name, phone: person.phone },
      debug: {
        smsError,
        twilioConfigured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER),
      },
    },
  });
});

export { reachRouter };
