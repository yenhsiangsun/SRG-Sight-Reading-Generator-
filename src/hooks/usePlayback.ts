import { createPlaybackInstrument as createInstrumentSynth } from '../audio/createPlaybackInstrument';
import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { ExerciseData } from '../music';
import { PlaybackController, type PlaybackStatus, type PlaybackMode } from '../audio/PlaybackController';

export function usePlayback() {
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [mode, setMode] = useState<PlaybackMode>('score');
  const [metronome, setMetronome] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<PlaybackController | null>(null);

  useEffect(() => {
    const transport = Tone.getTransport();
    const controller = new PlaybackController({
      unlock: () => Tone.start(),
      createSynth: exercise => createInstrumentSynth(exercise.soundProfile ?? exercise.instrument),
      createClickSynth: () => {
        const click = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.015, sustain: 0, release: 0.015 },
        }).toDestination();
        click.volume.value = -12;
        return click;
      },
      schedule: (callback, seconds) => transport.schedule(callback, seconds),
      scheduleEnd: (callback, seconds) => transport.scheduleOnce((time) => {
        Tone.getDraw().schedule(callback, time);
      }, seconds),
      clear: (id) => transport.clear(id),
      start: () => { transport.start(); },
      pause: () => { transport.pause(); },
      stop: () => { transport.stop(); transport.position = 0; },
      setTempo: (bpm) => { transport.bpm.value = bpm; },
      setLoop: (duration) => { transport.loop = duration !== null; if (duration !== null) { transport.loopStart = 0; transport.loopEnd = duration; } },
    }, (nextStatus, message = '', nextMode = 'score') => {
      setStatus(nextStatus);
      setMode(nextMode);
      setError(message);
    });
    controllerRef.current = controller;
    return () => { controller.dispose(); controllerRef.current = null; };
  }, []);

  function toggleMetronome(exercise: ExerciseData, bpm: number) {
    const enabled = !metronome;
    setMetronome(enabled);
    controllerRef.current?.setMetronome(enabled);
    if (enabled && status === 'idle') void controllerRef.current?.play(exercise, bpm, true);
  }

  return {
    status, mode, error, metronome, toggleMetronome,
    play: (exercise: ExerciseData, bpm: number) => controllerRef.current?.play(exercise, bpm),
    replay: (exercise: ExerciseData, bpm: number) => controllerRef.current?.replay(exercise, bpm),
    pause: () => controllerRef.current?.pause(),
    stop: () => controllerRef.current?.stop(),
  };
}
