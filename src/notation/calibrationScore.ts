import type {ExamStage} from '../assessment/MicrophoneSession';

type CalibrationClef='treble'|'bass'|'alto'|'tenor';
const bottomStaffStep:Record<CalibrationClef,number>={treble:30,bass:18,alto:24,tenor:22};

/** Preserve the actual pitch using at most one octave mark, including its accidental. */
export function calibrationWrittenPitch(clef:CalibrationClef,noteKey:string) {
  const pitch=/^([a-g])([#bn]*)\/(-?\d+)$/i.exec(noteKey);
  if(!pitch)return {key:noteKey,octaveShift:0 as -1|0|1,staffSteps:4};
  const degree='cdefgab'.indexOf(pitch[1].toLowerCase());
  const octave=Number(pitch[3]);
  const originalSteps=octave*7+degree-bottomStaffStep[clef];
  // As in the range selector, the fourth upper ledger line remains unshifted.
  const octaveShift:-1|0|1=originalSteps>16?1:originalSteps< -6?-1:0;
  return {
    key:`${pitch[1]}${pitch[2]}/${octave-octaveShift}`,
    octaveShift,
    staffSteps:originalSteps-octaveShift*7,
  };
}

/** Eight attacks at 60 BPM, followed by the barline at the end of four beats. */
export function calibrationCursorX(stage:ExamStage,elapsed:number,noteXs:readonly number[],endX:number):number|null {
  if(stage!=='performing'||noteXs.length!==8)return null;
  const time=Math.max(0,Math.min(4,Number.isNaN(elapsed)?0:elapsed));
  const index=Math.min(7,Math.floor(time*2));
  const fraction=time>=4?1:time*2-index;
  const nextX=noteXs[index+1]??endX;
  return noteXs[index]+(nextX-noteXs[index])*fraction;
}
