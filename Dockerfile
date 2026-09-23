FROM node:22-alpine AS dependencies
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm config set dangerouslyAllowAllBuilds true && pnpm install --frozen-lockfile
FROM dependencies AS builder
ENV CI=true
COPY . .
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG ADMIN_API_URL
ENV ADMIN_API_URL=$ADMIN_API_URL
RUN pnpm build
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=18082 HOSTNAME=0.0.0.0
RUN addgroup -S strivepay && adduser -S -G strivepay strivepay
COPY --from=builder --chown=strivepay:strivepay /app/.next/standalone ./
COPY --from=builder --chown=strivepay:strivepay /app/.next/static ./.next/static
COPY --from=builder --chown=strivepay:strivepay /app/public ./public
USER strivepay
EXPOSE 18082
CMD ["node","server.js"]
