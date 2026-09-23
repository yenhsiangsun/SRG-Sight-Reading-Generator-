export const tuningFrequency = {min: 400, max: 480, step: 0.1, default: 440} as const;
const storageKey = 'sight-reading-tuning-fork-v1';

export function normalizeTuningFrequency(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return tuningFrequency.default;
  return Math.round(Math.min(tuningFrequency.max, Math.max(tuningFrequency.min, value)) * 10) / 10;
}

export function loadTuningFrequency(storage: () => Pick<Storage, 'getItem'> = () => localStorage): number {
  try {
    const value: unknown = JSON.parse(storage().getItem(storageKey) ?? 'null');
    return normalizeTuningFrequency(value && typeof value === 'object' && 'frequency' in value ? value.frequency : undefined);
  } catch { return tuningFrequency.default; }
}

export function saveTuningFrequency(frequency: number, storage: () => Pick<Storage, 'setItem'> = () => localStorage): boolean {
  try { storage().setItem(storageKey, JSON.stringify({frequency: normalizeTuningFrequency(frequency)})); return true; }
  catch { return false; }
}

export type TuningStatus = 'idle' | 'starting' | 'playing' | 'error';
export interface TuningVoice {
  start(frequency: number): void;
  setFrequency(frequency: number): void;
  /** Release gently, then dispose this voice without affecting other audio. */
  stop(): void;
}
export interface TuningAudio {
  unlock(): Promise<unknown>;
  createVoice(): TuningVoice;
}

/** Reference tone independent of the score transport, tempo, instrument and transposition. */
export class TuningForkController {
  private audio: TuningAudio;
  private notify: (status: TuningStatus) => void;
  private voice: TuningVoice | null = null;
  private frequency: number;
  private generation = 0;
  private disposed = false;
  private status: TuningStatus = 'idle';

  constructor(audio: TuningAudio, onChange: (status: TuningStatus) => void, frequency = 440) {
    this.audio = audio;
    this.notify = onChange;
    this.frequency = normalizeTuningFrequency(frequency);
  }

  private update(status: TuningStatus) {
    this.status = status;
    if (!this.disposed) this.notify(status);
  }

  setFrequency(value: number) {
    this.frequency = normalizeTuningFrequency(value);
    this.voice?.setFrequency(this.frequency);
  }

  async start() {
    if (this.disposed || this.status === 'starting' || this.status === 'playing') return;
    const generation = ++this.generation;
    this.update('starting');
    try {
      await this.audio.unlock();
      if (this.disposed || generation !== this.generation) return;
      this.voice = this.audio.createVoice();
      this.voice.start(this.frequency);
      this.update('playing');
    } catch {
      if (this.disposed || generation !== this.generation) return;
      this.voice?.stop();
      this.voice = null;
      this.update('error');
    }
  }

  stop() {
    this.generation++;
    this.voice?.stop();
    this.voice = null;
    this.update('idle');
  }

  dispose() {
    this.disposed = true;
    this.stop();
  }
}
