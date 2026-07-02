/**
 * Provision the read-only Postgres role for @avion/api (MUS-265).
 *
 * The api treats the shared Avion database as read-only, but by default it
 * connects with the same superuser DATABASE_URL as apps/web — nothing
 * technically prevents writes. This script makes "read-only" a database-level
 * guarantee by (idempotently) creating the `avion_api_ro` role:
 *
 *   - LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE
 *   - CONNECT on the current database
 *   - USAGE on schema public
 *   - SELECT on all current tables in schema public
 *   - ALTER DEFAULT PRIVILEGES → SELECT on FUTURE tables in schema public
 *
 * Run it with an admin connection — the SAME role that runs Prisma migrations
 * (locally the `postgres` superuser), because ALTER DEFAULT PRIVILEGES only
 * covers tables later created by the role that executes it:
 *
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/avion" \
 *     pnpm --filter @avion/api db:provision-readonly
 *
 * Password: set AVION_API_RO_PASSWORD to choose (or rotate) the role's
 * password. Without it, the role is created with the local-dev default
 * "avion_api_ro" (an existing role's password is never touched unless
 * AVION_API_RO_PASSWORD is explicitly set). Then point the api at the role:
 *
 *   API_DATABASE_URL="postgresql://avion_api_ro:<password>@localhost:5433/avion"
 *
 * Re-running is always safe: grants are idempotent and re-applied so tables
 * created since the last run are covered.
 */
import { Client } from "pg";

const ROLE = "avion_api_ro";

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    throw new Error(
      "DATABASE_URL is not set. Run with the admin connection used for migrations, e.g.\n" +
        '  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/avion" pnpm --filter @avion/api db:provision-readonly',
    );
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const {
      rows: [{ db, usr }],
    } = await client.query<{ db: string; usr: string }>(
      "SELECT current_database() AS db, current_user AS usr",
    );

    const password = process.env.AVION_API_RO_PASSWORD;
    const { rowCount } = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [ROLE]);
    const roleExists = (rowCount ?? 0) > 0;

    if (!roleExists) {
      const initialPassword = password ?? ROLE;
      if (!password) {
        console.warn(
          `AVION_API_RO_PASSWORD is not set — creating "${ROLE}" with the local-dev default ` +
            `password "${ROLE}". Set AVION_API_RO_PASSWORD for anything beyond local dev.`,
        );
      }
      await client.query(
        `CREATE ROLE ${ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE ` +
          `PASSWORD ${client.escapeLiteral(initialPassword)}`,
      );
      console.log(`Created role "${ROLE}".`);
    } else {
      console.log(`Role "${ROLE}" already exists — re-applying grants.`);
      if (password) {
        await client.query(`ALTER ROLE ${ROLE} PASSWORD ${client.escapeLiteral(password)}`);
        console.log(`Updated "${ROLE}" password from AVION_API_RO_PASSWORD.`);
      }
    }

    await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(db)} TO ${ROLE}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ROLE}`);
    // Future tables created by the current (migration) role stay readable.
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ROLE}`);

    console.log(
      `Provisioned read-only access for "${ROLE}" on database "${db}" ` +
        `(SELECT on all current tables + default privileges for tables created by "${usr}").`,
    );
    console.log(
      `Point the api at it via apps/api/.env:\n` +
        `  API_DATABASE_URL="postgresql://${ROLE}:<password>@<host>:<port>/${db}"`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Failed to provision the read-only role:", err);
  process.exit(1);
});
