This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://postgres:postgres@localhost:5433/avion`) |
| `CREDENTIALS_ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM credential encryption — generate with `node -e "require('crypto').randomBytes(32).toString('hex')"` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key from [dashboard.clerk.com](https://dashboard.clerk.com) |
| `CLERK_SECRET_KEY` | Clerk secret key — **never commit this value** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in path (e.g. `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up path (e.g. `/sign-up`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirect after sign-in (e.g. `/dashboard`) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirect after sign-up (e.g. `/onboarding`) |

Optional:

| Variable | Description |
|---|---|
| `TEST_DATABASE_URL` | Postgres the integration tests run against (falls back to `DATABASE_URL`). Each suite isolates into its own `?schema=…`. Point it at a **disposable** database. |

### 3. Start PostgreSQL

The app, worker, and driver all share one PostgreSQL database. For local
development, start one with Docker:

```bash
docker compose up -d db   # postgres:16 on localhost:5433 (matches .env.example)
```

Or point `DATABASE_URL` at any hosted Postgres (Neon, Supabase, RDS, …).

### 4. Apply migrations

```bash
npx prisma migrate deploy   # apply the committed migrations to DATABASE_URL
# (use `npx prisma migrate dev` only when changing the schema — it needs a
#  database it can also create a shadow DB on, e.g. local Docker Postgres.)
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Desktop app (Electron)

Avion also runs as a native desktop app — the full Next.js application
(UI, Server Actions, Prisma, Clerk, and the autonomous worker/driver) packaged
so users can launch it like any other app, no terminal required.

```bash
npm run electron:dev    # develop: next dev + Electron together
npm run dist            # build installers (dmg / nsis / AppImage) → release/
```

> ⚠️ **Desktop packaging is deferred (MUS-247).** The desktop build previously
> bundled a local **SQLite** file database. Now that the runtime uses hosted
> PostgreSQL, the packaging needs reworking to connect to a `DATABASE_URL`
> instead of seeding a local file DB — `npm run dist` will fail fast until that
> follow-up lands. The web app (`npm run dev`) is the supported path.

See [`docs/ELECTRON.md`](docs/ELECTRON.md) for the architecture, build steps,
and caveats.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
