# syntax=docker/dockerfile:1
# Multi-stage Next.js build for Fly.io deploy.
# Builds the app, seeds the SQLite db at build time, and ships
# the standalone server in a minimal runner image.

# ----- deps -----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ----- builder -----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create the SQLite db and seed it so the image ships with data.
RUN mkdir -p ./data && npm run db:push && npm run db:seed

RUN npm run build

# ----- runner -----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output includes server.js + minimal node_modules.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Ship the seeded database with the image.
COPY --from=builder /app/data ./data

EXPOSE 3000
CMD ["node", "server.js"]
