import {validStudy, type SavedStudy} from './library';
import {measureTimeline} from '../audio/tempo';

export const LAST_PRACTICE_KEY = 'sight-reading-last-practice-v1';
export interface LastPractice {version: 1; study: SavedStudy; position: number}

/** Restore only fully validated score snapshots. Never resume audio automatically. */
export function readLastPractice(raw: string | null): LastPractice | null {
  try {
    if (!raw || raw.length > 2_000_000) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !validStudy(data.study, true) ||
      typeof data.position !== 'number' || !Number.isFinite(data.position)) return null;
    const timeline = measureTimeline(data.study.exercise!, data.study.bpm);
    const end = timeline.at(-1)!;
    return {version: 1, study: data.study, position: Math.max(0, Math.min(data.position, end.start + end.duration))};
  } catch { return null; }
}

export function resumeBar(last: LastPractice): number {
  const timeline = measureTimeline(last.study.exercise!, last.study.bpm);
  return Math.max(0, timeline.findLastIndex(bar => bar.start <= last.position + 1e-7)) + 1;
}

export function createResumeStore(storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  return {
    read() { try { return readLastPractice(storage()?.getItem(LAST_PRACTICE_KEY) ?? null); } catch { return null; } },
    write(snapshot: LastPractice) {
      try {
        const raw = JSON.stringify(snapshot);
        if (!readLastPractice(raw)) return false;
        const target = storage();
        if (!target) return false;
        target.setItem(LAST_PRACTICE_KEY, raw);
        return true;
      } catch { return false; }
    },
  };
}
