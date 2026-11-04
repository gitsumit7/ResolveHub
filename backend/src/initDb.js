import { pool } from './db.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'sumitchaurasiya5154@gmail.com').trim().toLowerCase();

const createTables = async () => {
  const schemaQuery = `
    DO $$ BEGIN
      CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'REJECTED';

    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
        reset_password_token VARCHAR(255),
        reset_password_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;

    CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        priority ticket_priority DEFAULT 'MEDIUM',
        status ticket_status DEFAULT 'OPEN',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        attachment_url TEXT,
        attachment_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
    );

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
      ADD COLUMN IF NOT EXISTS feedback TEXT,
      ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP;

    -- Conversation thread + timeline for each ticket
    CREATE TABLE IF NOT EXISTS ticket_comments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        author_role VARCHAR(20) NOT NULL DEFAULT 'USER',
        message TEXT NOT NULL,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
  `;

  try {
    await pool.query(schemaQuery);

    // Only ADMIN_EMAIL (from backend/.env) is an admin; everyone else is a regular user.
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    await pool.query(
      "UPDATE users SET role = CASE WHEN LOWER(email) = $1 THEN 'ADMIN' ELSE 'USER' END",
      [ADMIN_EMAIL]
    );
    await pool.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'))");

    console.log(`ResolveHub database is ready. Admin account: ${ADMIN_EMAIL}`);
    process.exit(0);
  } catch (error) {
    console.error("Error updating tables:", error);
    process.exit(1);
  }
};

createTables();
