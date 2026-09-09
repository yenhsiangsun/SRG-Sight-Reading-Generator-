/** YIN-style normalized difference. Monophonic input only; no polyphonic claim. */
export function detectPitch(input:Float32Array,sampleRate:number) {
  const stride=Math.max(1,Math.floor(sampleRate/16000));
  const samples=Float32Array.from({length:Math.floor(input.length/stride)},(_,i)=>input[i*stride]);
  const rate=sampleRate/stride;
  const rms=Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);
  if(rms<.008)return null;
  const maxLag=Math.min(Math.floor(rate/65),Math.floor(samples.length/2));
  const minLag=Math.floor(rate/1500);
  const difference=new Float32Array(maxLag+1);
  let running=0;
  let chosen=0;
  for(let lag=1;lag<=maxLag;lag++){
    let sum=0;
    for(let i=0;i<samples.length-maxLag;i++){const d=samples[i]-samples[i+lag];sum+=d*d;}
    running+=sum;
    difference[lag]=running===0?1:sum*lag/running;
  }
  for(let lag=minLag;lag<maxLag;lag++){
    if(difference[lag]<.15){while(lag+1<=maxLag&&difference[lag+1]<difference[lag])lag++;chosen=lag;break;}
  }
  if(!chosen)return null;
  const before=difference[chosen-1],center=difference[chosen],after=difference[chosen+1]??center;
  const denominator=2*(2*center-after-before);
  const adjustment=denominator?(after-before)/denominator:0;
  const frequency=rate/(chosen+Math.max(-.5,Math.min(.5,adjustment)));
  if(frequency<65||frequency>1500)return null;
  return {frequency,midi:69+12*Math.log2(frequency/440),confidence:1-center,rms};
}
