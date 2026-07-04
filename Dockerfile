# ============================
# 1️⃣ BUILD STAGE
# ============================
FROM node:20-alpine AS build

WORKDIR /app

# Install deps first (better cache)
COPY package.json package-lock.json* ./
RUN npm install

# Copy full source INCLUDING prisma.config.ts
COPY . .

# 🔥 Generate Prisma client (config-driven)
RUN npx prisma generate

# Build Next.js
RUN npm run build


# ============================
# 2️⃣ RUNTIME STAGE
# ============================
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# App deps
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

# 🔥 COPY GENERATED PRISMA CLIENT (CRITICAL)
#COPY --from=build /app/src/generated ./src/generated

# Next build output
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

# Prisma schema + config (optional but safe)
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
