import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import OpenAI from 'openai';
import { pool } from '../db.js';
import { sendTicketReplyEmail, sendTicketStatusEmail } from '../email.js';
import { SLA_HOURS } from '../config.js';

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey && apiKey !== 'your_openai_api_key_here' ? new OpenAI({ apiKey }) : null;

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const CATEGORIES = ['Billing', 'Technical', 'Account', 'General'] as const;
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Not genuine'
};

// Every ticket query returns the owner's name/email and the number of real (non-system) replies.
const TICKET_SELECT = `
  SELECT t.*,
         u.name AS owner_name,
         u.email AS owner_email,
         (SELECT COUNT(*)::int FROM ticket_comments c WHERE c.ticket_id = t.id AND c.is_system = FALSE) AS comment_count
  FROM tickets t
  LEFT JOIN users u ON u.id = t.created_by`;

const parseTicketId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const fetchTicket = async (ticketId: number) => {
  const result = await pool.query(`${TICKET_SELECT} WHERE t.id = $1`, [ticketId]);
  return result.rows[0] || null;
};

// Admins can see every ticket; users only their own.
const fetchAccessibleTicket = async (ticketId: number, user: AuthenticatedRequest['user']) => {
  const ticket = await fetchTicket(ticketId);
  if (!ticket || !user) return null;
  if (user.role !== 'ADMIN' && String(ticket.created_by) !== String(user.id)) return null;
  return ticket;
};

// Status and priority changes are logged in the conversation as system notes, giving each ticket a timeline.
const addSystemNote = (ticketId: number, message: string, actor?: AuthenticatedRequest['user']) =>
  pool.query(
    `INSERT INTO ticket_comments (ticket_id, author_id, author_role, message, is_system) VALUES ($1, $2, $3, $4, TRUE)`,
    [ticketId, actor?.id || null, actor?.role || 'SYSTEM', message]
  );

