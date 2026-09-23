import * as Tone from 'tone';
import type {TuningAudio} from './tuningFork';

export const toneTuningAudio: TuningAudio = {
  unlock: () => Tone.start(),
  createVoice: () => {
    const synth = new Tone.Synth({
      oscillator: {type: 'sine'},
      envelope: {attack: 0.025, decay: 0, sustain: 1, release: 0.05},
    }).toDestination();
    synth.volume.value = -24;
    let stopped = false;
    return {
      start: frequency => { synth.triggerAttack(frequency, Tone.immediate()); },
      setFrequency: frequency => { synth.frequency.rampTo(frequency, 0.025, Tone.immediate()); },
      stop: () => {
        if (stopped) return;
        stopped = true;
        synth.triggerRelease(Tone.immediate());
        // Use wall time so cleanup still runs when the score transport is stopped.
        setTimeout(() => synth.dispose(), 100);
      },
    };
  },
};
