FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bunx prisma generate

EXPOSE 3000
ENV NODE_ENV=production
ENV ENVIRONMENT=production
CMD ["sh", "-c", "bunx prisma db push --accept-data-loss && exec bun src/index.ts"]
