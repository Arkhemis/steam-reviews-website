import { Pool } from "pg";

// En dev, Next.js recharge ce module à chaud : on garde le pool sur `global`
// pour ne pas en recréer un à chaque hot-reload.
const globalForPg = global as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}
