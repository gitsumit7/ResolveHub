import nodemailer from 'nodemailer';
import { APP_NAME, FRONTEND_URL } from './config.js';

const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const smtpPort = Number(process.env.SMTP_PORT || 465);

export const mailTransporter = smtpUser && smtpPass && !smtpUser.startsWith('your_') && !smtpPass.startsWith('your_')
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    })
  : null;

export const isEmailConfigured = () => Boolean(mailTransporter && smtpUser);

// Ticket titles and replies come from users, so never put them into HTML unescaped.
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

const wrapHtml = (heading: string, innerHtml: string) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto">
    <div style="padding:16px 0;border-bottom:2px solid #14b8a6;margin-bottom:16px">
      <strong style="font-size:18px;color:#0f172a">${escapeHtml(APP_NAME)}</strong>
    </div>
    <h2 style="color:#0f172a;margin:0 0 12px">${escapeHtml(heading)}</h2>
    ${innerHtml}
    <p style="margin-top:24px">Regards,<br><strong>${escapeHtml(APP_NAME)} Support Team</strong></p>
  </div>`;

const send = async (to: string, subject: string, text: string, html: string) => {
  if (!mailTransporter || !smtpUser) {
    throw new Error('SMTP is not configured with a real SMTP_USER and SMTP_PASS.');
  }
  await mailTransporter.sendMail({ from: process.env.SMTP_FROM || smtpUser, to, subject, text, html });
};

export const sendTicketStatusEmail = async ({
  to,
  title,
  ticketId,
  status
}: {
  to: string;
  title: string;
  ticketId: number;
  status: 'RESOLVED' | 'REJECTED';
}) => {
  const resolved = status === 'RESOLVED';
  const subject = resolved ? 'Your Support Query Has Been Resolved' : 'Update Regarding Your Support Query';
  const message = resolved
    ? 'We are pleased to inform you that our support team has resolved your query.'
    : 'After review, our support team found that the submitted complaint does not meet the criteria for a genuine support issue.';
  const nextStep = resolved
    ? `You can rate your support experience from your ${APP_NAME} dashboard. If you need any further assistance, please register a new complaint.`
    : 'If you believe this decision was made in error, please contact support with additional details.';

  await send(
    to,
    subject,
    `Hello,\n\n${message}\n\nComplaint: ${title}\nReference: #${ticketId}\n\n${nextStep}\n\nRegards,\n${APP_NAME} Support Team`,
    wrapHtml(
      subject,
      `<p>Hello,</p><p>${message}</p><p><strong>Complaint:</strong> ${escapeHtml(title)}<br><strong>Reference:</strong> #${ticketId}</p><p>${escapeHtml(nextStep)}</p>`
    )
  );
};

export const sendTicketReplyEmail = async ({
  to,
  title,
  ticketId,
  message
}: {
  to: string;
  title: string;
  ticketId: number;
  message: string;
}) => {
  const subject = `New reply on your ticket #${ticketId}`;
  await send(
    to,
    subject,
    `Hello,\n\nOur support team replied to your ticket "${title}" (#${ticketId}):\n\n${message}\n\nOpen ${FRONTEND_URL} to continue the conversation.\n\nRegards,\n${APP_NAME} Support Team`,
    wrapHtml(
      subject,
      `<p>Hello,</p><p>Our support team replied to your ticket <strong>${escapeHtml(title)}</strong> (#${ticketId}):</p>
       <blockquote style="margin:12px 0;padding:12px 16px;background:#f1f5f9;border-left:4px solid #14b8a6;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
       <p><a href="${FRONTEND_URL}" style="color:#0d9488">Open your dashboard</a> to continue the conversation.</p>`
    )
  );
};

export const sendPasswordResetEmail = async ({ to, resetLink }: { to: string; resetLink: string }) => {
  await send(
    to,
    `${APP_NAME} password reset`,
    `Use this link to reset your password (valid for 1 hour): ${resetLink}`,
    wrapHtml(
      'Password reset request',
      `<p>Click the link below to reset your password. It is valid for 1 hour.</p>
       <p><a href="${resetLink}" style="color:#0d9488">${escapeHtml(resetLink)}</a></p>
       <p style="color:#64748b;font-size:13px">If you did not ask for this, you can ignore this email.</p>`
    )
  );
};
