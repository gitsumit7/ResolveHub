// Create (or reset the password of) a login from the command line.
//   npm run user:create -- <email> <password> [full name]
// Example:
//   npm run user:create -- sumitmmmut1@gmail.com MyStrongPass123 "Sumit"
// The account gets the USER role unless the email equals ADMIN_EMAIL.
import bcrypt from 'bcrypt';
import { pool } from './db.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'sumitchaurasiya5154@gmail.com').trim().toLowerCase();

const [emailArg, password, ...nameParts] = process.argv.slice(2);
const email = (emailArg || '').trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 8) {
  console.error('Usage: npm run user:create -- <email> <password (min 8 chars)> [full name]');
  process.exit(1);
}

const role = email === ADMIN_EMAIL ? 'ADMIN' : 'USER';
const name = nameParts.join(' ').trim() || email.split('@')[0];

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);

  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE users SET password_hash = $1, role = $2, name = COALESCE(NULLIF($3, \'\'), name) WHERE id = $4',
      [passwordHash, role, nameParts.join(' ').trim(), existing.rows[0].id]
    );
    console.log(`Updated ${email} (${role}). The new password is active.`);
  } else {
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [name, email, passwordHash, role]
    );
    console.log(`Created ${role} login: ${email}`);
  }
  process.exit(0);
} catch (error) {
  console.error('Could not create the user. Did you run "npm run db:init" first?', error?.message || error);
  process.exit(1);
}
