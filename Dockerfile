FROM oven/bun:1
WORKDIR /app

COPY backend/package.json backend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY backend/ .
RUN bunx prisma generate

EXPOSE 3000
ENV NODE_ENV=production
ENV ENVIRONMENT=production
CMD ["sh", "-c", "bunx prisma db push --accept-data-loss && exec bun src/index.ts"]
