import * as Tone from 'tone';
import manifest from './sampleManifest.json';
import {createInstrumentSynth} from './createInstrumentSynth';
const samples:Record<string,{folder:string;urls:Record<string,string>}>=manifest;
export const hasSamples=(instrument:string)=>Object.hasOwn(samples,instrument);
export async function createPlaybackInstrument(instrument:string) {
  const selected=samples[instrument];
  if(!selected)return createInstrumentSynth(instrument);
  return await new Promise<Tone.Sampler>((resolve,reject)=>{
    let sampler:Tone.Sampler;
    const timer=setTimeout(()=>{sampler.dispose();reject(new Error('音色載入逾時，請重試。'));},15000);
    sampler=new Tone.Sampler({urls:selected.urls,baseUrl:import.meta.env.BASE_URL+'samples/'+selected.folder+'/',
      attack:.005,release:instrument==='Piano'?.5:.15,volume:-10,
      onload:()=>{clearTimeout(timer);resolve(sampler.toDestination());},
      onerror:()=>{clearTimeout(timer);sampler.dispose();reject(new Error('無法載入樂器音色，請重試。'));},
    });
  });
}
