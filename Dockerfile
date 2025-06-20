# Etap 1: Budowanie aplikacji (builder)
FROM node:18 AS builder

# Argumenty build-time do przekazania zmiennych środowiskowych
ARG DATABASE_URL
ARG APIFY_API_TOKEN
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

WORKDIR /app

# Kopiowanie plików manifestu zależności
COPY package.json package-lock.json ./

# Instalacja WSZYSTKICH zależności (w tym devDependencies), ale pomijamy postinstall
RUN npm ci --ignore-scripts

# Kopiowanie schematu Prisma PRZED kopiowaniem reszty kodu
COPY prisma ./prisma/

# Wygenerowanie Prisma Client
RUN npx prisma generate

# Kopiowanie reszty kodu źródłowego aplikacji
COPY . .

# Wyłączenie telemetrii Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Uruchomienie procesu budowania aplikacji
RUN npm run build

# Etap 2: Production image
FROM node:18

WORKDIR /app

# Ustawienie środowiska na produkcyjne
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Kopiowanie plików package.json
COPY --from=builder /app/package*.json ./

# Instalacja tylko production dependencies
RUN npm ci --omit=dev

# Kopiowanie built aplikacji
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Regeneracja Prisma Client dla production environment
RUN npx prisma generate

# Utworzenie dedykowanego użytkownika i grupy dla bezpieczeństwa
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app

# Ustawienie użytkownika na 'nextjs' dla zwiększenia bezpieczeństwa
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standardowe uruchomienie Next.js z debug logging
CMD echo "🔍 Checking environment variables..." && \
    echo "DATABASE_URL exists: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')" && \
    echo "NEXTAUTH_SECRET exists: $([ -n "$NEXTAUTH_SECRET" ] && echo 'YES' || echo 'NO')" && \
    echo "APIFY_API_TOKEN exists: $([ -n "$APIFY_API_TOKEN" ] && echo 'YES' || echo 'NO')" && \
    echo "🚀 Starting Next.js..." && \
    npx next start