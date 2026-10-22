import {validStudy, type SavedStudy} from './library';
import {measureTimeline} from '../audio/tempo';

export const LAST_PRACTICE_KEY = 'sight-reading-last-practice-v1';
export interface LastPractice {version: 1; study: SavedStudy; position: number}
export interface LastPracticeReadResult {last: LastPractice | null; unreadable: boolean}

/** Restore only fully validated score snapshots. Never resume audio automatically. */
export function readLastPracticeResult(raw: string | null): LastPracticeReadResult {
  try {
    if (!raw) return {last:null,unreadable:false};
    if (raw.length > 2_000_000) return {last:null,unreadable:true};
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !validStudy(data.study, true) ||
      typeof data.position !== 'number' || !Number.isFinite(data.position)) return {last:null,unreadable:true};
    const timeline = measureTimeline(data.study.exercise!, data.study.bpm);
    const end = timeline.at(-1)!;
    return {last:{version: 1, study: data.study, position: Math.max(0, Math.min(data.position, end.start + end.duration))},unreadable:false};
  } catch { return {last:null,unreadable:true}; }
}

export function readLastPractice(raw: string | null): LastPractice | null { return readLastPracticeResult(raw).last; }

export function resumeBar(last: LastPractice): number {
  const timeline = measureTimeline(last.study.exercise!, last.study.bpm);
  return Math.max(0, timeline.findLastIndex(bar => bar.start <= last.position + 1e-7)) + 1;
}

export function createResumeStore(storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  function readResult() {
    try { return {...readLastPracticeResult(storage()?.getItem(LAST_PRACTICE_KEY) ?? null),storageUnavailable:false}; }
    catch { return {last:null,unreadable:false,storageUnavailable:true}; }
  }
  return {
    read() { return readResult().last; },
    readResult,
    write(snapshot: LastPractice) {
      try {
        const raw = JSON.stringify(snapshot);
        if (!readLastPractice(raw)) return false;
        const target = storage();
        if (!target) return false;
        if (readLastPracticeResult(target.getItem(LAST_PRACTICE_KEY)).unreadable) return false;
        target.setItem(LAST_PRACTICE_KEY, raw);
        return true;
      } catch { return false; }
    },
  };
}