// Background Async AI Processor Function (Non-blocking)
const processTicketWithAI = async (ticketId: number, title: string, description: string, keepCategory: boolean) => {
  if (!openai) return;

  try {
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Analyze the issue. Return JSON: {"category": "Billing|Technical|Account|General", "priority": "LOW|MEDIUM|HIGH|CRITICAL"}`
        },
        { role: "user", content: `Title: ${title}\nDescription: ${description}` }
      ]
    });

    const content = aiResponse.choices[0]?.message.content;
    const parsed = JSON.parse(content || '{}');

    const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'General';
    const priorityCandidate = String(parsed.priority || '').toUpperCase();
    const priority = (PRIORITIES as readonly string[]).includes(priorityCandidate) ? priorityCandidate : 'MEDIUM';

    // Update ticket in database after AI evaluation (a category the user chose is kept)
    await pool.query(
      keepCategory
        ? `UPDATE tickets SET priority = $1::ticket_priority, updated_at = NOW() WHERE id = $2`
        : `UPDATE tickets SET priority = $1::ticket_priority, category = $3, updated_at = NOW() WHERE id = $2`,
      keepCategory ? [priority, ticketId] : [priority, ticketId, category]
    );
  } catch (aiErr: any) {
    console.warn(`[Background AI Processing Error for Ticket ID ${ticketId}]:`, aiErr?.message || aiErr);
  }
};

const ruleBasedTriage = (title: string, description: string) => {
  const text = `${title} ${description}`.toLowerCase();
  if (/(outage|down for everyone|data loss|security|breach|hacked)/.test(text)) return { category: 'Technical', priority: 'CRITICAL' };
  if (/(password|login|log in|sign in|account|otp)/.test(text)) return { category: 'Account', priority: 'HIGH' };
  if (/(payment|billing|invoice|refund|charged|charge)/.test(text)) return { category: 'Billing', priority: 'HIGH' };
  if (/(error|bug|crash|not working|broken|fail)/.test(text)) return { category: 'Technical', priority: 'MEDIUM' };
  return { category: 'General', priority: 'MEDIUM' };
};

export const createTicket = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }
    if (title.length > 255) {
      return res.status(400).json({ success: false, message: 'Title must be 255 characters or fewer.' });
    }

    // Fast Initial Rule-based Fallback; a category picked by the user wins over the guess.
    const triage = ruleBasedTriage(title, description);
    const chosenCategory = (CATEGORIES as readonly string[]).includes(req.body.category) ? String(req.body.category) : null;
    const category = chosenCategory || triage.category;

    // 1. Instant Insert with baseline tags
    const insertQuery = `
      INSERT INTO tickets (title, description, category, priority, created_by, attachment_url, attachment_name)
      VALUES ($1, $2, $3, $4::ticket_priority, $5, $6, $7) RETURNING id;
    `;

    const newTicket = await pool.query(insertQuery, [
      title,
      description,
      category,
      triage.priority,
      req.user?.id || null,
      req.file ? `/uploads/${req.file.filename}` : null,
      req.file?.originalname || null
    ]);

    const ticketData = await fetchTicket(newTicket.rows[0].id);

    // 2. Respond immediately to user (Reduces latency by 90-95%)
    res.status(201).json({ success: true, data: ticketData });

    // 3. Trigger AI routing asynchronously in the background
    processTicketWithAI(ticketData.id, title, description, Boolean(chosenCategory));

  } catch (error: any) {
    console.error("Database/Server Error:", error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getTickets = async (req: Request, res: Response) => {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;
    const isAdmin = authenticatedRequest.user?.role === 'ADMIN';
    const query = isAdmin
      ? `${TICKET_SELECT} ORDER BY t.created_at DESC`
      : `${TICKET_SELECT} WHERE t.created_by = $1 ORDER BY t.created_at DESC`;
    const values = isAdmin ? [] : [authenticatedRequest.user?.id];
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Fetch Tickets Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMetrics = async (_req: Request, res: Response) => {
  try {
    const summaryResult = await pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
             COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
             COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
             COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
             COUNT(*) FILTER (WHERE priority = 'CRITICAL')::int AS critical,
             COUNT(*) FILTER (WHERE priority = 'CRITICAL' AND status IN ('OPEN', 'IN_PROGRESS'))::int AS critical_open,
             COUNT(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS') AND created_at < NOW() - make_interval(hours => $1))::int AS overdue,
             COUNT(*) FILTER (WHERE status = 'RESOLVED' AND resolved_at - created_at > make_interval(hours => $1))::int AS resolved_late,
             ROUND((AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE status = 'RESOLVED' AND resolved_at IS NOT NULL))::numeric, 1)::float AS avg_resolution_hours,
             ROUND(AVG(rating)::numeric, 2)::float AS avg_rating,
             COUNT(rating)::int AS rated_count,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7_days
      FROM tickets
    `, [SLA_HOURS]);
    const categoryResult = await pool.query(`
      SELECT COALESCE(category, 'General') AS label, COUNT(*)::int AS count
      FROM tickets GROUP BY COALESCE(category, 'General') ORDER BY count DESC, label ASC
    `);
    const trendResult = await pool.query(`
      SELECT TO_CHAR(day, 'YYYY-MM-DD') AS day, COUNT(t.id)::int AS count
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS day
      LEFT JOIN tickets t ON t.created_at::date = day::date
      GROUP BY day ORDER BY day
    `);
    const monthlyResult = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', t.created_at), 'YYYY-MM') AS period,
             COALESCE(NULLIF(u.name, ''), u.email, 'Unknown user') AS user_name,
             COUNT(*)::int AS complaint_count
      FROM tickets t
      LEFT JOIN users u ON u.id = t.created_by
      GROUP BY DATE_TRUNC('month', t.created_at), u.id, u.name, u.email
      ORDER BY DATE_TRUNC('month', t.created_at) DESC, complaint_count DESC, user_name ASC
    `);
    const yearlyResult = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('year', t.created_at), 'YYYY') AS period,
             COALESCE(NULLIF(u.name, ''), u.email, 'Unknown user') AS user_name,
             COUNT(*)::int AS complaint_count
      FROM tickets t
      LEFT JOIN users u ON u.id = t.created_by
      GROUP BY DATE_TRUNC('year', t.created_at), u.id, u.name, u.email
      ORDER BY DATE_TRUNC('year', t.created_at) DESC, complaint_count DESC, user_name ASC
    `);

    const summary = summaryResult.rows[0];
    const slaBreachRate = summary.resolved > 0 ? Math.round((summary.resolved_late / summary.resolved) * 1000) / 10 : 0;

    res.json({
      success: true,
      data: {
        total: summary.total,
        open: summary.open,
        inProgress: summary.in_progress,
        resolved: summary.resolved,
        rejected: summary.rejected,
        critical: summary.critical,
        criticalOpen: summary.critical_open,
        overdue: summary.overdue,
        slaHours: SLA_HOURS,
        slaBreachRate,
        avgResolutionHours: summary.avg_resolution_hours,
        avgRating: summary.avg_rating,
        ratedCount: summary.rated_count,
        last7Days: summary.last_7_days,
        byCategory: categoryResult.rows,
        trend: trendResult.rows,
        monthly: monthlyResult.rows,
        yearly: yearlyResult.rows
      }
    });
  } catch (error: any) {
    console.error("Fetch Metrics Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateTicketDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    const { title, description } = req.body;

    if (!ticketId || typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const result = await pool.query(
      `UPDATE tickets
       SET title = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND created_by = $4 AND created_at >= NOW() - INTERVAL '12 hours'
       RETURNING id`,
      [title.trim(), description.trim(), ticketId, req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You can edit only your own complaint within 12 hours of registration.' });
    }

    res.json({ success: true, data: await fetchTicket(ticketId) });
  } catch (error: any) {
    console.error('Edit Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Unable to edit complaint.' });
  }
};

export const deleteTicket = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Invalid ticket id.' });
    }

    const result = await pool.query(
      `DELETE FROM tickets
       WHERE id = $1 AND created_by = $2 AND created_at >= NOW() - INTERVAL '24 hours'
       RETURNING id`,
      [ticketId, req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You can delete only your own complaint within 24 hours of registration.' });
    }

    res.json({ success: true, message: 'Complaint deleted successfully.' });
  } catch (error: any) {
    console.error('Delete Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Unable to delete complaint.' });
  }
};

