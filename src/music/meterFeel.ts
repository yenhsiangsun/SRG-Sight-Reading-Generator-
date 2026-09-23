import type {MeasureData, TimeSignature} from '../music';
import {rhythmTicks} from './rhythmTiming';

/** Musical pulses, independent of the BPM display's quarter/eighth counting unit. */
export function pulseGroups(measure: Pick<MeasureData, 'timeSignature' | 'groups'>, fallback: TimeSignature = '4/4'): number[] {
  const meter = measure.timeSignature ?? fallback;
  if (meter === '6/8') return [6,6];
  if (meter === '9/8') return [6,6,6];
  if (meter === '12/8') return [6,6,6,6];
  if (meter === '3/8') return [6];
  if (meter === '7/8') return measure.groups?.length ? measure.groups : [4,4,6];
  // 5/4 retains five quarter pulses; its larger 3+2 beam grouping is a separate layer.
  return Array(Number(meter.split('/')[0])).fill(4);
}

export function metricPosition(measure: Pick<MeasureData, 'timeSignature' | 'groups'>, units: number, fallback: TimeSignature = '4/4') {
  const meter = measure.timeSignature ?? fallback, groups = pulseGroups(measure,fallback);
  let start = 0, group = 0;
  while (group < groups.length-1 && rhythmTicks(units) >= rhythmTicks(start+groups[group])) start += groups[group++];
  const offset = units-start, onPulse = rhythmTicks(offset) === 0, downbeat = onPulse && group === 0;
  const compound = ['6/8','9/8','12/8'].includes(meter);
  // Natural metric weight is not a printed accent. Subdivisions stay audible.
  const gain = downbeat ? 1 : onPulse
    ? (meter === '4/4' && group === 2 || meter === '12/8' && group === 2 ? .93 : .88)
    : rhythmTicks(offset) % 24 === 0 ? .76 : .68;
  return {group, start, units:groups[group], offset, onPulse, downbeat, compound, gain};
}
