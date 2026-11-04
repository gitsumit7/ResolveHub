export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Role = 'USER' | 'ADMIN';

export interface User {
  id: number;
  name?: string;
  email: string;
  role: Role;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at?: string | null;
  created_by?: number | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  resolved_at?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  comment_count?: number;
  rating?: number | null;
  feedback?: string | null;
  rated_at?: string | null;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  message: string;
  is_system: boolean;
  author_role: Role | 'SYSTEM';
  author_name: string | null;
  created_at: string;
}

export interface ComplaintPeriod {
  period: string;
  user_name: string;
  complaint_count: number;
}

export interface Metrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  critical: number;
  criticalOpen: number;
  overdue: number;
  slaHours: number;
  slaBreachRate: number;
  avgResolutionHours: number | null;
  avgRating: number | null;
  ratedCount: number;
  last7Days: number;
  byCategory: { label: string; count: number }[];
  trend: { day: string; count: number }[];
  monthly: ComplaintPeriod[];
  yearly: ComplaintPeriod[];
}