// Status control with resolution monitoring, timeline note and email notification
export const updateTicketStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    const { status } = req.body;
    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Invalid ticket id.' });
    }

    if (typeof status !== 'string' || !(STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket status.' });
    }

    const existing = await fetchTicket(ticketId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (existing.status === status) {
      return res.json({ success: true, data: existing, notificationQueued: false });
    }

    await pool.query(
      `UPDATE tickets
       SET status = $1::ticket_status,
           updated_at = NOW(),
           resolved_at = CASE WHEN $1::ticket_status IN ('RESOLVED'::ticket_status, 'REJECTED'::ticket_status) THEN NOW() ELSE NULL END
       WHERE id = $2`,
      [status, ticketId]
    );
    await addSystemNote(ticketId, `Status changed from ${STATUS_LABELS[existing.status]} to ${STATUS_LABELS[status]}.`, req.user);

    const ticket = await fetchTicket(ticketId);
    const ownerEmail = ticket.owner_email;
    const shouldNotify = Boolean(ownerEmail) && (status === 'RESOLVED' || status === 'REJECTED');

    if (shouldNotify) {
      sendTicketStatusEmail({
        to: ownerEmail,
        title: ticket.title,
        ticketId,
        status: status as 'RESOLVED' | 'REJECTED'
      }).catch((emailError: any) => {
        console.error(`Ticket ${ticketId} status email failed:`, emailError?.message || emailError);
      });
    }

    res.json({ success: true, data: ticket, notificationQueued: shouldNotify });
  } catch (error: any) {
    console.error("Update Status Error:", error);
    res.status(500).json({ success: false, message: error?.message || 'Server error while updating ticket status.' });
  }
};

