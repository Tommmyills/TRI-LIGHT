# REACH

One button. One person. Instant connection.

## What It Does

REACH is a mobile-first app with a single, massive 3D red button. When pressed:
- **No person saved**: A registration modal slides up to save your accountability person's name and phone number
- **Person saved**: Sends an SMS + creates a Daily.co video room link to your person instantly

## Authentication

- Email + password sign up / sign in via Better Auth
- Forgot password flow included
- Saved person persists to your account across sessions and devices

## Features

1. **SMS via Twilio** — When REACH is pressed, sends: `"Hey, [name] is reaching out."` + video link on second line
2. **Video Call via Daily.co** — Creates a browser-based video room (no app download needed for recipient)
3. **Auth** — Email/password accounts; person linked to account, not just device
4. **Settings** — Discrete gear icon (top right) opens a sheet: Change My Person, Sign Out, Close

## Architecture

- **Frontend**: Expo React Native (SDK 53), Reanimated animations, NativeWind styling, Zustand + React Query
- **Backend**: Hono + Bun, Prisma (SQLite), Better Auth

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path, e.g. `file:./dev.db` |
| `BETTER_AUTH_SECRET` | Random 32-char secret |
| `BACKEND_URL` | Backend URL |
| `TWILIO_ACCOUNT_SID` | From Twilio console |
| `TWILIO_AUTH_TOKEN` | From Twilio console |
| `TWILIO_PHONE_NUMBER` | Twilio sender number |
| `DAILY_API_KEY` | From Daily.co dashboard |

## API Endpoints

- `POST /api/auth/*` — Better Auth (sign-in, sign-up, session)
- `POST /api/person` — Save or update accountability person
- `GET /api/person/for-user` — Get person linked to logged-in user
- `GET /api/person/:deviceId` — Get person by device ID (legacy)
- `POST /api/reach` — Trigger SMS + video call (requires auth)

## Key Files

- `mobile/src/app/(app)/index.tsx` — Main REACH screen (protected)
- `mobile/src/app/sign-in.tsx` — Sign in screen
- `mobile/src/app/sign-up.tsx` — Sign up screen
- `mobile/src/app/forgot-password.tsx` — Forgot password screen
- `mobile/src/lib/auth/auth-client.ts` — Better Auth client
- `mobile/src/lib/state/reach-store.ts` — Zustand store for person data
- `backend/src/routes/reach.ts` — REACH trigger (Twilio + Daily.co)
- `backend/src/routes/person.ts` — Person CRUD
- `backend/src/auth.ts` — Better Auth config
- `backend/prisma/schema.prisma` — Database schema
