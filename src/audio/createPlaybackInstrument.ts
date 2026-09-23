import * as Tone from 'tone';
import manifest from './sampleManifest.json';
import {createInstrumentSynth} from './createInstrumentSynth';
interface SampleSet { folder: string; urls: Record<string,string>; volume?: number }
const samples:Record<string,SampleSet>=manifest;
export const hasSamples=(instrument:string)=>Object.hasOwn(samples,instrument);
export async function createPlaybackInstrument(instrument:string) {
  const localPipa = import.meta.env.VITE_LOCAL_PIPA && instrument === 'Pipa';
  const selected: SampleSet | undefined=localPipa ? {folder:'', urls:{A2:'45.wav','C#3':'49.wav',F3:'53.wav',A3:'57.wav',D4:'62.wav','F#4':'66.wav',C5:'72.wav',E5:'76.wav',G5:'79.wav'}} : samples[instrument];
  if(!selected)return createInstrumentSynth(instrument);
    return await new Promise<Tone.Sampler>((resolve, reject) => {
      let sampler: Tone.Sampler;
      const timer = setTimeout(() => {
        sampler.dispose();
        reject(new Error('音色載入逾時，請重試。'));
      }, 30000);
      sampler = new Tone.Sampler({
        urls: selected.urls,
        baseUrl: localPipa ? '/__local-pipa/' : `${import.meta.env.BASE_URL}samples/${selected.folder}/`,
        attack: localPipa ? 0 : 0.005,
        release: instrument === 'Piano' ? 0.5 : 0.15,
        volume: selected.volume ?? -10,
        onload: () => {
          clearTimeout(timer);
          console.info('[audio] Recorded samples loaded', instrument, Object.values(selected.urls).join(', '));
          resolve(sampler.toDestination());
        },
        onerror: () => {
          clearTimeout(timer);
          sampler.dispose();
          reject(new Error('無法載入樂器音色，請重試。'));
        },
      });
    });
}
