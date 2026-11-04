import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { describeDbError, pool } from '../db.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../email.js';
import { FRONTEND_URL, JWT_SECRET, roleForEmail } from '../config.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const normalizeEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// 1. User Register
export const register = async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (typeof name !== 'string' || !name.trim() || !isValidEmail(email) || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Name, a valid email and a password of at least 8 characters are required.' });
    }
    const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = roleForEmail(email);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name.trim(), email, hashedPassword, userRole]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
    }
    console.error('Register error:', error?.message || error);
    res.status(500).json({ success: false, message: describeDbError(error) || 'Registration failed. Please try again.' });
  }
};

// 2. User Login
export const login = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const role = roleForEmail(user.email);
    const token = jwt.sign({ id: user.id, role, email: user.email }, JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    });
  } catch (error: any) {
    console.error('Login error:', error?.code || '', error?.message || error);
    res.status(500).json({ success: false, message: describeDbError(error) || 'Login failed. Check the backend terminal for the exact error.' });
  }
};

// 3. Forgot Password (Sends Email)
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body.email);

    const userResult = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({ success: false, message: 'Email service is not configured. Add a real SMTP_USER and SMTP_PASS (Gmail App Password) to backend/.env.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 Hour

    await pool.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
      [resetToken, expires, userResult.rows[0].id]
    );

    const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    await sendPasswordResetEmail({ to: userResult.rows[0].email, resetLink });

    res.json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (error: any) {
    console.error('Forgot password error:', error?.message || error);
    res.status(500).json({ success: false, message: describeDbError(error) || 'Reset email could not be sent. Check SMTP settings and backend logs.' });
  }
};

// 4. Reset Password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'A valid token and password of at least 8 characters are required.' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [hashedPassword, userResult.rows[0].id]
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error: any) {
    console.error('Reset password error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Password reset failed. Check the database connection and try again.' });
  }
};

// 5. Change Password (signed-in users)
export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Your current password and a new password of at least 8 characters are required.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'The new password must be different from the current one.' });
    }

    const userResult = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user?.id]);
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, user.id]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error: any) {
    console.error('Change password error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not change password.' });
  }
};

// 6. Update profile name
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      return res.status(400).json({ success: false, message: 'Please enter a name of up to 120 characters.' });
    }
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email',
      [name.trim(), req.user?.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: { ...user, role: roleForEmail(user.email) } });
  } catch (error: any) {
    console.error('Update profile error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not update profile.' });
  }
};

// 7. Logout
export const logout = async (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
};
