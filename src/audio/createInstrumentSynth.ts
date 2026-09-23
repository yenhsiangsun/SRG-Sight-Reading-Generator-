import * as Tone from 'tone';
import { getTimbreId, TIMBRES, type Timbre } from './timbres';

/** Instantiate only after Tone.start(), following a play/preview gesture. */
export function createInstrumentSynth(instrument: string) {
  const ROLLOFF_24 = -24 as Tone.FilterOptions['rolloff'];
  const ROLLOFF_12 = -12 as Tone.FilterOptions['rolloff'];

  const id = getTimbreId(instrument);
  const p: Timbre = TIMBRES[id];

  const isPlucked = ['liuqin', 'pipa', 'zhongruan', 'daruan', 'sanxian', 'guzheng', 'guitar', 'electricBass'].includes(id);
  const isBowed = ['gaohu', 'erhu', 'zhonghu', 'gehu', 'bassGehu', 'violin', 'viola', 'cello', 'bass'].includes(id);
  const isWoodwind = ['flute', 'clarinet', 'oboe', 'bassoon', 'altoSax', 'tenorSax', 'sheng', 'tenorSheng', 'bassSheng', 'bangdi', 'qudi', 'xindi', 'suona', 'guan'].includes(id);
  const isBrass = ['trumpet', 'horn', 'trombone', 'tuba'].includes(id);

  const oscillator = { type: 'custom' as const, partials: [...p.partials] };
  const envelope = { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release };

  const toneCategory = isPlucked
    ? 'plucked'
    : isBowed
      ? 'bowed'
      : isWoodwind
        ? 'woodwind'
        : isBrass
          ? 'brass'
          : id === 'piano'
            ? 'piano'
            : 'other';

  const filterBase = {
    type: 'lowpass' as const,
    rolloff: toneCategory === 'plucked' ? ROLLOFF_24 : ROLLOFF_12,
    Q: toneCategory === 'bowed' ? 1.06 : toneCategory === 'plucked' ? 0.85 : 0.68,
  };

  const filterEnvelope = {
    attack: toneCategory === 'plucked' ? p.attack * 0.7 : p.attack,
    decay: toneCategory === 'plucked' ? p.decay * 0.55 : p.decay,
    sustain: toneCategory === 'plucked' ? 0.05 : isBowed ? 0.88 : p.sustain,
    release: p.release,
    baseFrequency: toneCategory === 'plucked' ? 750 : isBowed ? 1450 : isWoodwind || isBrass ? 1850 : 2400,
    octaves: toneCategory === 'plucked' ? 3.4 : isBowed ? 1.8 : isWoodwind ? 2.5 : 1.8,
  };

  const synth = p.fm
    ? new Tone.PolySynth(Tone.FMSynth, {
      oscillator,
      envelope,
      harmonicity: p.fm.harmonicity,
      modulationIndex: p.fm.modulationIndex,
      modulation: { type: 'triangle' },
      modulationEnvelope: { attack: 0.001, decay: Math.min(0.05, p.decay * 0.5), sustain: 0, release: p.release },
    })
    : new Tone.PolySynth(Tone.MonoSynth, {
      oscillator,
      envelope,
      filter: filterBase,
      filterEnvelope,
    });

  synth.maxPolyphony = 24;
  synth.volume.value = p.volume;

  const shapingFilter = new Tone.Filter({
    frequency: isPlucked ? 6800 : isBowed ? 5400 : isWoodwind ? 6500 : isBrass ? 5200 : 6200,
    type: 'lowpass',
    rolloff: toneCategory === 'plucked' ? ROLLOFF_24 : ROLLOFF_12,
    Q: isBowed ? 1.05 : isWoodwind ? 0.95 : 0.72,
  });

  const pluckFilter = isPlucked ? new Tone.Filter({ frequency: 7200, type: 'lowpass' as const, rolloff: ROLLOFF_24, Q: 0.68 }) : null;

  const movement = isPlucked
    ? (() => {
        const chorus = new Tone.Chorus(1.45, 2.2, 0.24);
        chorus.wet.value = 0.22;
        chorus.start();
        return chorus;
      })()
    : isBowed
      ? (() => {
          const chorus = new Tone.Chorus(2.1, 2.6, 0.22);
          chorus.wet.value = 0.16;
          chorus.start();
          return chorus;
        })()
      : new Tone.Phaser(0.16, 2.1, 900);

  const bright = isWoodwind || isBrass
    ? new Tone.EQ3({ low: 0.9, mid: 1.05, high: 1.12 })
    : isPlucked
      ? new Tone.EQ3({ low: 0.88, mid: 0.98, high: 1.2 })
      : isBowed
        ? new Tone.EQ3({ low: 0.95, mid: 1.02, high: 1.04 })
        : null;

  const movementAir = isWoodwind ? new Tone.EQ3({ low: 0.95, mid: 1.01, high: 1.2 }) : null;

  const reverb = new Tone.Reverb({
    decay: isBowed ? 2.2 : isPlucked ? 1.2 : 1.75,
    preDelay: 0.018,
    wet: isBowed ? 0.18 : isPlucked ? 0.14 : isWoodwind || isBrass ? 0.1 : 0.12,
  });

  const space = isPlucked ? null : new Tone.FeedbackDelay('8n', 0.08);
  if (space) space.wet.value = 0.055;

  const bowVibrato = isBowed ? new Tone.Vibrato({ frequency: 5.6, depth: 0.038, wet: 0.24 }) : null;
  const bowMicroMod = isBowed
    ? (() => {
        const slight = new Tone.AutoFilter({
          frequency: 0.3,
          baseFrequency: 1800,
          octaves: 2,
          depth: 0.2,
          wet: 0.08,
        });
        slight.start();
        return slight;
      })()
    : null;

  const compress = isPlucked ? new Tone.Compressor(-24, 5) : new Tone.Compressor(-26, 4);

  const effectChain: Tone.ToneAudioNode[] = [];
  if (pluckFilter) effectChain.push(pluckFilter);
  if (bowVibrato) effectChain.push(bowVibrato);
  if (bowMicroMod) effectChain.push(bowMicroMod);
  effectChain.push(shapingFilter, movement);
  if (movementAir) effectChain.push(movementAir);
  if (bright) effectChain.push(bright);
  effectChain.push(reverb);
  if (space) effectChain.push(space);
  effectChain.push(compress);

  let chainEnd: Tone.ToneAudioNode = synth as Tone.ToneAudioNode;
  for (const effect of effectChain) {
    chainEnd = chainEnd.connect(effect) as Tone.ToneAudioNode;
  }
  chainEnd.connect(Tone.Destination);

  return {
    triggerAttackRelease: (note: string, duration: number, time: number, velocity?:number) => synth.triggerAttackRelease(note, duration, time, velocity),
    releaseAll: () => synth.releaseAll(),
    dispose: () => {
      synth.dispose();
      for (const effect of effectChain) effect.dispose();
    },
  };
}
