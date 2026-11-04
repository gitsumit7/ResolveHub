// App-wide settings. Set VITE_API_URL in frontend/.env to point at a different backend.
export const APP_NAME = 'ResolveHub';
export const APP_TAGLINE = 'AI-assisted customer support desk';

export const API_ORIGIN = ((import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5000').replace(/\/$/, '');
export const API_BASE = `${API_ORIGIN}/api`;

export const SUPPORT_EMAIL = 'sumitchaurasiya5154@gmail.com';
export const SUPPORT_HOURS = 'Mon–Sat, 10 AM – 6 PM IST';

// Must match the backend rules for editing / deleting a ticket.
export const EDIT_WINDOW_HOURS = 12;
export const DELETE_WINDOW_HOURS = 24;
