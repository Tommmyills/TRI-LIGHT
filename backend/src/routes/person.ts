import { Hono } from "hono";
import { prisma } from "../prisma";

const personRouter = new Hono();

// Save or update a person
personRouter.post("/", async (c) => {
  const body = await c.req.json();
  const { name, phone, deviceId } = body;

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

  const person = await prisma.person.upsert({
    where: { deviceId },
    update: { name, phone },
    create: { name, phone, deviceId },
  });

  return c.json({ data: person });
});

// Get person by deviceId
personRouter.get("/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId");
  const person = await prisma.person.findUnique({
    where: { deviceId },
  });

  if (!person) {
    return c.json({ data: null });
  }

  return c.json({ data: person });
});

export { personRouter };
