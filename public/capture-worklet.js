class CaptureProcessor extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(2048);this.offset=0;}
  process(inputs){
    const input=inputs[0]?.[0];
    if(input)for(let i=0;i<input.length;i++){
      this.buffer[this.offset++]=input[i];
      if(this.offset===this.buffer.length){
        this.port.postMessage({samples:this.buffer,time:currentTime+(i+1-this.buffer.length)/sampleRate,sampleRate});
        this.buffer=new Float32Array(2048);this.offset=0;
      }
    }
    return true;
  }
}
registerProcessor('practice-capture',CaptureProcessor);
