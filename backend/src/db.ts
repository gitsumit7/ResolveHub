import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/** Turns common PostgreSQL / connection errors into a plain-language fix. */
export const describeDbError = (error: any): string | null => {
  const code = error?.code || error?.errors?.[0]?.code; // Node wraps localhost IPv4+IPv6 failures in an AggregateError
  switch (code) {
    case 'ECONNREFUSED':
      return 'Cannot connect to PostgreSQL. Start the PostgreSQL service and check the host/port in DATABASE_URL (backend/.env).';
    case 'ENOTFOUND':
      return 'The database host in DATABASE_URL (backend/.env) was not found.';
    case '28P01':
    case '28000':
      return 'PostgreSQL rejected the username or password in DATABASE_URL (backend/.env).';
    case '3D000':
      return 'The database named in DATABASE_URL does not exist. Create it in pgAdmin/psql, then run "npm run db:init".';
    case '42P01':
    case '42703':
      return 'Database tables are missing or outdated. Run "npm run db:init" in the backend folder, then restart the backend.';
    default:
      return null;
  }
};

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/resolvehub'
});
