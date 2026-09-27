export const RHYTHM_FOCUSES = ['balanced','sixteenths','dotted','triplets','offbeats'] as const;
export type RhythmFocus = typeof RHYTHM_FOCUSES[number];
/** A scalar remains valid for saved studies made before multiple selection. */
export type RhythmFocusSelection = RhythmFocus | readonly RhythmFocus[];
export type PitchFocus = 'balanced'|'leaps'|'scales';
export type PracticeFocus = RhythmFocus|'leaps'|'scales'|'mixed';
export const focusMessage = {balanced:'focusBalanced',sixteenths:'focusSixteenths',dotted:'focusDotted',triplets:'focusTriplets',offbeats:'focusOffbeats'} as const;
export const practiceFocusMessage={...focusMessage,leaps:'focusLeaps',scales:'focusScales',mixed:'focusMixed'} as const;
export function rhythmFocuses(value:RhythmFocusSelection='balanced'):RhythmFocus[] {
  const values=typeof value==='string'?[value]:value;
  const selected=RHYTHM_FOCUSES.filter(focus=>focus!=='balanced'&&values.includes(focus));
  return selected.length?selected:['balanced'];
}
export function validRhythmFocus(value:unknown):boolean {
  const valid=(v:unknown)=>RHYTHM_FOCUSES.includes(v as RhythmFocus);
  return value===undefined||valid(value)||(Array.isArray(value)&&value.length>0&&value.length<=4&&
    new Set(value).size===value.length&&value.every(valid)&&(!value.includes('balanced')||value.length===1));
}
export function selectedPracticeFocus(settings:Pick<import('../hooks/useExercise').ExerciseSettings,'rhythmFocus'|'pitchFocus'|'mixedMeters'>):PracticeFocus[] {
  const selected:PracticeFocus[]=rhythmFocuses(settings.rhythmFocus).filter(focus=>focus!=='balanced');
  if(settings.pitchFocus==='leaps'||settings.pitchFocus==='scales')selected.push(settings.pitchFocus);
  if(settings.mixedMeters)selected.push('mixed');
  return selected.length?selected:['balanced'];
}
export function togglePracticeFocus(selected:readonly PracticeFocus[],value:PracticeFocus):PracticeFocus[] {
  if(value==='balanced')return ['balanced'];
  const next=selected.includes(value)?selected.filter(focus=>focus!==value):[...selected.filter(focus=>focus!=='balanced' && !(value==='scales'&&focus==='leaps') && !(value==='leaps'&&focus==='scales')),value];
  return next.length?next:['balanced'];
}
export function focusSettings(focus:PracticeFocus|readonly PracticeFocus[],measureCount=8):Partial<import('../hooks/useExercise').ExerciseSettings> {
  const selected=typeof focus==='string'?[focus]:focus;
  const rhythms=rhythmFocuses(selected.filter((v):v is RhythmFocus=>RHYTHM_FOCUSES.includes(v as RhythmFocus)));
  const mixed=selected.includes('mixed'),triplets=selected.includes('triplets');
  return {pitchFocus:selected.includes('scales')?'scales':selected.includes('leaps')?'leaps':'balanced',rhythmFocus:rhythms.length===1?rhythms[0]:rhythms,
    mixedMeters:mixed,
    ...(selected.includes('scales')?{allowAccidentals:false}:{}),
    ...(mixed?{meters:['4/4','6/8'],measureCount:Math.max(4,measureCount)}:{}),
    ...(triplets?{timeSignature:'4/4'}:{}),
  };
}

/** Subdivide inside the existing beat groups; never move a barline or beat. */
export function focusedComposition(units: number, focus: RhythmFocus, level: 'simple' | 'medium' | 'complex' = 'medium') {
  if(focus==='triplets' && units===4)return Array.from({length:3},()=>({units:4/3,duration:'8' as const,dots:0,tuplet:3 as const}));
  if(focus==='offbeats')return (units===6?[2,1,2,1]:units===4?[1,2,1]:[1,1]).map(units=>({units,duration:units===1?'16' as const:'8' as const,dots:0}));
  const lengths: number[] = [];
  let left = units;
  while (left > 0) {
    if (focus === 'dotted' && left >= 4) {
      lengths.push(3, 1); left -= 4;
    } else if (focus === 'sixteenths' && left >= 2) {
      // Keep some eighths for phrasing, with substantially more sixteenths.
      const density = level === 'simple' ? 0.55 : level === 'medium' ? 0.75 : 0.9;
      lengths.push(...(Math.random() < density ? [1, 1] : [2])); left -= 2;
    } else {
      lengths.push(left >= 2 ? 2 : 1); left -= left >= 2 ? 2 : 1;
    }
  }
  if(focus==='sixteenths'&&!lengths.includes(1)&&lengths[0]===2)lengths.splice(0,1,1,1);
  return lengths.map(units => ({units, duration: units === 1 ? '16' as const : '8' as const, dots: units === 3 ? 1 : 0}));
}
