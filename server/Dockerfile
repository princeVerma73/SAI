# -------------------------------------------------------------
# Stage 1: Build Backend & Generate Prisma Client
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./

# Install all dependencies (including devDependencies required for Prisma CLI)
RUN npm ci

# Copy schema and generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

# Prune devDependencies to keep the production runtime lean
RUN npm prune --production

COPY src ./src

# -------------------------------------------------------------
# Stage 2: Production Node Runtime
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY package*.json ./

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

EXPOSE 5000

CMD ["node", "src/server.js"]
