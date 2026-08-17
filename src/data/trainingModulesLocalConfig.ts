import type { DrillManifest } from '../lib/trainingConfigService';

export interface LocalTrainingModuleConfig {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  stripe_price_id: string | null;
  component_key: string;
  sort_order: number;
  is_published: boolean;
  manifest: DrillManifest;
}

export const LOCAL_TRAINING_MODULES: LocalTrainingModuleConfig[] = [
  {
    id: 'local-test-drill',
    slug: 'test-drill',
    title: 'Borbulator Warmup',
    description: 'Nonsensical local-only config to validate module plumbing.',
    thumbnail_url: null,
    stripe_price_id: null,
    component_key: 'test-drill',
    sort_order: 1,
    is_published: true,
    manifest: {
      title: 'Borbulator Warmup',
      description: 'Nonsensical local-only config for plumbing checks.',
      version: 1,
      estimatedDurationMinutes: 4,
      steps: [
        { id: 'step-1', instruction: 'Ping the lunar putter.', completionCriteria: 'manual' },
        { id: 'step-2', instruction: 'Confirm anti-gravity tempo.', completionCriteria: 'manual' },
      ],
      parameters: {},
      assets: {},
    },
  },
  {
    id: 'local-putting-assessment',
    slug: 'putting-assessment',
    title: 'Quantum Putting Assessment',
    description: 'Local test profile for putting assessment UX only.',
    thumbnail_url: null,
    stripe_price_id: null,
    component_key: 'putting-assessment',
    sort_order: 2,
    is_published: true,
    manifest: {
      title: 'Quantum Putting Assessment',
      description: 'Rate your putting confidence and setup habits.',
      version: 1,
      estimatedDurationMinutes: 6,
      steps: [],
      parameters: {
        assessmentQuestions: [
          {
            id: 'distance-control',
            prompt: 'How confident are you from 15 feet?',
            options: ['Low', 'Medium', 'High'],
          },
          {
            id: 'pre-shot',
            prompt: 'How consistent is your pre-shot routine?',
            options: ['Rarely', 'Sometimes', 'Always'],
          },
        ],
      },
      assets: {},
    },
  },
];

export function getLocalPublishedTrainingModules(): LocalTrainingModuleConfig[] {
  return LOCAL_TRAINING_MODULES.filter((module) => module.is_published)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getLocalTrainingModuleConfig(slug: string): LocalTrainingModuleConfig | null {
  return LOCAL_TRAINING_MODULES.find((module) => module.slug === slug) ?? null;
}
