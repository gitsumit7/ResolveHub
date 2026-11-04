import dotenv from 'dotenv';

dotenv.config();

// Central app settings. Every value can be overridden from backend/.env.
export const APP_NAME = process.env.APP_NAME || 'ResolveHub';

// The account with this email is the platform admin. Everyone else is a USER.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'sumitchaurasiya5154@gmail.com').trim().toLowerCase();

export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

export const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// Target time (in hours) to resolve a ticket. Used for SLA / overdue metrics.
export const SLA_HOURS = Math.max(1, Number(process.env.SLA_HOURS || 48));

export const roleForEmail = (email: string): 'ADMIN' | 'USER' =>
  email.trim().toLowerCase() === ADMIN_EMAIL ? 'ADMIN' : 'USER';
