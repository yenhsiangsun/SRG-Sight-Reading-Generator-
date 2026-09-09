import { detectPitch } from './pitch';
import type { Observation } from './scoring';
export type ExamStage = 'idle'|'permission'|'reading'|'countin'|'performing'|'result';
export class MicrophoneSession {
  private context:AudioContext|null=null;
  private stream:MediaStream|null=null;
  private node:AudioWorkletNode|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private generation=0;
  stop(){
    this.generation++;
    if(this.timer)clearInterval(this.timer);
    this.timer=null;
    this.node?.disconnect();this.node=null;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    if(this.context)void this.context.close().catch(()=>{});
    this.context=null;
  }
  async start(readingSeconds:number,bpm:number,duration:number,onState:(stage:ExamStage,remaining:number)=>void,onFinish:(frames:Observation[])=>void){
    this.stop();
    const generation=this.generation;
    if(!navigator.mediaDevices?.getUserMedia||!window.AudioWorkletNode)throw new Error('MIC_UNSUPPORTED');
    onState('permission',0);
    const context=new AudioContext();this.context=context;
    // Resume within the click gesture; capture starts only after permission succeeds.
    const resume=context.resume();
    void resume.catch(()=>{});
    let stream:MediaStream;
    try {
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      await resume;
      await context.audioWorklet.addModule(import.meta.env.BASE_URL+'capture-worklet.js');
      if(generation!==this.generation)return;
      const capture=new AudioWorkletNode(context,'practice-capture');this.node=capture;
      const muted=context.createGain();muted.gain.value=0;
      context.createMediaStreamSource(stream).connect(capture).connect(muted).connect(context.destination);
      const countStart=context.currentTime+readingSeconds;
      const beat=60/bpm;
      const start=countStart+4*beat;
      const end=start+duration;
      const frames:Observation[]=[];
      for(let i=0;i<4;i++){
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.frequency.value=i===0?1100:800;
        const at=countStart+i*beat;
        gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.15,at+.002);gain.gain.exponentialRampToValueAtTime(.0001,at+.06);
        oscillator.connect(gain).connect(context.destination);oscillator.start(at);oscillator.stop(at+.07);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      }
      capture.port.onmessage=event=>{
        if(generation!==this.generation)return;
        const {samples,time,sampleRate}=event.data as {samples:Float32Array;time:number;sampleRate:number};
        const frameTime=time+samples.length/sampleRate/2;
        if(frameTime<start-.2||frameTime>end)return;
        const pitch=detectPitch(samples,sampleRate);
        if(pitch)frames.push({time:frameTime-start,midi:pitch.midi,confidence:pitch.confidence,rms:pitch.rms});
      };
      const interrupt=()=>{if(generation===this.generation){this.stop();onState('idle',0);}};
      context.onstatechange=()=>{if(context.state==='suspended')interrupt();};
      capture.onprocessorerror=interrupt;
      stream.getAudioTracks().forEach(track=>track.addEventListener('ended',interrupt,{once:true}));
      let previous='';
      const tick=()=>{
        if(generation!==this.generation)return;
        const now=context.currentTime;
        if(now>=end+.12){this.stop();onFinish(frames);return;}
        const stage:ExamStage=now<countStart?'reading':now<start?'countin':'performing';
        const remaining=stage==='reading'?Math.ceil(countStart-now):stage==='countin'?Math.ceil((start-now)/beat):Math.max(0,Math.ceil(end-now));
        const key=stage+remaining;
        if(key!==previous){previous=key;onState(stage,remaining);}
      };
      tick();this.timer=setInterval(tick,80);
    }catch(error){
      if(generation!==this.generation)return;
      this.stop();
      throw error;
    }
  }
}
