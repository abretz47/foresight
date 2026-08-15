/**
 * TrainingCatalogService
 *
 * Fetches the list of published training modules from the `training_modules`
 * Supabase table.  This data is publicly readable (no entitlement required)
 * and is used by TrainingHome and PurchasePage.
 */
import { supabase } from './supabase';

export interface TrainingModuleMeta {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  stripe_price_id: string | null;
  component_key: string;
  sort_order: number;
}

/**
 * Returns all published training modules ordered by sort_order.
 * Throws on network/DB error.
 */
export async function fetchPublishedModules(): Promise<TrainingModuleMeta[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
  const { data, error } = await supabase
    .from('training_modules')
    .select('id, slug, title, description, thumbnail_url, stripe_price_id, component_key, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrainingModuleMeta[];
}
