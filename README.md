# StrivePay Admin Web

Internal Operations Cockpit for customer inspection, transaction economics, and runtime readiness. It talks to the Java API at `http://127.0.0.1:18080` through same-origin Next.js route handlers.

## Local development

The Java API must be available at `http://127.0.0.1:18080`. Bootstrap administrator credentials are set by Compose (`STRIVEPAY_ADMIN_EMAIL` / `STRIVEPAY_ADMIN_PASSWORD`).

```powershell
Copy-Item .env.example .env.local
pnpm api:types
pnpm dev
```

Open `http://127.0.0.1:18082`.

## Verification

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Administrator sessions use an `HttpOnly` cookie (`sp_admin_access`). The raw access token is never returned to browser JavaScript. There is no refresh token; idle and absolute expiry are enforced by the API.

## API contract

Regenerate the Java API contract first, then update the TypeScript definitions:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:18080/v3/api-docs" -OutFile "../consumer-api/docs/openapi.json"
pnpm api:types
```
