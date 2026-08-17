/**
 * TrainingModuleRegistry
 *
 * Maps module slug → React component at build time.
 *
 * Open-source (OSS) builds only include the stub test module defined here.
 * Proprietary builds register additional paid module components by importing
 * `trainingModuleRegistry.proprietary.ts` (gitignored) instead of this file,
 * or by calling `registerModule()` from private package init code.
 *
 * Module components receive:
 *   - `manifest`     — full DrillManifest fetched from the config API
 *   - `hostContext`  — TrainingHostContextValue giving access to host APIs
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../styles/styles';
import type { DrillManifest } from './trainingConfigService';
import type { TrainingHostContextValue } from './trainingHostContext';
import { PuttingAssessmentModule } from '../modules/training/PuttingAssessmentModule';

export interface TrainingModuleProps {
  manifest: DrillManifest;
  hostContext: TrainingHostContextValue;
  moduleSlug: string;
  onComplete: () => void;
}

export type TrainingModuleComponent = React.ComponentType<TrainingModuleProps>;

const registry = new Map<string, TrainingModuleComponent>();

/** Register a module component for a given slug/component_key. */
export function registerModule(key: string, component: TrainingModuleComponent): void {
  registry.set(key, component);
}

/** Resolve a component by key; returns undefined when not registered. */
export function resolveModule(key: string): TrainingModuleComponent | undefined {
  return registry.get(key);
}

// ── Stub / test module ────────────────────────────────────────────────────────
// Validates the purchase and config pipeline without shipping real content.

const testDrillStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textLight, marginBottom: 12 },
  desc: { fontSize: 15, color: COLORS.textMuted, marginBottom: 24 },
  steps: { marginBottom: 32 },
  step: { fontSize: 14, color: COLORS.textLight, marginBottom: 8 },
  btn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  btnLabel: { fontWeight: '700', fontSize: 16, color: COLORS.textPrimary },
});

function TestDrillModule({ manifest, onComplete, hostContext }: TrainingModuleProps) {
  const startSession = (screen: string, shotName: string) => {
    const shot = hostContext.shotProfiles.find((p) => p.name === '7 Iron');
    if (!shot) return;
    hostContext.navigation.navigate('Record', {user: hostContext.user, id: shot.id, shotName: shot.name, targetDistance: shot.distance, targetRadius: shot.targetRadius, missRadius: shot.missRadius, calledFrom: 'DrillRunner'});
  }
  return (
    <View style={testDrillStyles.container}>
      <Text style={testDrillStyles.title}>{manifest.title}</Text>
      <Text style={testDrillStyles.desc}>{manifest.description}</Text>
      <View style={testDrillStyles.steps}>
        {manifest.steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <Text style={testDrillStyles.step}>{i + 1}. {step.instruction}</Text>
            { step.screen != null ?
              (<TouchableOpacity style={testDrillStyles.btn} onPress={() => startSession(step.screen, step.club)}>
                <Text style={testDrillStyles.btnLabel}>Start Session</Text>
              </TouchableOpacity>)
            : null
          }
          </React.Fragment>
        ))}
      </View>
      <TouchableOpacity style={testDrillStyles.btn} onPress={onComplete}>
        <Text style={testDrillStyles.btnLabel}>Complete</Text>
      </TouchableOpacity>
    </View>
  );
}

registerModule('test-drill', TestDrillModule);
registerModule('putting-assessment', PuttingAssessmentModule);
