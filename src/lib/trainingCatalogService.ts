/**
 * TrainingCatalogService
 *
 * Fetches the list of published training modules from the `training_modules`
 * Supabase table.  This data is publicly readable (no entitlement required)
 * and is used by TrainingHome and PurchasePage.
 */
import { supabase } from './supabase';
import { getLocalPublishedTrainingModules } from '../data/trainingModulesLocalConfig';

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
    return getLocalPublishedTrainingModules().map((module) => ({
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description,
      thumbnail_url: module.thumbnail_url,
      stripe_price_id: module.stripe_price_id,
      component_key: module.component_key,
      sort_order: module.sort_order,
    }));
  }
  const { data, error } = await supabase
    .from('training_modules')
    .select('id, slug, title, description, thumbnail_url, stripe_price_id, component_key, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrainingModuleMeta[];
}
