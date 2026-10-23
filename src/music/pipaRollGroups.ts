import type {GeneratedNote, MeasureData, TimeSignature} from '../music';
import {metricPosition, pulseGroups} from './meterFeel';
import {notePitches} from './notePitches';

export function validPipaRollNote(note: GeneratedNote): boolean {
  const pitches=notePitches(note);
  if (note.rest || note.chord || note.tuplet || note.articulation || pitches.length!==1 || !Number.isFinite(pitches[0].midi) || pitches[0].midi<57) return false;
  const group=note.pipaRollGroup;
  if (group===undefined) return note.durationUnits>=4;
  return !!group && typeof group==='object' && Number.isInteger(group.startUnits) && Number.isInteger(group.endUnits) &&
    group.startUnits>=0 && group.endUnits-group.startUnits>=4 && group.endUnits-group.startUnits<=12 &&
    note.durationUnits>=1 && note.startUnits>=group.startUnits && note.startUnits+note.durationUnits<=group.endUnits;
}

/** Validate the complete gesture, so orphan short-note annotations cannot pass
 * the library/resume boundary as independent finger rolls. */
export function validPipaRollGroups(measure: MeasureData, fallback: TimeSignature): boolean {
  const checked=new Set<string>();
  for (const note of measure.events) {
    const group=note.pipaRollGroup;
    if (group===undefined) continue;
    if (note.technique!=='pipa-roll' || !validPipaRollNote(note) || group.endUnits>measure.totalUnits) return false;
    const key=`${group.startUnits}:${group.endUnits}`;
    if (checked.has(key)) continue;
    checked.add(key);
    if (!metricPosition(measure,group.startUnits,fallback).onPulse ||
      group.endUnits!==measure.totalUnits && !metricPosition(measure,group.endUnits,fallback).onPulse) return false;
    const members=measure.events.filter(n=>n.startUnits>=group.startUnits && n.startUnits<group.endUnits);
    if (members.length<2 || members.length>3 || !members.some(n=>n.durationUnits>=4)) return false;
    let next=group.startUnits;
    for (const member of members) {
      if (member.startUnits!==next || member.technique!=='pipa-roll' || !validPipaRollNote(member) ||
        member.pipaRollGroup?.startUnits!==group.startUnits || member.pipaRollGroup.endUnits!==group.endUnits) return false;
      next+=member.durationUnits;
    }
    if (next!==group.endUnits) return false;
  }
  return true;
}

/** Extend a held roll over the preceding musical pulse. Keep all composed
 * attacks, rests, pitches and durations; short notes belong to the whole roll. */
export function precedingPipaRollGroup(measure: MeasureData, anchor: GeneratedNote, fallback: TimeSignature): GeneratedNote[] | undefined {
  if (anchor.durationUnits<4 || anchor.durationUnits>6) return;
  const boundaries=[0];
  for (const pulse of pulseGroups(measure,fallback)) boundaries.push(boundaries.at(-1)!+pulse);
  const index=boundaries.indexOf(anchor.startUnits),end=anchor.startUnits+anchor.durationUnits;
  if (index<1 || !boundaries.includes(end)) return;
  const start=boundaries[index-1];
  const members=measure.events.filter(n=>n.startUnits>=start && n.startUnits<end);
  if (members.length<2 || members.length>3 || members.at(-1)!==anchor) return;
  let next=start;
  for (const member of members) {
    if (member.startUnits!==next || member.rest || member.chord || member.tuplet || member.durationUnits<1 ||
      member.midi===undefined || member.midi<57 || member.technique || member.pipaRollGroup || member!==anchor && member.articulation) return;
    next+=member.durationUnits;
  }
  if (next!==end) return;
  return members;
}
