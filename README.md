# flight_seek

Aviation solutions dashboard and helper to assist travelers encountering flight issues.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- PostgreSQL **with PostGIS** and Redis via Docker Compose

## Prerequisites

- Node.js 20+
- Docker Desktop (or Docker Engine + Compose)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Postgres (PostGIS) and Redis:

   ```bash
   npm run docker:up
   ```

3. Configure environment (defaults match Docker Compose):

   ```bash
   cp .env.example .env.local
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXT_PUBLIC_APP_URL` | Public site URL (metadata, absolute links) |

Server-side code should read configuration from [`src/lib/env.ts`](src/lib/env.ts) so values are validated at startup. That module is marked `server-only` and must not be imported from client components.

## Docker Compose

- **PostGIS** — `localhost:5432`, database `flight_seek`, user/password `flight_seek` (change for production). On first boot, the container runs init scripts in `docker/postgres/initdb/` to enable `postgis`.
- **Redis** — `localhost:6379`.

Stop containers:

```bash
npm run docker:down
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run docker:up` | Start Postgres + Redis |
| `npm run docker:down` | Stop Postgres + Redis |
