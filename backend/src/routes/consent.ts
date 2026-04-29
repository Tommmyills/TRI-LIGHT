import { Hono } from "hono";
import { prisma } from "../prisma";

const consentRouter = new Hono();

function consentPage(senderName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TRI-LIGHT APP - Consent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1a1a1a; border-radius: 20px; padding: 32px 24px; max-width: 400px; width: 100%; text-align: center; }
    .logo { font-size: 14px; font-weight: 700; letter-spacing: 3px; color: #888; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    .sender { color: #ff4444; font-weight: 700; }
    p { color: #999; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .terms { font-size: 13px; color: #666; margin-bottom: 32px; line-height: 1.5; }
    form { display: flex; flex-direction: column; gap: 12px; }
    button { border: none; border-radius: 12px; padding: 16px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; }
    .accept { background: #22c55e; color: #fff; }
    .decline { background: #333; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">TRI-LIGHT APP</div>
    <h1><span class="sender">${senderName}</span> wants you as their accountability contact</h1>
    <p>By accepting, you agree to receive SMS check-in messages when ${senderName} needs support.</p>
    <div class="terms">You can opt out at any time by replying STOP to any message, or by declining below.</div>
    <form method="POST" action="accept">
      <button type="submit" class="accept">I Accept</button>
    </form>
    <form method="POST" action="decline" style="margin-top: 8px">
      <button type="submit" class="decline">No Thanks</button>
    </form>
  </div>
</body>
</html>`;
}

function statusPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TRI-LIGHT APP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1a1a1a; border-radius: 20px; padding: 32px 24px; max-width: 400px; width: 100%; text-align: center; }
    .logo { font-size: 14px; font-weight: 700; letter-spacing: 3px; color: #888; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
    p { color: #999; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">TRI-LIGHT APP</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

// GET /consent/:token - Show consent page
consentRouter.get("/:token", async (c) => {
  const token = c.req.param("token");

  const invitation = await prisma.consentInvitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return c.html(statusPage("Invalid Link", "This invitation link is invalid or has expired."));
  }

  if (invitation.consentedAt) {
    return c.html(statusPage("Already Accepted", "You've already accepted - thank you!"));
  }

  if (invitation.declinedAt) {
    return c.html(statusPage("Declined", "You've declined this invitation."));
  }

  return c.html(consentPage(invitation.senderName));
});

// POST /consent/:token/accept - Accept consent
consentRouter.post("/:token/accept", async (c) => {
  const token = c.req.param("token");

  const invitation = await prisma.consentInvitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return c.html(statusPage("Invalid Link", "This invitation link is invalid or has expired."));
  }

  if (invitation.consentedAt) {
    return c.html(statusPage("Already Accepted", "You've already accepted - thank you!"));
  }

  await prisma.consentInvitation.update({
    where: { token },
    data: { consentedAt: new Date(), declinedAt: null },
  });

  return c.html(
    statusPage(
      "You're In!",
      `Thank you for accepting. You'll now receive SMS check-in messages from ${invitation.senderName} when they need support. Reply STOP at any time to opt out.`
    )
  );
});

// POST /consent/:token/decline - Decline consent
consentRouter.post("/:token/decline", async (c) => {
  const token = c.req.param("token");

  const invitation = await prisma.consentInvitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return c.html(statusPage("Invalid Link", "This invitation link is invalid or has expired."));
  }

  await prisma.consentInvitation.update({
    where: { token },
    data: { declinedAt: new Date(), consentedAt: null },
  });

  return c.html(
    statusPage(
      "Invitation Declined",
      "You've declined this invitation. You will not receive SMS messages."
    )
  );
});

export { consentRouter };
