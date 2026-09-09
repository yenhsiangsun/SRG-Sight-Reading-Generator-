import * as Tone from 'tone';
import { getTimbreId, TIMBRES, type Timbre } from './timbres';

/** Instantiate only after Tone.start(), following a play/preview gesture. */
export function createInstrumentSynth(instrument:string) {
  const id=getTimbreId(instrument);
  const p:Timbre=TIMBRES[id];
  const plucked=['liuqin','pipa','zhongruan','daruan','sanxian','guzheng','guitar','electricBass'].includes(id);
  const bowed=['gaohu','erhu','zhonghu','gehu','bassGehu','violin','viola','cello','bass'].includes(id);
  const envelope={attack:p.attack,decay:p.decay,sustain:p.sustain,release:p.release};
  const oscillator={type:'custom' as const,partials:[...p.partials]};
  const synth=p.fm
    ? new Tone.PolySynth(Tone.FMSynth,{oscillator,envelope,harmonicity:p.fm.harmonicity,modulationIndex:p.fm.modulationIndex,
      modulation:{type:'sine'},modulationEnvelope:{attack:.001,decay:p.decay*.7,sustain:0,release:p.release}})
    : new Tone.PolySynth(Tone.MonoSynth,{oscillator,envelope,
      filter:{type:'lowpass',Q:plucked?1.2:bowed?1.8:.6,rolloff:-12},
      filterEnvelope:{attack:plucked?.001:p.attack,decay:plucked?p.decay*.7:.2,sustain:plucked?.08:.65,release:p.release,baseFrequency:plucked?650:bowed?1700:2200,octaves:plucked?3:1.5}});
  synth.maxPolyphony=16;
  synth.volume.value=p.volume;
  if (!bowed) return synth.toDestination();
  // Subtle body resonance and vibrato; this remains a synthesized approximation.
  const vibrato=new Tone.Vibrato({frequency:5.2,depth:.055,wet:.25}).toDestination();
  synth.connect(vibrato);
  return {
    triggerAttackRelease:(note:string,duration:number,time:number)=>synth.triggerAttackRelease(note,duration,time),
    releaseAll:()=>synth.releaseAll(),
    dispose:()=>{synth.dispose();vibrato.dispose();},
  };
}
