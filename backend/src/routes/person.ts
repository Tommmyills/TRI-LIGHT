import { Hono } from "hono";
import { prisma } from "../prisma";
import type { auth } from "../auth";

const personRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

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

  return c.json({ data: person ?? null });
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
