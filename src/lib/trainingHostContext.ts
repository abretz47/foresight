/**
 * TrainingHostContext
 *
 * React context that exposes host app APIs to training module components
 * (private packages).  Keeps the module component contract stable so that
 * private packages can be updated independently of the host.
 *
 * The context is provided by DrillRunner and consumed by module components
 * via `useTrainingHostContext()`.
 */
import React, { createContext, useContext } from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

export interface TrainingHostContextValue {
  /** The React Navigation stack prop for navigating out of a drill. */
  navigation: StackNavigationProp<RootStackParamList>;
  /** The username of the current user. */
  user: string;
}

const TrainingHostContext = createContext<TrainingHostContextValue | null>(null);

export const TrainingHostContextProvider = TrainingHostContext.Provider;

/** Returns the host context; throws if called outside of a DrillRunner. */
export function useTrainingHostContext(): TrainingHostContextValue {
  const ctx = useContext(TrainingHostContext);
  if (!ctx) {
    throw new Error('useTrainingHostContext must be used inside a DrillRunner screen.');
  }
  return ctx;
}
