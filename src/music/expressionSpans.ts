import type {ExerciseData, ExpressionAnchor, ExpressionSpan} from '../music';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const before = (a: ExpressionAnchor, b: ExpressionAnchor) => a.bar < b.bar || (a.bar === b.bar && a.event < b.event);
export const expressionAddress = (staff: number, bar: number, event: number) => `${staff}:${bar}:${event}`;

/** Addresses refer to the original score events, including rests. Engraving may
 * consolidate rests without changing the saved score or these addresses. */
export function validExpressionSpan(value: unknown, exercise: Pick<ExerciseData,'measures'|'lowerMeasures'>): value is ExpressionSpan {
  if (!record(value) || !['slur','crescendo','diminuendo'].includes(String(value.kind)) || ![0,1].includes(Number(value.staff)) ||
    typeof value.staff !== 'number') return false;
  const measures = value.staff === 0 ? exercise.measures : exercise.lowerMeasures;
  if (!measures) return false;
  const anchor = (input: unknown): input is ExpressionAnchor => record(input) && Number.isInteger(input.bar) && Number.isInteger(input.event) &&
    typeof input.bar === 'number' && input.bar >= 0 && input.bar < measures.length && typeof input.event === 'number' &&
    input.event >= 0 && input.event < measures[input.bar].events.length;
  if (!anchor(value.start) || !anchor(value.end) || !before(value.start,value.end)) return false;
  if (measures[value.start.bar].events[value.start.event].rest || measures[value.end.bar].events[value.end.event].rest) return false;
  if (value.kind === 'slur') {
    for (let bar = value.start.bar; bar <= value.end.bar; bar++) {
      const first = bar === value.start.bar ? value.start.event : 0;
      const last = bar === value.end.bar ? value.end.event : measures[bar].events.length - 1;
      if (measures[bar].events.slice(first,last+1).some(note => note.rest)) return false;
    }
  }
  return true;
}

export function validExpressionSpans(value: unknown, exercise: Pick<ExerciseData,'measures'|'lowerMeasures'>): value is ExpressionSpan[] | undefined {
  return value === undefined || (Array.isArray(value) && value.length <= 128 && value.every(span => validExpressionSpan(span,exercise)));
}

export function scoreExpressionSpans(exercise: ExerciseData): ExpressionSpan[] {
  return (Array.isArray(exercise.expressionSpans) ? exercise.expressionSpans : []).filter(span => validExpressionSpan(span,exercise));
}

export interface PlaybackExpression {gain: number; legato: boolean}
/** Only attack strength and sounding length change; the score clock, pitch,
 * beat grid, rests and event addresses remain identical. */
export function playbackExpressionPlan(exercise: ExerciseData): Map<string,PlaybackExpression> {
  const result = new Map<string,PlaybackExpression>();
  const spans = scoreExpressionSpans(exercise);
  for (const span of spans.filter(span=>span.kind==='slur')) {
    const measures = span.staff === 0 ? exercise.measures : exercise.lowerMeasures!;
    for (let bar = span.start.bar; bar <= span.end.bar; bar++) {
      const first = bar === span.start.bar ? span.start.event : 0;
      const last = bar === span.end.bar ? span.end.event : measures[bar].events.length - 1;
      for (let event = first; event <= last; event++) {
        if (measures[bar].events[event].rest) continue;
        const key = expressionAddress(span.staff,bar,event), previous = result.get(key) ?? {gain:1,legato:false};
        // The last note releases normally; separate phrasing never merges attacks.
        result.set(key,{...previous,legato:previous.legato || bar !== span.end.bar || event !== span.end.event});
      }
    }
  }
  for (const [staff,measures] of [exercise.measures,...(exercise.lowerMeasures?[exercise.lowerMeasures]:[])].entries()) {
    const hairpins=spans.filter(span=>span.staff===staff&&span.kind!=='slur');
    if (!hairpins.length) continue;
    let offset=0;
    const events=measures.flatMap((measure,bar)=>{
      let onset=0;
      const entries=measure.events.map((note,event)=>{
        const item={note,bar,event,time:offset+(note.startUnits??onset)};onset+=note.durationUnits;return item;
      });
      offset+=measure.totalUnits??onset;return entries;
    });
    const positions=new Map(events.map((entry,index)=>[expressionAddress(staff,entry.bar,entry.event),index]));
    const plans=hairpins.map(span=>({kind:span.kind,start:positions.get(expressionAddress(staff,span.start.bar,span.start.event))!,
      end:positions.get(expressionAddress(staff,span.end.bar,span.end.event))!}));
    let heldGain=1,active: typeof plans[number] & {gain:number} | undefined;
    for (const [index,entry] of events.entries()) {
      if (entry.note.dynamic) {heldGain=1;active=undefined;}
      const start=plans.find(plan=>plan.start===index);
      if (start) active={...start,gain:heldGain};
      let gain=heldGain;
      if (active) {
        const begin=events[active.start].time,end=events[active.end].time;
        const progress=Math.max(0,Math.min(1,(entry.time-begin)/Math.max(.0001,end-begin)));
        gain=Math.max(.7,Math.min(1.3,active.gain*(1+(active.kind==='crescendo'?.18:-.18)*progress)));
        if (index>=active.end) {heldGain=gain;active=undefined;}
      }
      if (!entry.note.rest && (active || gain!==1 || start)) {
        const key=expressionAddress(staff,entry.bar,entry.event),previous=result.get(key)??{gain:1,legato:false};
        result.set(key,{...previous,gain});
      }
    }
  }
  return result;
}
