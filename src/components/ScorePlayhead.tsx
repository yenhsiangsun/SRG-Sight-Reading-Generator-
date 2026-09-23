import {useCallback,useEffect,useMemo,useRef,type KeyboardEvent,type PointerEvent} from 'react';
import type {ExerciseData} from '../music';
import type {PlaybackMode,PlaybackStatus} from '../audio/PlaybackController';
import {measureTimeline} from '../audio/tempo';
import {findCursor,hitTest,type ScoreLayout} from '../notation/scoreGeometry';
import {useI18n} from '../i18n/context';

export interface ScorePlayback {
  status: PlaybackStatus;
  mode: PlaybackMode;
  getPosition: () => number;
  onSeek: (seconds: number) => void;
}

type Gesture = {id:number;drag:boolean;startX:number;startY:number;seconds:number};

/** Animates only the overlay. Engraved SVG and React's exercise state stay untouched. */
export default function ScorePlayhead({exercise,bpm,layout,playback,follow}: {
  exercise:ExerciseData;bpm:number;layout:ScoreLayout;playback:ScorePlayback;follow:boolean;
}) {
  const {t}=useI18n();
  const overlayRef=useRef<HTMLDivElement>(null);
  const cursorRef=useRef<HTMLDivElement>(null);
  const gesture=useRef<Gesture|null>(null);
  const previewSeconds=useRef<number|null>(null);
  const lastRow=useRef(-1);
  const bars=useMemo(()=>measureTimeline(exercise,bpm),[exercise,bpm]);
  const duration=bars.length?bars[bars.length-1].start+bars[bars.length-1].duration:0;
  const enabled=playback.status!=='starting' && !(playback.mode==='metronome'&&playback.status!=='idle');
  const moving=playback.status==='playing' && playback.mode==='score';
  const {getPosition,onSeek}=playback;

  const paint=useCallback((seconds:number,autoFollow=false)=>{
    const cursor=cursorRef.current;
    if(!cursor)return;
    const point=findCursor(layout,exercise,bpm,seconds);
    if(!point)return;
    cursor.style.transform=`translate3d(${point.x-12}px,${point.y}px,0)`;
    cursor.style.height=`${point.height}px`;
    const accessibleTime=String(Math.round(point.seconds*10)/10);
    if(cursor.getAttribute('aria-valuenow')!==accessibleTime)cursor.setAttribute('aria-valuenow',accessibleTime);
    const accessibleText=`${t('cursorMeasure')} ${point.measureIndex+1} · ${Math.floor(point.seconds/60)}:${String(Math.floor(point.seconds%60)).padStart(2,'0')}`;
    if(cursor.getAttribute('aria-valuetext')!==accessibleText)cursor.setAttribute('aria-valuetext',accessibleText);
    cursor.dataset.measure=String(point.measureIndex+1);
    cursor.dataset.seconds=String(point.seconds);
    if(!autoFollow)return;
    const rect=cursor.getBoundingClientRect();
    const scroller=overlayRef.current?.closest('.score-scroll');
    if(scroller){
      const bounds=scroller.getBoundingClientRect();
      if(rect.left<bounds.left+20 || rect.right>bounds.right-20){
        scroller.scrollLeft+=rect.left-bounds.left-scroller.clientWidth*.35;
      }
    }
    if(point.row!==lastRow.current){
      lastRow.current=point.row;
      if(rect.top<60 || rect.bottom>window.innerHeight-35){
        cursor.scrollIntoView({block:'center',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      }
    }
  },[layout,exercise,bpm,t]);

  useEffect(()=>{
    let frame=0;
    lastRow.current=-1;
    const update=()=>{
      paint(previewSeconds.current??getPosition(),moving&&follow&&previewSeconds.current===null);
      // Paused/idle seeking paints in its pointer or keyboard handler; animate only during playback.
      if(moving)frame=requestAnimationFrame(update);
    };
    update();
    return()=>cancelAnimationFrame(frame);
  },[paint,getPosition,moving,follow,playback.status,playback.mode]);

  const positionAt=(event:PointerEvent<HTMLDivElement>)=>{
    const bounds=overlayRef.current!.getBoundingClientRect();
    return hitTest(layout,exercise,bpm,(event.clientX-bounds.left)*layout.width/bounds.width,(event.clientY-bounds.top)*layout.height/bounds.height);
  };
  const down=(event:PointerEvent<HTMLDivElement>)=>{
    if(!enabled || !event.isPrimary || event.button!==0 || gesture.current)return;
    const handle=(event.target as Element).closest('.score-playhead');
    const drag=event.pointerType==='mouse'||!!handle;
    const seconds=positionAt(event);
    gesture.current={id:event.pointerId,drag,startX:event.clientX,startY:event.clientY,seconds};
    if(drag){
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      previewSeconds.current=seconds;
      cursorRef.current?.classList.add('is-dragging');
      paint(seconds);
    }
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const current=gesture.current;
    if(!current||current.id!==event.pointerId)return;
    if(!current.drag)return;
    current.seconds=positionAt(event);
    previewSeconds.current=current.seconds;
    paint(current.seconds);
  };
  const cancel=()=>{
    gesture.current=null;
    previewSeconds.current=null;
    cursorRef.current?.classList.remove('is-dragging');
    paint(getPosition());
  };
  const up=(event:PointerEvent<HTMLDivElement>)=>{
    const current=gesture.current;
    if(!current||current.id!==event.pointerId)return;
    const tapped=Math.hypot(event.clientX-current.startX,event.clientY-current.startY)<8;
    if(enabled&&(current.drag||tapped)){
      const seconds=positionAt(event);
      onSeek(seconds);
      paint(seconds);
      cursorRef.current?.focus({preventScroll:true});
    }
    gesture.current=null;
    previewSeconds.current=null;
    cursorRef.current?.classList.remove('is-dragging');
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(!enabled)return;
    const current=getPosition();
    const stops=layout.measures.flatMap((measure,index)=>measure.anchors.filter(anchor=>anchor.units<measure.totalUnits).map(anchor=>bars[index].start+anchor.units*bars[index].secondsPerUnit));
    let target:number|undefined;
    if(event.key==='Home')target=0;
    if(event.key==='End')target=duration;
    if(event.key==='ArrowRight'||event.key==='ArrowDown')target=stops.find(value=>value>current+.001)??duration;
    if(event.key==='ArrowLeft'||event.key==='ArrowUp')target=stops.filter(value=>value<current-.001).at(-1)??0;
    if(target===undefined)return;
    event.preventDefault();onSeek(target);paint(target);
    cursorRef.current?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  };

  return <div ref={overlayRef} className={'score-playback-overlay'+(enabled?'':' is-disabled')}
    style={{width:layout.width,height:layout.height}} onPointerDown={down} onPointerMove={move}
    onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}}>
    <div ref={cursorRef} className={'score-playhead'+(moving?' is-playing':'')} role="slider" tabIndex={enabled?0:-1}
      aria-label={t('playbackPosition')} aria-valuemin={0} aria-valuemax={duration} aria-valuenow={0} aria-disabled={!enabled}
      aria-orientation="horizontal" onKeyDown={keyDown} title={t('cursorKeyboardHelp')}>
      <span className="score-playhead-grip" aria-hidden="true">↔</span><span className="score-playhead-line" aria-hidden="true"/>
    </div>
  </div>;
}
