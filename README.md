# ResolveHub

AI-assisted customer support & ticketing desk.

- **frontend/** – React + Vite + Tailwind CSS v4
- **backend/** – Express 5 + PostgreSQL (+ optional OpenAI triage and Gmail SMTP)

## Run it

```bash
# 1. backend
cd backend
npm install
cp .env.example .env # then fill in your database URL, JWT secret, SMTP details
npm run db:init      # creates / upgrades tables — run this once after updating
npm run dev          # http://localhost:5000

# 2. frontend (new terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## Logins

| Account | Role |
|---|---|
| **sumitchaurasiya5154@gmail.com** | Admin (the only admin) |
| **sumitmmmut1@gmail.com** | Customer / user |
| everyone else who signs up | Customer / user |

Create the user login from the `backend` folder (choose your own password, min 8 characters):

```bash
npm run user:create -- sumitmmmut1@gmail.com YourPassword123 "Sumit"
```

Running it again for an existing email resets that account's password. You can also simply use **Create an account** on the sign-in page.
To use a different admin, set `ADMIN_EMAIL` in `backend/.env` and run `npm run db:init` again.

## Features

**Customers**
- Raise tickets with an optional category and attachment (PNG, JPG, WEBP, PDF, TXT · 5 MB)
- Matching help articles are suggested while typing a ticket
- Search, filter by status/priority and sort their tickets
- Conversation thread with the support team on every ticket, with a timeline of status changes
- Rate the support experience (1–5 stars + feedback) once a ticket is closed
- Edit a ticket within 12 hours, delete within 24 hours
- Help center, profile name and change password

**Admin**
- Overview: total, active queue, overdue (past SLA), critical open, average resolution time, customer rating
- 14-day intake chart, status and category breakdowns, “needs attention” list, monthly/yearly per-customer tables
- Ticket queue with search, filters, sorting and CSV export
- Change status (Open / In progress / Resolved / Not genuine) and override priority
- Reply to customers — they get an email; the first reply moves an open ticket to “In progress”

## Configuration (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `ADMIN_EMAIL` | Admin account email | `sumitchaurasiya5154@gmail.com` |
| `APP_NAME` | Name used in emails | `ResolveHub` |
| `SLA_HOURS` | Target resolution time for SLA metrics | `48` |
| `OPENAI_API_KEY` | Optional AI triage | – |
| `SMTP_*` | Gmail App Password for emails | – |

Frontend: set `VITE_API_URL` in `frontend/.env` if the backend is not on `http://localhost:5000`.
