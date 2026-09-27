class CaptureProcessor extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(2048);this.offset=0;}
  process(inputs){
    const input=inputs[0]?.[0];
    if(input)for(let i=0;i<input.length;i++){
      this.buffer[this.offset++]=input[i];
      if(this.offset===this.buffer.length){
        // A 2048-sample pitch window with a 512-sample hop gives about 11 ms
        // timing resolution at 48 kHz while retaining low-note information.
        this.port.postMessage({samples:this.buffer.slice(),time:currentTime+(i+1-this.buffer.length)/sampleRate,sampleRate});
        this.buffer.copyWithin(0,512);this.offset=this.buffer.length-512;
      }
    }
    return true;
  }
}
registerProcessor('practice-capture',CaptureProcessor);
