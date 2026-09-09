import { measureTimeline } from './tempo';
import type { ExerciseData } from '../music';

export type PlaybackStatus = 'idle' | 'starting' | 'playing' | 'paused';
export type PlaybackMode = 'score' | 'metronome';
interface Synth {
  triggerAttackRelease(note: string, duration: number, time: number): unknown;
  releaseAll(): unknown;
  dispose(): unknown;
}
export interface AudioAdapter {
  unlock(): Promise<unknown>;
  createSynth(exercise: ExerciseData): Synth | Promise<Synth>;
  createClickSynth?(): Synth;
  schedule(callback: (time: number) => void, seconds: number): number;
  scheduleEnd(callback: () => void, seconds: number): number;
  clear(id: number): void;
  start(): void;
  pause(): void;
  stop(): void;
  setTempo(bpm: number): void;
  setLoop?(duration: number | null): void;
}

export function createPlaybackEvents(exercise: ExerciseData, bpm: number) {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('請選擇有效的速度。');
  const events: Array<{ note: string; duration: number; time: number }> = [];
  let duration = 0;
  for (const measures of [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])]) {
    for (const bar of measureTimeline(exercise,bpm,measures)) {
      const {measure,secondsPerUnit}=bar;
      let units=0;
      for (const note of measure.events) {
        const length = note.durationUnits * secondsPerUnit;
        if (!note.rest) {
          let pitch = note.key.replace('/', '');
          if (exercise.transposition) {
            const match = note.key.match(/^([a-g])([#b]*)\/(-?\d+)$/i);
            if (!match) throw new Error('無法換算播放音高。');
            const natural = {c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!;
            const alteration = [...match[2]].reduce((sum,sign)=>sum+(sign==='#'?1:-1),0);
            const midi = (Number(match[3])+1)*12+natural+alteration+exercise.transposition;
            pitch = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((midi%12)+12)%12]+(Math.floor(midi/12)-1);
          }
          events.push({note:pitch,duration:length,time:bar.start+units*secondsPerUnit});
        }
        units += note.durationUnits;
      }
      duration = Math.max(duration,bar.start+bar.duration);
    }
  }
  events.sort((a,b)=>a.time-b.time);
  return {events,duration};
}

export function createMetronomeEvents(exercise: ExerciseData, bpm: number) {
  const events: Array<{ time: number; accent: boolean }> = [];
  for (const bar of measureTimeline(exercise,bpm)) {
    const total=bar.measure.totalUnits??bar.measure.events.reduce((sum,n)=>sum+n.durationUnits,0);
    for(let offset=0;offset<total;offset+=bar.unit) {
      events.push({time:bar.start+offset*bar.secondsPerUnit,accent:offset===0});
    }
  }
  return events;
}

/** One audio-clock session, shared by score and metronome. */
export class PlaybackController {
  private status: PlaybackStatus = 'idle';
  private mode: PlaybackMode = 'score';
  private synth: Synth | null = null;
  private clickSynth: Synth | null = null;
  private events: number[] = [];
  private generation = 0;
  private disposed = false;
  private metronome = false;
  private audio: AudioAdapter;
  private onChange: (status: PlaybackStatus, error?: string, mode?: PlaybackMode) => void;

  constructor(audio: AudioAdapter, onChange: (status: PlaybackStatus, error?: string, mode?: PlaybackMode) => void) {
    this.audio = audio;
    this.onChange = onChange;
  }

  private update(status: PlaybackStatus, error?: string) {
    this.status = status;
    if (!this.disposed) this.onChange(status, error, this.mode);
  }

  setMetronome(enabled: boolean) {
    this.metronome = enabled;
    if (!enabled && this.mode === 'metronome') this.stop();
  }

  stop() {
    this.generation++;
    this.audio.stop();
    this.audio.setLoop?.(null);
    for (const id of this.events) this.audio.clear(id);
    this.events = [];
    this.synth?.dispose();
    this.clickSynth?.dispose();
    this.synth = null;
    this.clickSynth = null;
    this.update('idle');
  }

  async play(exercise: ExerciseData, bpm: number, metronomeOnly = false) {
    if (this.disposed || this.status === 'starting') return;
    if (this.mode === 'metronome' && !metronomeOnly && this.status !== 'idle') this.stop();
    if (this.status === 'playing') return;
    const resume = this.status === 'paused';
    const generation = this.generation;
    this.mode = metronomeOnly ? 'metronome' : 'score';
    this.update('starting');
    try {
      await this.audio.unlock();
      if (this.disposed || generation !== this.generation) return;
      if (resume) {
        this.audio.start();
        this.update('playing');
        return;
      }
      const timeline = createPlaybackEvents(exercise, bpm);
      this.audio.stop();
      this.audio.setTempo(bpm);
      this.audio.setLoop?.(metronomeOnly ? timeline.duration : null);
      if (!metronomeOnly) {
        const created = this.audio.createSynth(exercise);
        const synth = 'then' in created ? await created : created;
        if (this.disposed || generation !== this.generation) { synth.dispose(); return; }
        this.synth = synth;
        for (const event of timeline.events) {
          this.events.push(this.audio.schedule((time) => {
            if (generation === this.generation && !this.disposed) {
              this.synth?.triggerAttackRelease(event.note, event.duration, time);
            }
          }, event.time));
        }
      }
      if (this.audio.createClickSynth) {
        this.clickSynth = this.audio.createClickSynth();
        for (const beat of createMetronomeEvents(exercise, bpm)) {
          this.events.push(this.audio.schedule(time => {
            if (this.metronome && generation === this.generation && !this.disposed) {
              this.clickSynth?.triggerAttackRelease(beat.accent ? 'C6' : 'G5', 0.025, time);
            }
          }, beat.time));
        }
      }
      if (!metronomeOnly) this.events.push(this.audio.scheduleEnd(() => {
        if (generation === this.generation && !this.disposed) this.stop();
      }, timeline.duration + 0.3));
      this.audio.start();
      this.update('playing');
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      this.stop();
      this.update('idle', error instanceof Error ? error.message : '播放未能啟動，請再試一次。');
    }
  }

  pause() {
    if (this.status !== 'playing') return;
    this.audio.pause();
    this.synth?.releaseAll();
    this.clickSynth?.releaseAll();
    this.update('paused');
  }

  async replay(exercise: ExerciseData, bpm: number) {
    this.stop();
    await this.play(exercise, bpm);
  }

  dispose() {
    this.disposed = true;
    this.stop();
  }
}
