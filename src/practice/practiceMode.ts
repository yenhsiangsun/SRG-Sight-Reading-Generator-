import {ASSESSMENT_MODE_ENABLED} from '../featureFlags';

export type PracticeMode = 'practice' | 'test';

/** Apply the bundled policy to every mode request, including stale UI state. */
export function availablePracticeMode(requested: unknown): PracticeMode {
  return ASSESSMENT_MODE_ENABLED && requested === 'test' ? 'test' : 'practice';
}
