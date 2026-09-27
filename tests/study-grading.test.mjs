import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',
  timeSignature:'4/4',rhythmLevel:'simple',measures:8,tempo:80,range:{min:55,max:90},allowAccidentals:false,
  mixedMeters:false,meters:['4/4','6/8'],tonic:'C',scaleId:'major'};
const {composeExercise}=loadModule('src/music/composeExercise.ts',2719);
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');

test('simple studies sustain half notes on readable beats and budget one incidental triplet across both hands',()=>{
  for(const timeSignature of ['2/4','3/4','4/4'])for(const grandMode of [undefined,'two-hand'])for(let i=0;i<8;i++) {
    const options={...base,timeSignature,range:grandMode?{min:48,max:84}:base.range};
    const exercise=composeExercise(options,grandMode);
    validateGeneratedExercise(exercise,options.range,false);
    const bars=[...exercise.measures,...exercise.lowerMeasures??[]],notes=bars.flatMap(bar=>bar.events);
    assert.ok(notes.some(n=>!n.rest&&n.duration==='h'&&n.durationUnits===8));
    assert.ok(notes.filter(n=>n.tuplet).length<=3);
    for(const bar of bars) {
      assert.equal(bar.events.reduce((sum,n)=>sum+Math.round(n.durationUnits*12),0),bar.totalUnits*12);
      for(const note of bar.events.filter(n=>n.durationUnits===8)) {
        assert.equal(note.duration,'h');assert.equal(note.dots,0);assert.equal(note.startUnits%8,0);
      }
    }
    const totalUnits=exercise.measures.reduce((sum,bar)=>sum+bar.totalUnits,0);
    assert.equal(createPlaybackEvents(exercise,80).duration,totalUnits/4*60/80);
  }
});

test('actual composed tiers separate note density, rhythm changes and pitch movement without changing form',()=>{
  for(const timeSignature of ['4/4','6/8']) {
    const statistics=['beginner','intermediate','advanced'].map(difficulty=>{
      let distance=0,intervals=0;
      const rhythmStats=['simple','medium','complex'].map(rhythmLevel=>{
        let count=0,changes=0,sixteenths=0;
        for(let sample=0;sample<20;sample++) {
          const exercise=composeExercise({...base,timeSignature,difficulty,rhythmLevel});
          const notes=exercise.measures.flatMap(bar=>bar.events).filter(n=>!n.rest);
          assert.equal(notes.at(-1).midi%12,0,'keep the modal ending');
          count+=notes.length;sixteenths+=notes.filter(n=>n.durationUnits===1).length;
          for(let i=1;i<notes.length;i++) {
            distance+=Math.abs(notes[i].midi-notes[i-1].midi);intervals++;
            changes+=Number(notes[i].durationUnits!==notes[i-1].durationUnits);
          }
        }
        return {count,changes,share:sixteenths/count};
      });
      assert.ok(rhythmStats[0].count<rhythmStats[1].count*.9,`${timeSignature}/${difficulty}: ${JSON.stringify(rhythmStats)}`);
      assert.ok(rhythmStats[1].count<rhythmStats[2].count*.92);
      // Compound beats retain long-short cells; dense repeated sixteenths can have fewer duration changes.
      assert.ok(rhythmStats[0].changes<rhythmStats[1].changes*(timeSignature.endsWith('/8')?.9:.8), `${timeSignature}/${difficulty}: ${JSON.stringify(rhythmStats)}`);
      assert.ok(rhythmStats[2].share>rhythmStats[1].share+.15);
      return distance/intervals;
    });
    assert.ok(statistics[1]>statistics[0]+1,`${timeSignature}: ${statistics}`);
    assert.ok(statistics[2]>statistics[1]+1,`${timeSignature}: ${statistics}`);
  }
});
