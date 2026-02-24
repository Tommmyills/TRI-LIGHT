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

  return c.json({
    data: {
      videoRoomUrl,
    },
  });
});

export { reachRouter };
