# REACH

One button. One person. Instant connection.

## What It Does

REACH is a mobile-first app with a single, massive 3D red button. When pressed:
- First time: A registration modal slides up asking you to save your accountability person's name and phone number
- After registration: The button connects you to your person instantly

## Architecture

- **Frontend**: Expo React Native app with Reanimated animations, NativeWind styling
- **Backend**: Hono API server with Prisma (SQLite) for data storage

## API Endpoints

- `POST /api/person` — Save or update accountability person (body: `{ name, phone, deviceId }`)
- `GET /api/person/:deviceId` — Retrieve saved person by device ID

## Key Files

- `mobile/src/app/index.tsx` — Main REACH screen with 3D button, registration modal, and confirmation
- `mobile/src/lib/state/reach-store.ts` — Zustand store for person data persistence
- `backend/src/routes/person.ts` — Person API routes
- `backend/prisma/schema.prisma` — Database schema
