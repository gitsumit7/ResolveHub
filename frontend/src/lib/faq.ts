export interface FaqEntry {
  question: string;
  answer: string;
  keywords: string[];
}

export const FAQ: FaqEntry[] = [
  {
    question: 'How long does resolution take?',
    answer: 'Most tickets are reviewed within 1–2 business days. Critical issues (outages, security, payments failing for everyone) are picked up first.',
    keywords: ['time', 'long', 'when', 'wait', 'resolution', 'delay']
  },
  {
    question: 'I cannot log in or forgot my password',
    answer: 'Use “Forgot password?” on the sign-in screen to get a reset link by email. The link is valid for 1 hour. Check your spam folder if it does not arrive.',
    keywords: ['login', 'log', 'password', 'sign', 'reset', 'otp', 'account', 'locked']
  },
  {
    question: 'I was charged twice or need a refund',
    answer: 'Raise a ticket under the Billing category and include the transaction ID, date and amount. Attach a screenshot of the bank statement or receipt if you have one.',
    keywords: ['payment', 'charged', 'refund', 'billing', 'invoice', 'money', 'twice', 'transaction']
  },
  {
    question: 'How can I upload logs or screenshots?',
    answer: 'Attach a PNG, JPG, WEBP, PDF or TXT file (up to 5 MB) while submitting your ticket.',
    keywords: ['upload', 'attach', 'screenshot', 'log', 'file', 'image', 'pdf']
  },
  {
    question: 'How do I track my ticket?',
    answer: 'Every ticket appears under “My tickets” with its live status. Open a ticket to see the full timeline and chat with the support team.',
    keywords: ['track', 'status', 'update', 'progress', 'where']
  },
  {
    question: 'What information should I include?',
    answer: 'Describe what you expected, what happened instead, the steps to reproduce it, and any error message you saw. Clear details mean a faster fix.',
    keywords: ['information', 'details', 'include', 'describe', 'error', 'bug']
  },
  {
    question: 'Can I edit or delete a ticket?',
    answer: 'You can edit a ticket within 12 hours and delete it within 24 hours of submitting it. After that, add a reply in the conversation instead.',
    keywords: ['edit', 'change', 'delete', 'remove', 'mistake', 'wrong']
  },
  {
    question: 'The app is crashing or showing an error',
    answer: 'Try refreshing, clearing your browser cache, or using another browser. If it still fails, submit a Technical ticket with the exact error text and a screenshot.',
    keywords: ['crash', 'error', 'bug', 'broken', 'not working', 'fail', 'slow', 'technical']
  }
];

/** Returns help articles that match the words in a draft ticket. */
export const suggestArticles = (text: string, limit = 2) => {
  const words = text.toLowerCase();
  if (words.trim().length < 4) return [];
  return FAQ.map((entry) => ({ entry, score: entry.keywords.filter((k) => words.includes(k)).length }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
};
