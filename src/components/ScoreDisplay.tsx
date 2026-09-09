import {useI18n} from '../i18n/context';
import { drawGrandScore } from '../notation/drawGrandScore';
import { useEffect, useRef, useState } from 'react';
import { BarlineType, Formatter, Renderer, Stave } from 'vexflow';
import type { ExerciseData } from '../music';
import { createMeasureNotation } from '../notation/createMeasureNotation';

export default function ScoreDisplay({ exercise }: { exercise: ExerciseData }) {
  const {locale,t}=useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let previousWidth = -1;
    function drawScore() {
      if (!container) return;
      try {
        container.replaceChildren();
        const width = Math.max(container.clientWidth, 300);
        previousWidth = container.clientWidth;
        if (exercise.lowerMeasures) { drawGrandScore(container,exercise,width); container.querySelector('svg')?.setAttribute('aria-label',exercise.measures.length+' '+t('length')+' '+t('grand')); return; }
        const octaveAnnotation = exercise.transposition === 12 ? '8va' : exercise.transposition === -12 ? '8vb' : undefined;
        const barsPerRow = width < 720 ? 1 : 2;
        const rows = Math.ceil(exercise.measures.length / barsPerRow);
        const signature = exercise.tonality ? exercise.tonality.signature : exercise.keySignature;
        const prepared = exercise.measures.map((measure, index) => {
          const meter = measure.timeSignature ?? exercise.timeSignature;
          const previousMeter = index > 0 ? exercise.measures[index - 1].timeSignature ?? exercise.timeSignature : null;
          const notation = createMeasureNotation(measure, exercise.clef, signature ?? 'C', meter);
          const firstOfRow = index % barsPerRow === 0;
          const showTime = index === 0 || meter !== previousMeter;
          const measuringStave = new Stave(0, 0, 400);
          if (firstOfRow) { measuringStave.addClef(exercise.clef,undefined,octaveAnnotation); if(signature) measuringStave.addKeySignature(signature); }
          if (showTime) measuringStave.addTimeSignature(meter);
          const formatter = new Formatter().joinVoices([notation.voice]);
          const minWidth = formatter.preCalculateMinTotalWidth([notation.voice]);
          return { ...notation, formatter, meter, firstOfRow, showTime,
            neededWidth: minWidth + measuringStave.getNoteStartX() + (firstOfRow ? 18 : 10) + 48 };
        });
        // Keep equal bars per row (one on phones, two on wider screens). Dense music expands horizontally instead of colliding.
        const measureWidth = Math.max((width - 20) / barsPerRow, ...prepared.map(item => item.neededWidth));
        const lines = prepared.flatMap(item => item.notes.filter(note => !note.isRest()).flatMap(note => note.getKeyProps().map(key => key.line)));
        const above = Math.max(0, (Math.max(5, ...lines) - 5) * 10);
        const below = Math.max(0, (1 - Math.min(1, ...lines)) * 10);
        const rowHeight = Math.max(180, 140 + above + below);
        const renderer = new Renderer(container, Renderer.Backends.SVG);
        renderer.resize(measureWidth * barsPerRow + 20, rows * rowHeight + 45);
        const context = renderer.getContext();
        prepared.forEach((item, index) => {
          const x = 10 + (index % barsPerRow) * measureWidth;
          const y = Math.floor(index / barsPerRow) * rowHeight + 25 + above;
          const stave = new Stave(x, y, measureWidth);
          if (item.firstOfRow) { stave.addClef(exercise.clef,undefined,octaveAnnotation); if(signature) stave.addKeySignature(signature); }
          if (item.showTime) stave.addTimeSignature(item.meter);
          stave.setBegBarType(index > 0 && item.firstOfRow ? BarlineType.SINGLE : BarlineType.NONE);
          stave.setEndBarType(index === prepared.length - 1 ? BarlineType.END : BarlineType.SINGLE);
          stave.setContext(context).draw();
          stave.setNoteStartX(stave.getNoteStartX() + (item.firstOfRow ? 18 : 10));
          item.formatter.format([item.voice], Math.max(60, stave.getNoteEndX() - stave.getNoteStartX() - 12));
          item.voice.draw(context, stave);
          item.beams.forEach(beam => beam.setContext(context).draw());
          context.save();
          context.setFont('Arial', 10);
          context.setFillStyle('#7d8492');
          context.fillText(String(index + 1), x + 1, y + 8);
          context.restore();
        });
        container.querySelector('svg')?.setAttribute('aria-label', exercise.measures.length+' '+t('length')+' '+t('score'));
      } catch (cause) {
        container.replaceChildren();
        setError(cause instanceof Error ? cause.message : '譜面無法完成排版，請重新產生。');
      }
    }
    setError('');
    drawScore();
    const observer = new ResizeObserver(() => {
      if (container.clientWidth !== previousWidth) drawScore();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [exercise,locale,t]);

  return <>{error && <p className="error-message" role="alert">{locale==='zh-TW'?error:t('error')}</p>}<div ref={containerRef} className="score-container" /></>;
}
