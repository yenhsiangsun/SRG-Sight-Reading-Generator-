import { measureTimeline } from './tempo';
import {loopWindow, loopPosition} from '../practice/loop';
import type { ExerciseData } from '../music';
import {dynamicVelocity, noteExpression} from '../music/performanceMarks';
import {notePitches} from '../music/notePitches';
import {addRhythmUnits} from '../music/rhythmTiming';
import {metricPosition} from '../music/meterFeel';

export type PlaybackStatus = 'idle' | 'starting' | 'playing' | 'paused';
export type PlaybackMode = 'score' | 'metronome';
interface Synth {
  triggerAttackRelease(note: string, duration: number, time: number, velocity?:number): unknown;
  releaseAll(): unknown;
  dispose(): unknown;
}
function triggerNote(synth:Synth|null, note:string, duration:number, time:number, velocity?:number) {
  if(velocity===undefined)synth?.triggerAttackRelease(note,duration,time);
  else synth?.triggerAttackRelease(note,duration,time,velocity);
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
  /** Elapsed transport seconds at the audible audio clock, without lookahead. */
  getSeconds?(): number;
}

export function createPlaybackEvents(exercise: ExerciseData, bpm: number) {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('請選擇有效的速度。');
  const events: Array<{ note: string; duration: number; time: number; velocity?:number }> = [];
  let duration = 0;
  for (const measures of [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])]) {
    let velocity:number|undefined;
    for (const bar of measureTimeline(exercise,bpm,measures)) {
      const {measure,secondsPerUnit}=bar;
      let units=0;
      for (const note of measure.events) {
        if(note.dynamic)velocity=dynamicVelocity[note.dynamic];
        const length = note.durationUnits * secondsPerUnit;
        if (!note.rest) {
          const pitches = notePitches(note);
          const expression=noteExpression(note,velocity??0.73);
          const expressive=velocity!==undefined || note.articulation!==undefined;
          const metrical=!!(measure.timeSignature ?? exercise.timeSignature);
          const metricGain=metrical ? metricPosition(measure,units,exercise.timeSignature).gain : 1;
          // Keep chord attacks from becoming disproportionately louder than single notes.
          const gain = 1 / Math.sqrt(pitches.length);
          for (const chordPitch of pitches) {
            let pitch = chordPitch.key.replace('/', '');
            if (exercise.transposition) {
              const match = chordPitch.key.match(/^([a-g])([#b]*)\/(-?\d+)$/i);
              if (!match) throw new Error('無法換算播放音高。');
              const natural = {c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!;
              const alteration = [...match[2]].reduce((sum,sign)=>sum+(sign==='#'?1:-1),0);
              const midi = (Number(match[3])+1)*12+natural+alteration+exercise.transposition;
              pitch = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((midi%12)+12)%12]+(Math.floor(midi/12)-1);
            }
            events.push({note:pitch,duration:length*(expressive?expression.lengthRatio:1),time:bar.start+units*secondsPerUnit,
              ...(metrical || expressive || pitches.length > 1 ? {velocity:expression.velocity*gain*metricGain} : {})});
          }
        }
        units = addRhythmUnits(units,note.durationUnits);
      }
      duration = Math.max(duration,bar.start+bar.duration);
    }
  }
  events.sort((a,b)=>a.time-b.time);
  return {events,duration};
}

export function createMetronomeEvents(exercise: ExerciseData, bpm: number) {
  const events: Array<{ time: number; accent: boolean; velocity:number }> = [];
  for (const bar of measureTimeline(exercise,bpm)) {
    const total=bar.measure.totalUnits??bar.measure.events.reduce((sum,n)=>sum+n.durationUnits,0);
    for(let offset=0;offset<total;offset+=bar.unit) {
      const position=metricPosition(bar.measure,offset,bar.meter);
      events.push({time:bar.start+offset*bar.secondsPerUnit,accent:offset===0,
        velocity:position.downbeat ? .9 : position.onPulse ? .72 : .4});
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
  private position = 0;
  private startOffset = 0;
  private duration = 0;
  private exercise: ExerciseData | null = null;
  private bpm = 0;
  private repeat: ReturnType<typeof loopWindow> | null = null;
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
    if (!enabled && this.mode === 'metronome') this.reset(this.position);
  }

  /** Read on animation frames; visual progress never depends on React timers. */
  getPosition() {
    if (this.mode !== 'score' || this.status !== 'playing') return this.position;
    const elapsed = this.audio.getSeconds?.() ?? 0;
    if (this.repeat) return loopPosition(this.repeat, elapsed);
    return Math.min(this.duration, this.startOffset + Math.max(0, elapsed));
  }

  private reset(position = 0) {
    this.repeat = null;
    this.generation++;
    this.audio.stop();
    this.audio.setLoop?.(null);
    for (const id of this.events) this.audio.clear(id);
    this.events = [];
    this.synth?.dispose();
    this.clickSynth?.dispose();
    this.synth = null;
    this.clickSynth = null;
    this.position = position;
    this.startOffset = position;
    this.update('idle');
  }

  stop() {
    this.reset();
  }

  async play(exercise: ExerciseData, bpm: number, metronomeOnly = false) {
    if (this.disposed || this.status === 'starting') return;
    const mode = metronomeOnly ? 'metronome' : 'score';
    if (this.mode !== mode && this.status !== 'idle') {
      // Standalone clicks have their own origin; keep the user's score bookmark.
      if (this.mode === 'metronome') this.reset(this.position);
      else this.stop();
    }
    if (this.status === 'paused' && (this.exercise !== exercise || this.bpm !== bpm)) this.stop();
    if (this.status === 'playing') return;
    const resume = this.status === 'paused' && this.events.length > 0;
    const generation = this.generation;
    this.mode = mode;
    this.update('starting');
    try {
      await this.audio.unlock();
      if (this.disposed || generation !== this.generation) return;
      if (resume) {
        // Pause releases sounding notes. Restore only their remaining lengths,
        // keeping the existing schedule for all later notes and rests intact.
        if (!metronomeOnly && this.audio.getSeconds) {
          for (const event of createPlaybackEvents(exercise, bpm).events) {
            const remaining = Math.min(event.time + event.duration, this.repeat?.end ?? Infinity) - this.position;
            const duringLead = this.repeat && (this.audio.getSeconds() % this.repeat.cycle) < this.repeat.lead;
            if (!duringLead && event.time < this.position && remaining > 1e-7) {
              const id = this.audio.schedule(time => {
                if (generation === this.generation && !this.disposed) {
                  triggerNote(this.synth,event.note,remaining,time,event.velocity);
                }
                this.audio.clear(id);
              }, this.repeat ? this.audio.getSeconds() : this.position - this.startOffset);
              this.events.push(id);
            }
          }
        }
        this.audio.start();
        this.update('playing');
        return;
      }
      const timeline = createPlaybackEvents(exercise, bpm);
      if (this.exercise !== exercise || this.bpm !== bpm || this.position >= timeline.duration) {
        this.position = 0;
      }
      this.exercise = exercise;
      this.bpm = bpm;
      this.duration = timeline.duration;
      this.startOffset = metronomeOnly ? 0 : this.position;
      const offset = this.startOffset;
      this.audio.stop();
      this.audio.setTempo(bpm);
      this.audio.setLoop?.(metronomeOnly ? timeline.duration : null);
      if (!metronomeOnly) {
        const created = this.audio.createSynth(exercise);
        const synth = 'then' in created ? await created : created;
        if (this.disposed || generation !== this.generation) { synth.dispose(); return; }
        this.synth = synth;
        for (const event of timeline.events) {
          const end = event.time + event.duration;
          if (end <= offset + 1e-7) continue;
          const start = Math.max(event.time, offset);
          this.events.push(this.audio.schedule((time) => {
            if (generation === this.generation && !this.disposed) {
              triggerNote(this.synth,event.note,end-start,time,event.velocity);
            }
          }, start - offset));
        }
      }
      if (this.audio.createClickSynth) {
        this.clickSynth = this.audio.createClickSynth();
        for (const beat of createMetronomeEvents(exercise, bpm)) {
          if (beat.time < offset - 1e-7) continue;
          this.events.push(this.audio.schedule(time => {
            if (this.metronome && generation === this.generation && !this.disposed) {
              this.clickSynth?.triggerAttackRelease(beat.accent ? 'C6' : 'G5', 0.025, time, beat.velocity);
            }
          }, Math.max(0, beat.time - offset)));
        }
      }
      if (!metronomeOnly) this.events.push(this.audio.scheduleEnd(() => {
        if (generation === this.generation && !this.disposed) this.reset(timeline.duration);
      }, timeline.duration - offset + 0.3));
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
    this.position = this.getPosition();
    this.audio.pause();
    this.synth?.releaseAll();
    this.clickSynth?.releaseAll();
    this.update('paused');
  }

  isLooping() { return this.repeat !== null; }

  async playLoop(exercise: ExerciseData, bpm: number, first: number, last: number) {
    if (this.disposed) return;
    this.stop();
    const generation = this.generation;
    this.mode = 'score';
    this.update('starting');
    try {
      const window = loopWindow(exercise, bpm, first, last);
      await this.audio.unlock();
      if (generation !== this.generation || this.disposed) return;
      const synth = await this.audio.createSynth(exercise);
      if (generation !== this.generation || this.disposed) { synth.dispose(); return; }
      this.synth = synth;
      this.exercise = exercise; this.bpm = bpm;
      this.repeat = window; this.position = window.start;
      this.duration = createPlaybackEvents(exercise, bpm).duration;
      this.audio.setTempo(bpm); this.audio.setLoop?.(window.cycle);
      const guarded = (callback: (time: number) => void) => (time: number) => {
        if (generation === this.generation && !this.disposed) callback(time);
      };
      for (const event of createPlaybackEvents(exercise, bpm).events) {
        const start = Math.max(window.start, event.time), end = Math.min(window.end, event.time + event.duration);
        if (end <= start) continue;
        this.events.push(this.audio.schedule(guarded(time => triggerNote(synth,event.note,end-start,time,event.velocity)), window.lead + start - window.start));
      }
      if (this.audio.createClickSynth) {
        this.clickSynth = this.audio.createClickSynth();
        for (let beat = 0; beat < 4; beat++) this.events.push(this.audio.schedule(guarded(time => {
          this.clickSynth?.triggerAttackRelease(beat === 0 ? 'C6' : 'G5', 0.025, time);
        }), beat * window.lead / 4));
        for (const beat of createMetronomeEvents(exercise, bpm)) {
          if (beat.time < window.start || beat.time >= window.end) continue;
          this.events.push(this.audio.schedule(guarded(time => {
            if (this.metronome) this.clickSynth?.triggerAttackRelease(beat.accent ? 'C6' : 'G5', 0.025, time, beat.velocity);
          }), window.lead + beat.time - window.start));
        }
      }
      this.audio.start(); this.update('playing');
    } catch (error) {
      if (generation !== this.generation || this.disposed) return;
      this.stop(); this.update('idle', error instanceof Error ? error.message : 'Playback failed');
    }
  }

  /** Commit a score seek. Idle/paused scrubbing never starts audio by itself. */
  async seek(exercise: ExerciseData, bpm: number, seconds: number) {
    if (this.disposed) return;
    const timeline = createPlaybackEvents(exercise, bpm);
    const position = Math.min(timeline.duration, Math.max(0, Number.isFinite(seconds) ? seconds : 0));
    const wasPlaying = (this.status === 'playing' || this.status === 'starting') && this.mode === 'score';
    const wasPaused = this.status === 'paused' && this.mode === 'score';
    // Clearing IDs alone cannot cancel voices already queued by audio lookahead.
    // Disposing this session also makes late sample loads and end callbacks inert.
    this.reset(position);
    this.mode = 'score';
    this.exercise = exercise;
    this.bpm = bpm;
    this.duration = timeline.duration;
    if (wasPlaying && position < timeline.duration) await this.play(exercise, bpm);
    else this.update(wasPaused ? 'paused' : 'idle');
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