// Admin can override the AI-assigned priority
export const updateTicketPriority = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    const { priority } = req.body;
    if (!ticketId || typeof priority !== 'string' || !(PRIORITIES as readonly string[]).includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket or priority.' });
    }

    const existing = await fetchTicket(ticketId);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (existing.priority === priority) return res.json({ success: true, data: existing });

    await pool.query(
      `UPDATE tickets SET priority = $1::ticket_priority, updated_at = NOW() WHERE id = $2`,
      [priority, ticketId]
    );
    await addSystemNote(ticketId, `Priority changed from ${existing.priority} to ${priority}.`, req.user);
    res.json({ success: true, data: await fetchTicket(ticketId) });
  } catch (error: any) {
    console.error('Update Priority Error:', error);
    res.status(500).json({ success: false, message: 'Could not update priority.' });
  }
};

// Conversation thread between the ticket owner and the support team
export const getComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket id.' });

    const ticket = await fetchAccessibleTicket(ticketId, req.user);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const result = await pool.query(
      `SELECT c.id, c.ticket_id, c.message, c.is_system, c.author_role, c.created_at,
              COALESCE(NULLIF(u.name, ''), u.email) AS author_name
       FROM ticket_comments c
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = $1
       ORDER BY c.created_at ASC, c.id ASC`,
      [ticketId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('Fetch Comments Error:', error);
    res.status(500).json({ success: false, message: 'Could not load the conversation.' });
  }
};

export const addComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!ticketId) return res.status(400).json({ success: false, message: 'Invalid ticket id.' });
    if (!message || message.length > 2000) {
      return res.status(400).json({ success: false, message: 'Write a message of up to 2000 characters.' });
    }

    const ticket = await fetchAccessibleTicket(ticketId, req.user);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const isAdmin = req.user?.role === 'ADMIN';
    const inserted = await pool.query(
      `INSERT INTO ticket_comments (ticket_id, author_id, author_role, message, is_system)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING id`,
      [ticketId, req.user?.id, req.user?.role, message]
    );
    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);

    // The first support reply on an open ticket moves it to "In progress" automatically.
    if (isAdmin && ticket.status === 'OPEN') {
      await pool.query(`UPDATE tickets SET status = 'IN_PROGRESS'::ticket_status WHERE id = $1`, [ticketId]);
      await addSystemNote(ticketId, 'Status changed from Open to In progress after the first support reply.', req.user);
    }

    if (isAdmin && ticket.owner_email) {
      sendTicketReplyEmail({ to: ticket.owner_email, title: ticket.title, ticketId, message }).catch((emailError: any) => {
        console.error(`Ticket ${ticketId} reply email failed:`, emailError?.message || emailError);
      });
    }

    const comment = await pool.query(
      `SELECT c.id, c.ticket_id, c.message, c.is_system, c.author_role, c.created_at,
              COALESCE(NULLIF(u.name, ''), u.email) AS author_name
       FROM ticket_comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = $1`,
      [inserted.rows[0].id]
    );
    res.status(201).json({ success: true, data: comment.rows[0] });
  } catch (error: any) {
    console.error('Add Comment Error:', error);
    res.status(500).json({ success: false, message: 'Could not send your message.' });
  }
};

// Customer satisfaction rating once a ticket is closed
export const rateTicket = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticketId = parseTicketId(req.params.id);
    const rating = Number(req.body.rating);
    const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim().slice(0, 1000) : '';
    if (!ticketId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Choose a rating from 1 to 5 stars.' });
    }

    const result = await pool.query(
      `UPDATE tickets
       SET rating = $1, feedback = NULLIF($2, ''), rated_at = NOW()
       WHERE id = $3 AND created_by = $4 AND status IN ('RESOLVED', 'REJECTED') AND rating IS NULL
       RETURNING id`,
      [rating, feedback, ticketId, req.user?.id]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You can rate only your own closed tickets, once.' });
    }
    await addSystemNote(ticketId, `Customer rated this ticket ${rating}/5.`, req.user);
    res.json({ success: true, data: await fetchTicket(ticketId) });
  } catch (error: any) {
    console.error('Rate Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Could not save your rating.' });
  }
};
