import { supabaseAdmin } from './supabaseAdmin';
import type { Role, RubricCriterion } from './types';

export async function getRubric(role: Role): Promise<RubricCriterion[]> {
  const { data, error } = await supabaseAdmin()
    .from('rubric_criteria')
    .select('*')
    .eq('role', role)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      `No rubric criteria found for role ${role}. Run "npm run seed:rubric" first.`
    );
  }
  return data as unknown as RubricCriterion[];
}

export async function getJdText(role: Role): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('role_context')
    .select('jd_text')
    .eq('role', role)
    .maybeSingle();

  if (error) throw error;
  return (data as { jd_text: string } | null)?.jd_text ?? null;
}
