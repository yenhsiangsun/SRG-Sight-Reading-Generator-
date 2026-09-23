import { Accidental, Annotation, Articulation, Modifier, Beam, ClefNote, NoteSubGroup, Dot, Fraction, StaveNote, Tuplet, Voice, type Stave } from 'vexflow';
import type { Clef, MeasureData, TimeSignature } from '../music';
import {octaveWrittenKey} from './octaveLines';
import {notePitches} from '../music/notePitches';
import {addRhythmUnits, assertMeasureRhythm} from '../music/rhythmTiming';
import {ScoreTuplet, chooseTupletSide} from './ScoreTuplet';

export function createMeasureNotation(measure: MeasureData, clef: Clef, key: string, meter: TimeSignature, octaveShifts: number[] = [], eventClefs: Clef[] = [], clefAnnotation?: string) {
  const [numBeats, beatValue] = meter.split('/').map(Number);
  const expectedUnits = numBeats * 16 / beatValue;
  assertMeasureRhythm(measure, meter);

  const restKeys: Record<Clef, string> = { treble: 'b/4', bass: 'd/3', alto: 'c/4', tenor: 'a/3' };
  let previousClef = clef;
  const notes = measure.events.map((note, index) => {
    const activeClef = eventClefs[index] ?? clef;
    const result = new StaveNote({
      clef:activeClef, keys: note.rest ? [restKeys[activeClef]] : notePitches(note)
        .slice().sort((a,b) => a.midi-b.midi).map(pitch => octaveWrittenKey(pitch.key, octaveShifts[index] ?? 0)),
      duration: `${note.duration}${note.rest ? 'r' : ''}`,
      dots: note.dots, autoStem: true,
      alignCenter: note.measureRest,
      durationOverride: note.measureRest ? new Fraction(numBeats,beatValue) : undefined,
    });
    if (activeClef !== previousClef) {
      const change = new NoteSubGroup([new ClefNote(activeClef,'small',clefAnnotation)]);
      // NoteSubGroup reserves only the glyph width by default. Leave breathing
      // room between an inline clef and the following note/accidental.
      change.preFormat();
      change.setWidth(change.getWidth() + 10);
      result.addModifier(change,0);
    }
    previousClef = activeClef;
    for (let dot = 0; dot < note.dots; dot++) Dot.buildAndAttach([result]);
    if(!note.rest && note.articulation) {
      const code={staccato:'a.',tenuto:'a-',accent:'a>'}[note.articulation];
      const articulation=new Articulation(code).setPosition(Modifier.Position.ABOVE);
      if(note.articulation==='tenuto')articulation.setYShift(-3);
      result.addModifier(articulation,0);
    }
    if(!note.rest && note.dynamic) result.addModifier(new Annotation(note.dynamic).setFont('Times New Roman',16,'bold','italic').setVerticalJustification(Annotation.VerticalJustify.BOTTOM),0);
    return result;
  });
  // Attach before Voice counts ticks: three written eighths take exactly one beat.
  const tuplets: ScoreTuplet[] = [];
  for (let i = 0; i < notes.length; i++) if (measure.events[i].tuplet === 3) {
    tuplets.push(new ScoreTuplet(notes.slice(i,i+3), {numNotes:3, notesOccupied:2, ratioed:false,
      bracketed:true, location:Tuplet.LOCATION_TOP}));
    i += 2;
  }
  const voice = new Voice({ numBeats, beatValue }).setStrict(true).addTickables(notes);
  if (!voice.isComplete()) throw new Error('小節拍數不完整。');
  // Called once per bar: accidental state resets at each barline, separately by octave.
  Accidental.applyAccidentals([voice], key);
  // In simple meter expose each quarter beat; compound/asymmetric meters keep their big beats.
  const groups = beatValue === 4 ? Array(numBeats).fill(4) as number[] : measure.beamGroups;
  const beams: Beam[] = [];
  let groupIndex = 0;
  let groupEnd = groups[0] ?? expectedUnits;
  let run: number[] = [];
  const finishRun = () => {
    // VexFlow's beamMiddleOnly checks only one edge rest. Trim the complete
    // silent prefix/suffix so a beam can never begin or end on a rest.
    while (run.length && notes[run[0]].isRest()) run.shift();
    while (run.length && notes[run[run.length - 1]].isRest()) run.pop();
    if (run.length > 1) {
      // Internal short rests still connect the sounded notes in this beat.
      const beam = new Beam(run.map(index => notes[index]), true);
      if (beatValue === 8) {
        // Keep consecutive sounded sixteenths connected inside the primary
        // 3+3 / 2+2+3 group. Only expose eighth-pulse gaps around other values
        // or rests; splitting every eighth made continuous runs look fragmented.
        const breaks = run.flatMap((index, beamIndex) => {
          const event = measure.events[index];
          const next = measure.events[run[beamIndex + 1]];
          const continuousSixteenths = next && !event.rest && !next.rest &&
            event.durationUnits === 1 && next.durationUnits === 1;
          return next && !continuousSixteenths && (event.startUnits + event.durationUnits) % 2 === 0 ? [beamIndex] : [];
        });
        beam.breakSecondaryAt(breaks);
        run.forEach((index, beamIndex) => {
          const event = measure.events[index];
          if (event.duration === '16') beam.setPartialBeamSideAt(beamIndex, event.startUnits % 2 === 0 ? 'R' : 'L');
        });
      }
      beams.push(beam);
    }
    run = [];
  };
  measure.events.forEach((event, index) => {
    if (index > 0 && eventClefs[index] !== eventClefs[index-1]) finishRun();
    while (event.startUnits >= groupEnd && groupIndex < groups.length - 1) {
      finishRun();
      groupEnd += groups[++groupIndex];
    }
    // Quarter-note values and notes crossing a primary beat do not join beams.
    const end = addRhythmUnits(event.startUnits, event.durationUnits);
    if (!['8', '16'].includes(event.duration) || end > groupEnd) {
      finishRun();
      return;
    }
    run.push(index);
    if (end === groupEnd) finishRun();
  });
  finishRun();
  for (const tuplet of tuplets) {
    const group = tuplet.getNotes();
    tuplet.setBracketed(!beams.some(beam => group.every(note => beam.getNotes().some(member=>member===note))));
    tuplet.setTupletLocation(chooseTupletSide(group as StaveNote[]));
  }
  return { notes, voice, beams, tuplets };
}

/** Articulations must see the final beam slope and extended stems before drawing. */
export function prepareNotationForDrawing(notation: ReturnType<typeof createMeasureNotation>, stave: Stave) {
  notation.notes.forEach(note=>note.setStave(stave));
  notation.beams.forEach(beam=>beam.postFormat());
}
