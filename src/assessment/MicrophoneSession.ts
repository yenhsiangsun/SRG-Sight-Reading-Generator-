import { detectPitch } from './pitch';
import type { Observation } from './scoring';
import {audioRouteKey,type OutputRoute} from './calibration';
export type ExamStage = 'idle'|'permission'|'reading'|'countin'|'performing'|'result';
export class MicrophoneSession {
  private context:AudioContext|null=null;
  private stream:MediaStream|null=null;
  private node:AudioWorkletNode|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private restoreAudioSession:(()=>void)|null=null;
  private generation=0;
  stop(){
    this.generation++;
    if(this.timer)clearInterval(this.timer);
    this.timer=null;
    this.node?.disconnect();this.node=null;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    if(this.context){this.context.onstatechange=null;void this.context.close().catch(()=>{});}
    this.context=null;
    this.restoreAudioSession?.();this.restoreAudioSession=null;
  }
  async start(readingSeconds:number,bpm:number,duration:number,onState:(stage:ExamStage,remaining:number)=>void,onFinish:(frames:Observation[])=>void,
    options:{outputRoute?:OutputRoute;onRoute?:(routeKey:string)=>void;onProgress?:(stage:ExamStage,elapsedSeconds:number)=>void}={}){
    this.stop();
    const generation=this.generation;
    if(!navigator.mediaDevices?.getUserMedia||!window.AudioWorkletNode)throw new Error('MIC_UNSUPPORTED');
    onState('permission',0);
    let stream:MediaStream;
    try {
      // Declare duplex audio before iOS changes the microphone/output route.
      // Older browsers have no Audio Session API; Web Audio remains the fallback.
      const audioSession=(navigator as Navigator & {audioSession?:{type:string}}).audioSession;
      if(audioSession){
        const previousType=audioSession.type;
        try{
          audioSession.type='play-and-record';
          this.restoreAudioSession=()=>{try{if(audioSession.type==='play-and-record')audioSession.type=previousType;}catch{/* Optional platform API. */}};
        }catch{/* Continue with standard Web Audio on unsupported implementations. */}
      }
      const context=new AudioContext({latencyHint:'interactive'});this.context=context;
      // Both resume and a source start must run synchronously inside the button
      // gesture. A silent buffer primes output without adding an extra count-in.
      const resume=context.resume().catch(()=>{throw new Error('AUDIO_UNAVAILABLE');});
      void resume.catch(()=>{});
      const primer=context.createBufferSource();
      primer.buffer=context.createBuffer(1,1,context.sampleRate);
      primer.connect(context.destination);primer.onended=()=>primer.disconnect();primer.start();
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      await resume;
      if(generation!==this.generation)return;
      const settings=stream.getAudioTracks()[0]?.getSettings?.();
      options.onRoute?.(audioRouteKey(settings?.deviceId??'default',context.sampleRate,options.outputRoute??'speakers',
        'sinkId' in context?String(context.sinkId):'default'));
      await context.audioWorklet.addModule(import.meta.env.BASE_URL+'capture-worklet.js');
      if(generation!==this.generation)return;
      const capture=new AudioWorkletNode(context,'practice-capture');this.node=capture;
      const muted=context.createGain();muted.gain.value=0;
      context.createMediaStreamSource(stream).connect(capture).connect(muted).connect(context.destination);
      // Mic permission/route setup can suspend a context that was already unlocked.
      // Schedule nothing until that same clock is running again.
      if(context.state!=='running'){
        try{await context.resume();}catch{throw new Error('AUDIO_UNAVAILABLE');}
        if(generation!==this.generation)return;
      }
      if(context.state!=='running')throw new Error('AUDIO_UNAVAILABLE');
      const readyAt=context.currentTime;
      const countStart=readyAt+Math.max(.1,readingSeconds);
      const beat=60/bpm;
      const start=countStart+4*beat;
      const end=start+duration;
      const frames:Observation[]=[];
      for(let i=0;i<4;i++){
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.type='triangle';
        oscillator.frequency.value=i===0?1100:800;
        const at=countStart+i*beat;
        gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.25,at+.003);gain.gain.exponentialRampToValueAtTime(.0001,at+.09);
        oscillator.connect(gain).connect(context.destination);oscillator.start(at);oscillator.stop(at+.1);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      }
      capture.port.onmessage=event=>{
        if(generation!==this.generation)return;
        const {samples,time,sampleRate}=event.data as {samples:Float32Array;time:number;sampleRate:number};
        const frameTime=time+samples.length/sampleRate/2;
        if(frameTime<start-.2||frameTime>end)return;
        const pitch=detectPitch(samples,sampleRate);
        const rms=pitch?.rms??Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);
        const clipped=samples.some(sample=>Math.abs(sample)>=.995);
        frames.push({time:frameTime-start,midi:pitch?.midi??0,confidence:pitch?.confidence??0,rms,clipped});
      };
      const interrupt=()=>{if(generation===this.generation){this.stop();onState('idle',0);}};
      context.onstatechange=()=>{if(context.state!=='running')interrupt();};
      capture.onprocessorerror=interrupt;
      stream.getAudioTracks().forEach(track=>track.addEventListener('ended',interrupt,{once:true}));
      let previous='';
      const tick=()=>{
        if(generation!==this.generation)return;
        const now=context.currentTime;
        if(now>=end+.12){this.stop();onFinish(frames);return;}
        const stage:ExamStage=now<countStart?'reading':now<start?'countin':'performing';
        options.onProgress?.(stage,Math.max(0,now-(stage==='reading'?readyAt:stage==='countin'?countStart:start)));
        const remaining=stage==='reading'?Math.ceil(countStart-now):stage==='countin'?Math.ceil((start-now)/beat):Math.max(0,Math.ceil(end-now));
        const key=stage+remaining;
        if(key!==previous){previous=key;onState(stage,remaining);}
      };
      tick();this.timer=setInterval(tick,40);
    }catch(error){
      if(generation!==this.generation)return;
      this.stop();
      throw error;
    }
  }
}
