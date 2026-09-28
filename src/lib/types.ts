export type Role = 'PM' | 'SPM';

export type CandidateStatus =
  | 'uploaded'
  | 'scoring'
  | 'scored'
  | 'briefing'
  | 'drafting'
  | 'ready_for_review'
  | 'sent';

export interface Candidate {
  id: string;
  role_applied: Role;
  full_name: string;
  email: string;
  phone: string | null;
  cv_filename: string;
  cv_text: string;
  status: CandidateStatus;
  shortlisted: boolean;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: string;
  role: Role;
  sort_order: number;
  name: string;
  weight: number;
  description: string;
  anchor_5: string;
  anchor_3: string;
  anchor_1: string;
}

export interface CandidateScore {
  id: string;
  candidate_id: string;
  rubric_role: Role;
  criterion_name: string;
  weight: number;
  score: number;
  reason: string;
  weighted_points: number;
}

export interface Brief {
  candidate_id: string;
  brief_text: string;
}

export type EmailType = 'invite' | 'reject';

export interface EmailDraft {
  id: string;
  candidate_id: string;
  email_type: EmailType;
  subject: string;
  body: string;
  edited: boolean;
  sent_at: string | null;
  resend_message_id: string | null;
}

export interface CandidateTotal {
  candidate_id: string;
  rubric_role: Role;
  total_score: number;
}
