import { Hono } from "hono";
import { prisma } from "../prisma";

const consentRouter = new Hono();

function consentPage(senderName: string, token: string): string {
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
    <form method="POST" action="/consent/${token}/accept">
      <button type="submit" class="accept">I Accept</button>
    </form>
    <form method="POST" action="/consent/${token}/decline" style="margin-top: 8px">
      <button type="submit" class="decline">No Thanks</button>
    </form>
  </div>
</body>
</html>`;
}

function statusPage(title: string, message: string, isSuccess = false): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>R.E.A.C.H.</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1a1a1a; border-radius: 20px; padding: 36px 28px; max-width: 400px; width: 100%; text-align: center; }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: 8px; color: #fff; margin-bottom: 4px; text-shadow: 0 0 18px rgba(204,0,0,0.6); }
    .logo-sub { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.25); text-transform: uppercase; margin-bottom: 28px; }
    .icon { font-size: 52px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; color: ${isSuccess ? '#22c55e' : '#fff'}; }
    p { color: #999; font-size: 15px; line-height: 1.6; margin-bottom: 0; }
    .steps { background: #111; border-radius: 14px; padding: 20px; margin-top: 24px; text-align: left; }
    .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .step:last-child { margin-bottom: 0; }
    .step-num { background: #cc0000; color: #fff; width: 22px; height: 22px; border-radius: 50%; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .step-text { color: #ccc; font-size: 14px; line-height: 1.5; }
    .close-note { margin-top: 24px; font-size: 13px; color: #444; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">R.E.A.C.H.</div>
    <div class="logo-sub">Realtime Engagement &amp; Accountability Compliance Hub</div>
    <div class="icon">${isSuccess ? '✅' : '❌'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${isSuccess ? `
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text"><strong style="color:#fff">Watch your email.</strong> When your contact needs support, you'll receive an email with a Join Call button.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text"><strong style="color:#fff">Respond quickly.</strong> Tap the Join Call link in that email to connect right away.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><strong style="color:#fff">Stay accessible.</strong> Keep notifications on so you don't miss a message when it matters most.</div></div>
    </div>
    <p class="close-note">You can close this page — you're all set.</p>
    ` : ''}
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

  return c.html(consentPage(invitation.senderName, token));
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
      "You're confirmed!",
      `You're now an accountability contact for ${invitation.senderName}. Here's what happens next:`,
      true
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
