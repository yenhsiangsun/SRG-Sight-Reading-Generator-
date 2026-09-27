export type ScoreOrientation='portrait'|'landscape';
export function readScoreSizes(raw:string|null):Record<ScoreOrientation,number> {
  try{
    const value=JSON.parse(raw??'{}');
    const size=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.max(.8,Math.min(1.5,n)):1;
    return {portrait:size(value.portrait),landscape:size(value.landscape)};
  }catch{return {portrait:1,landscape:1};}
}
