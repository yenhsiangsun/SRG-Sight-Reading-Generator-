import {useLayoutEffect,useRef} from 'react';
import {Accidental,Barline,Beam,Formatter,Renderer,Stave,StaveNote,Voice} from 'vexflow';
import type {ExamStage} from '../assessment/MicrophoneSession';
import {calibrationCursorX,calibrationWrittenPitch} from '../notation/calibrationScore';
import './CalibrationScore.css';

interface CalibrationScoreProps {
  stage:ExamStage;
  /** Seconds from the start of the current phase, measured by the capture AudioContext. */
  elapsed:number;
  clef:'treble'|'bass'|'alto'|'tenor';
  noteKey:string;
  label:string;
}

interface ScoreGeometry {width:number;noteXs:number[];endX:number}
const MIN_SCORE_HEIGHT=172;

/** A calibration score is only a view of the microphone session's clock. */
export default function CalibrationScore({stage,elapsed,clef,noteKey,label}:CalibrationScoreProps) {
  const hostRef=useRef<HTMLDivElement>(null);
  const cursorRef=useRef<HTMLDivElement>(null);
  const geometryRef=useRef<ScoreGeometry|null>(null);
  const progressRef=useRef({stage,elapsed});

  const positionCursor=()=>{
    const cursor=cursorRef.current,geometry=geometryRef.current;
    if(!cursor||!geometry)return;
    const progress=progressRef.current;
    const x=calibrationCursorX(progress.stage,progress.elapsed,geometry.noteXs,geometry.endX);
    cursor.style.left=`${(x??geometry.noteXs[0])/geometry.width*100}%`;
  };

  useLayoutEffect(()=>{
    progressRef.current={stage,elapsed};
    positionCursor();
  },[stage,elapsed]);

  useLayoutEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let renderedWidth=0;
    const draw=()=>{
      // Keep standard-size music glyphs on phones; the viewBox only scales down
      // slightly if a narrow card has less than 300 pixels of available space.
      const width=Math.max(300,Math.round(host.clientWidth));
      if(width===renderedWidth)return;
      renderedWidth=width;
      host.replaceChildren();
      const written=calibrationWrittenPitch(clef,noteKey);
      // A deliberately unusual selected clef can still need ledger lines after
      // an octave shift. Expand vertically instead of clipping or using 15ma.
      const staveY=Math.max(40,written.staffSteps*5-30);
      const noteY=staveY+80-written.staffSteps*5;
      const contentBottom=Math.max(staveY+80,noteY+13);
      const countY=contentBottom+(written.octaveShift<0?52:35);
      const height=Math.max(MIN_SCORE_HEIGHT,countY+15);
      const renderer=new Renderer(host,Renderer.Backends.SVG);
      renderer.resize(width,height);
      const context=renderer.getContext();
      context.setFillStyle('#28251f').setStrokeStyle('#28251f');
      const stave=new Stave(10,staveY,width-20)
        .addClef(clef).addTimeSignature('4/4')
        .setTempo({duration:'q',bpm:60},-7)
        .setEndBarType(Barline.type.END);
      stave.setContext(context).draw();
      const notes=Array.from({length:8},()=>new StaveNote({clef,keys:[written.key],duration:'8',autoStem:true}));
      const voice=new Voice({numBeats:4,beatValue:4}).addTickables(notes);
      Accidental.applyAccidentals([voice],'C');
      const beams=Array.from({length:4},(_,beat)=>new Beam(notes.slice(beat*2,beat*2+2),true));
      new Formatter().joinVoices([voice]).formatToStave([voice],stave);
      voice.draw(context,stave);
      beams.forEach(beam=>beam.setContext(context).draw());
      const noteXs=notes.map(note=>(note.getNoteHeadBeginX()+note.getNoteHeadEndX())/2);
      const endX=stave.getNoteEndX()-5;
      geometryRef.current={width,noteXs,endX};
      if(written.octaveShift){
        const below=written.octaveShift<0;
        const octaveY=below?contentBottom+24:26;
        const x=noteXs[0]-5;
        context.setFillStyle('#51483c').setStrokeStyle('#51483c');
        context.setFont('Times New Roman',13,'normal','italic');
        context.fillText(below?'8vb':'8va',x,octaveY+4);
        context.setLineWidth(1).setLineDash([4,3]);
        context.beginPath().moveTo(x+27,octaveY).lineTo(endX,octaveY).stroke();
        context.setLineDash([]);
        context.beginPath().moveTo(endX,octaveY).lineTo(endX,octaveY+(below?-5:5)).stroke();
      }
      // Counting syllables sit below their actual engraved onsets, so the moving
      // bar and the eight attacks agree even when the score is resized.
      context.setFont('Arial',12);
      context.setFillStyle('#827765');
      noteXs.forEach((x,index)=>context.fillText(index%2===0?String(index/2+1):'&',x-3,countY));
      const svg=host.querySelector('svg');
      svg?.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg?.setAttribute('preserveAspectRatio','xMidYMid meet');
      svg?.setAttribute('aria-hidden','true');
      svg?.setAttribute('focusable','false');
      if(svg){svg.style.width='100%';svg.style.height='auto';}
      if(cursorRef.current){
        cursorRef.current.style.top=`${Math.max(30,Math.min(staveY+15,noteY-20))/height*100}%`;
        cursorRef.current.style.bottom=`${(height-contentBottom-8)/height*100}%`;
      }
      positionCursor();
    };
    draw();
    const observer=new ResizeObserver(draw);
    observer.observe(host);
    return ()=>{observer.disconnect();geometryRef.current=null;host.replaceChildren();};
  },[clef,noteKey]);

  const countBeat=stage==='countin'?Math.min(4,Math.floor(elapsed)+1):0;
  const cursorVisible=stage==='performing';
  return <div className="calibration-score" role="img" aria-label={label} data-stage={stage}>
    <div className="calibration-score-counts" aria-hidden="true">
      {[1,2,3,4].map(beat=><span key={beat} className={countBeat===beat?'is-current':countBeat>beat?'is-complete':''}>{beat}</span>)}
    </div>
    <div className="calibration-score-paper">
      <div ref={hostRef} className="calibration-score-staff" aria-hidden="true"/>
      <div ref={cursorRef} className={`calibration-score-bar${stage==='performing'?' is-playing':''}`} aria-hidden="true" hidden={!cursorVisible}/>
    </div>
  </div>;
}
