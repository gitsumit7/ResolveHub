import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { APP_NAME, ADMIN_EMAIL } from './config.js';
import {
  createTicket,
  getTickets,
  getMetrics,
  updateTicketStatus,
  updateTicketPriority,
  updateTicketDetails,
  deleteTicket,
  getComments,
  addComment,
  rateTicket
} from './controllers/ticketController.js';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  logout
} from './controllers/authController.js';
import { authenticateRole } from './middleware/auth.js';

const app = express();
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];
    callback(null, allowed.includes(file.mimetype));
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDirectory));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, app: APP_NAME, time: new Date().toISOString() });
});

// ==========================================
// 1. Auth Routes
// ==========================================
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/reset-password', resetPassword);
app.post('/api/auth/logout', logout);
app.post('/api/auth/change-password', authenticateRole(['USER', 'ADMIN']), changePassword);
app.patch('/api/auth/profile', authenticateRole(['USER', 'ADMIN']), updateProfile);

// ==========================================
// 2. Ticket Routes (Protected with RBAC)
// ==========================================

// USER and ADMIN can create and read tickets
app.post('/api/tickets', authenticateRole(['USER', 'ADMIN']), upload.single('attachment'), createTicket);
app.get('/api/tickets', authenticateRole(['USER', 'ADMIN']), getTickets);

// ADMIN only: metrics, status and priority control
app.get('/api/tickets/metrics', authenticateRole(['ADMIN']), getMetrics);
app.patch('/api/tickets/:id/status', authenticateRole(['ADMIN']), updateTicketStatus);
app.patch('/api/tickets/:id/priority', authenticateRole(['ADMIN']), updateTicketPriority);

// Conversation thread (owner or admin)
app.get('/api/tickets/:id/comments', authenticateRole(['USER', 'ADMIN']), getComments);
app.post('/api/tickets/:id/comments', authenticateRole(['USER', 'ADMIN']), addComment);

// USER only: rate, edit and delete own tickets
app.post('/api/tickets/:id/rating', authenticateRole(['USER']), rateTicket);
app.patch('/api/tickets/:id', authenticateRole(['USER']), updateTicketDetails);
app.delete('/api/tickets/:id', authenticateRole(['USER']), deleteTicket);

// Return JSON (not an HTML page) for upload errors such as files over 5 MB
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Attachment is larger than 5 MB.' : err.message;
    return res.status(400).json({ success: false, message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

// ==========================================
// Server Start
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`${APP_NAME} backend running on port ${PORT} (admin: ${ADMIN_EMAIL})`);
});
