import { supabase } from './supabase';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function getAuthUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface TrainingModuleAssessmentRecord {
  id: string;
  module_slug: string;
  assessment_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function saveTrainingModuleAssessment(
  moduleSlug: string,
  assessmentType: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const userId = await getAuthUserId();
  if (!userId) {
    throw new Error('No active session. Please sign in.');
  }
  const { error } = await supabase.from('training_module_assessments').insert({
    id: generateId(),
    user_id: userId,
    module_slug: moduleSlug,
    assessment_type: assessmentType,
    payload,
  });
  if (error) throw error;
}

export async function fetchLatestTrainingModuleAssessment(
  moduleSlug: string,
  assessmentType: string
): Promise<TrainingModuleAssessmentRecord | null> {
  if (!supabase) return null;
  const userId = await getAuthUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('training_module_assessments')
    .select('id, module_slug, assessment_type, payload, created_at')
    .eq('user_id', userId)
    .eq('module_slug', moduleSlug)
    .eq('assessment_type', assessmentType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id as string,
    module_slug: row.module_slug as string,
    assessment_type: row.assessment_type as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
  };
}
