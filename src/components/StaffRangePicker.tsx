import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {Accidental,Formatter,Renderer,Stave,StaveNote} from 'vexflow';
import type {Clef} from '../music';
import {mixedRangeClef,rangeMidiAtY,rangeNotePosition,rangeStaffBottom} from '../notation/rangeSelection';
import {useI18n} from '../i18n/context';
import {words} from '../progress/words';
import {midiToNoteLabel} from '../exerciseConfig';
import type {ExerciseSettings} from '../hooks/useExercise';
import './StaffRangePicker.css';

function PitchStaff({value,min,max,clef:choice,label,onChange}:{value:number;min:number;max:number;clef:Clef|'mixedStaff';label:string;onChange:(value:number)=>void}) {
  const {locale}=useI18n();
  const ref=useRef<HTMLDivElement>(null);
  const [heldShift,setHeldShift]=useState<number|null>(null);
  const [heldClef,setHeldClef]=useState<Clef|null>(null);
  const clef=heldClef??(choice==='mixedStaff'?mixedRangeClef(value):choice);
  const active=useRef(false);
  const note=rangeNotePosition(value);
  const position=note.octave*7+note.degree;
  const bottom=rangeStaffBottom[clef];
  const shift=heldShift??(position>bottom+14?1:position<bottom-6?-1:0);
  const bottomY=clef==='bass'?190:clef==='treble'?130:160;
  useEffect(()=>{
    const host=ref.current;if(!host)return;
    host.replaceChildren();
    const renderer=new Renderer(host,Renderer.Backends.SVG);renderer.resize(300,260);
    const context=renderer.getContext();
    const stave=new Stave(18,bottomY-80,264).addClef(clef);
    stave.setContext(context).draw();
    const pitch=rangeNotePosition(value);
    const key=`${'cdefgab'[pitch.degree]}${pitch.sharp?'#':''}/${pitch.octave-shift}`;
    const glyph=new StaveNote({clef,keys:[key],duration:'w'});
    if(pitch.sharp)glyph.addModifier(new Accidental('#'),0);
    glyph.setStyle({fillStyle:'#267e94',strokeStyle:'#267e94'});
    Formatter.FormatAndDraw(context,stave,[glyph]);
    if(shift){context.setFont('Arial',14,'normal','italic');context.fillText(shift>0?'8va':'8vb',95,shift>0?22:246);}
    const svg=host.querySelector('svg');svg?.setAttribute('viewBox','0 0 300 260');svg?.setAttribute('aria-hidden','true');
  },[value,clef,bottomY,shift]);
  const select=(event:PointerEvent<HTMLDivElement>)=>{
    const box=event.currentTarget.getBoundingClientRect();
    onChange(rangeMidiAtY((event.clientY-box.top)*260/box.height,bottomY,clef,shift,min,max));
  };
  const move=(amount:number)=>onChange(Math.max(min,Math.min(max,value+amount)));
  return <section className="staff-range-endpoint"><header><strong>{label}</strong><span>{midiToNoteLabel(value)}</span></header>
    <div className="staff-range-canvas" role="slider" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={midiToNoteLabel(value)}
      onPointerDown={event=>{active.current=true;setHeldShift(shift);setHeldClef(clef);event.currentTarget.setPointerCapture(event.pointerId);select(event);}}
      onPointerMove={event=>{if(active.current)select(event);}}
      onPointerUp={()=>{active.current=false;setHeldShift(null);setHeldClef(null);}}
      onPointerCancel={()=>{active.current=false;setHeldShift(null);setHeldClef(null);}}
      onKeyDown={event=>{const amount=event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:event.key==='PageUp'?12:event.key==='PageDown'?-12:0;if(amount){event.preventDefault();move(amount);}}}>
      <div ref={ref}/>
    </div>
    <div className="staff-range-controls">
      <button type="button" onClick={()=>move(-12)} disabled={value<=min} aria-label={words(locale,'降低八度','Octave down','1オクターブ下げる')}>−8</button>
      <button type="button" onClick={()=>move(-1)} disabled={value<=min} aria-label={words(locale,'降低半音','Semitone down','半音下げる')}>♭ −</button>
      <button type="button" onClick={()=>move(1)} disabled={value>=max} aria-label={words(locale,'升高半音','Semitone up','半音上げる')}>♯ +</button>
      <button type="button" onClick={()=>move(12)} disabled={value>=max} aria-label={words(locale,'升高八度','Octave up','1オクターブ上げる')}>+8</button>
    </div>
  </section>;
}

export function StaffRangePicker({settings,onMin,onMax}:{settings:ExerciseSettings;onMin:(value:number)=>void;onMax:(value:number)=>void}) {
  const {t,locale}=useI18n();
  return <div className="staff-range-picker"><p>{words(locale,'點選譜線或上下拖移音符，選出練習的最低音與最高音；♭／♯ 微調半音，±8 切換八度。','Tap the staff or drag vertically to choose the lowest and highest notes. Use ♭/♯ for semitones and ±8 for octaves.','譜面をタップ、または上下にドラッグして最低音と最高音を選びます。♭／♯で半音、±8でオクターブを調整します。')}</p>
    <div className="staff-range-pair">
      <PitchStaff label={t('minimum')} value={settings.rangeMinMidi} min={21} max={settings.rangeMaxMidi-1} clef={settings.clef==='grand'?'bass':settings.clef} onChange={onMin}/>
      <PitchStaff label={t('maximum')} value={settings.rangeMaxMidi} min={settings.rangeMinMidi+1} max={108} clef={settings.clef==='grand'?'treble':settings.clef} onChange={onMax}/>
    </div>
  </div>;
}
