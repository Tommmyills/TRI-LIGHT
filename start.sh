#!/bin/bash
cd backend
bun install
bunx prisma generate
bunx prisma db push --accept-data-loss
exec bun src/index.ts
