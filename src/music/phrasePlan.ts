import type {RhythmBarPlan} from './phraseRhythm';
import {meterSections} from './meterSections';

/** Inclusive bar boundaries shared by melody, breathing and expression. */
export interface PhraseSpan {
  startBar: number;
  endBar: number;
  role: 'opening' | 'development' | 'answer' | 'closing';
}

const layouts = [[2,2,2,2],[3,3,2],[2,3,3],[4,2,2],[2,4,2],[3,2,3],[2,3,2,3],[2,2,4]];

/** Plan from the written rhythm alone, before any graded pitch candidates.
 * A local hash provides variety without consuming the generation random stream.
 * Actual meter changes always open a fresh phrase; short final sections remain
 * intact, and longer sections avoid a stray one-bar ending when possible.
 */
export function planExercisePhrases(rhythm:readonly RhythmBarPlan[]):PhraseSpan[] {
  if(!rhythm.length)return [];
  const identity=rhythm.map(bar=>`${bar.meter}:${bar.notes.map(note=>
    `${note.startUnits}/${note.units}/${note.rest?'r':'n'}/${note.tuplet??''}`).join(',')}`).join('|');
  let seed=2166136261;
  for(let index=0;index<identity.length;index++)seed=Math.imul(seed^identity.charCodeAt(index),16777619)>>>0;
  const layout=layouts[seed%layouts.length], phrases:PhraseSpan[]=[];
  for(const section of meterSections(rhythm.map(bar=>bar.meter))) {
    let startBar=section.startBar;
    while(startBar<section.endBar) {
      const remaining=section.endBar-startBar;
      let length=Math.min(layout[phrases.length%layout.length],remaining);
      if(remaining-length===1)length=length<4?length+1:length-1;
      phrases.push({startBar,endBar:startBar+length-1,role:'development'});
      startBar+=length;
    }
  }
  return phrases.map((phrase,index)=>({...phrase,role:index===phrases.length-1?'closing':
    index===0?'opening':index===Math.floor(phrases.length/2)?'answer':'development'}));
}
