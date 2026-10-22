import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const quality=loadModule('src/music/exerciseQuality.ts');
const {describeTonality}=loadModule('src/music/scales.ts');
const range={min:48,max:90};
const base={instrument:'Piano',instrumentProfile:'Piano',clef:'treble',difficulty:'advanced',keySignature:'C',
  timeSignature:'4/4',rhythmLevel:'medium',measures:2,tempo:80,range,allowAccidentals:false,
  mixedMeters:false,meters:['4/4'],tonic:'C',scaleId:'major'};
const plain=value=>JSON.parse(JSON.stringify(value));
const bar=(pitches,units=pitches.map(()=>2))=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
  events:pitches.map((midi,index)=>({midi:midi??undefined,key:midi===null?'b/4':`${['c','c#','d','eb','e','f','f#','g','ab','a','bb','b'][midi%12]}/${Math.floor(midi/12)-1}`,
    octave:midi===null?4:Math.floor(midi/12)-1,rest:midi===null,duration:units[index]===4?'q':units[index]===1?'16':'8',dots:0,
    startUnits:units.slice(0,index).reduce((sum,n)=>sum+n,0),durationUnits:units[index]}))});
const exercise=(opening=[60,69,74,72,71,69,62,60])=>({...base,tonality:describeTonality('C','major'),
  measures:[bar(opening),bar([64,65,62,60],[4,4,4,4])],
  harmonyPlan:[0,1].map(index=>({root:0,pitches:[0,4,7],role:index?'arrive':'home'})),
  phrasePlan:[{startBar:0,endBar:1,role:'closing'}]});
const count=ex=>quality.reviewExercise(ex,range,false).rapidLeapContinuations;
const rhythm=ex=>JSON.stringify([ex.measures,ex.lowerMeasures??[]].map(staff=>staff.map(b=>({meter:b.timeSignature,
  events:b.events.map(n=>[n.startUnits,n.durationUnits,n.duration,n.dots,n.rest,n.tuplet])}))));

test('rapid continuation is a small preference; isolated leaps, slow arrivals and chord arpeggios remain welcome',()=>{
  const continued=exercise(),before=JSON.stringify(continued),review=quality.reviewExercise(continued,range,false);
  assert.equal(review.rapidLeapContinuations,1);
  assert.ok(review.penalty>0&&review.penalty<1,'a connection cannot outweigh one existing overload flag');
  assert.equal(JSON.stringify(continued),before,'review never edits pitches or timing');
  assert.equal(count(exercise([60,69,67,74,71,69,62,60])),0,'an isolated ninth-semitone leap may turn back naturally');
  assert.equal(count(exercise([60,67,72,71,69,67,62,60])),0,'C–G–C is a deliberate chord arpeggio');
  const slow=exercise();slow.measures[0]=bar([60,69,74,72,71,69,60],[2,4,2,2,2,2,2]);
  assert.equal(count(slow),0,'a sustained arrival gives the wide gesture room');
});

test('rests, phrase boundaries, final three notes and unplanned legacy material do not incur the new preference',()=>{
  assert.equal(count(exercise([60,null,69,74,71,69,62,60])),0,'a breath breaks the connection');
  const joined=exercise();joined.measures=[bar([60,60,60,60,60,60,60,69]),bar([74,72,71,69,67,65,62,60])];
  assert.equal(count(joined),1,'a continuous connection can cross an ordinary barline');
  joined.phrasePlan=[{startBar:0,endBar:0,role:'opening'},{startBar:1,endBar:1,role:'closing'}];
  assert.equal(count(joined),0,'a new planned phrase keeps its register contrast');
  const ending=exercise([60,62,64,65,67,65,64,62]);ending.measures[1]=bar([60,62,64,62,60,60,69,74]);
  assert.equal(count(ending),0,'the final preparation, approach and landing are exempt');
  const legacy=exercise();delete legacy.phrasePlan;assert.equal(count(legacy),0);
  const unsupported=exercise();delete unsupported.harmonyPlan;assert.equal(count(unsupported),0,'do not guess which gestures are chord arpeggios');
});

test('explicit leaps, atonal and extra-chromatic exercises bypass the new score; piano bass is not a second singing line',()=>{
  const source=exercise();
  assert.equal(quality.reviewExercise(source,range,false,'leaps').rapidLeapContinuations,0);
  assert.equal(quality.reviewExercise(source,range,true).rapidLeapContinuations,0);
  assert.equal(count({...source,tonality:describeTonality(null,'atonal')}),0);
  const piano=exercise([60,69,67,74,71,69,62,60]);piano.grandMode='two-hand';piano.lowerMeasures=source.measures;
  assert.equal(count(piano),0,'keep wide accompaniment figures independent');
});

test('bounded review can prefer a more connected legal candidate while retaining rhythm and wide-leap practice',()=>{
  const first=exercise(),second=exercise([60,69,67,74,71,69,62,60]),candidates=[first,second];let calls=0;
  const plan=first.measures.map(b=>({meter:b.timeSignature,notes:b.events.map(n=>({...n,units:n.durationUnits}))}));
  const api=loadModule('src/music/composeExercise.ts',7,undefined,{
    '../music':{createPracticeRhythmPlan:()=>plan,generatePracticeExercise:()=>candidates[calls++]},
    './modalPhrasing':{addModalPhrasing:x=>x},'./rareRhythm':{addRareThirtySeconds:x=>x},
  });
  const selected=api.composeExercise(base);
  assert.equal(selected,second);assert.equal(calls,2,'stop at an otherwise clear candidate, within the original three attempts');
  assert.equal(rhythm(first),rhythm(second));assert.equal(Math.max(...first.measures[0].events.map(n=>n.midi)),Math.max(...second.measures[0].events.map(n=>n.midi)));
  assert.ok(second.measures[0].events.some((n,index,notes)=>index&&Math.abs(n.midi-notes[index-1].midi)>=9),'retain an advanced leap');
  const explicit=loadModule('src/music/composeExercise.ts',7,undefined,{
    '../music':{createPracticeRhythmPlan:()=>plan,generatePracticeExercise:()=>exercise()},
    './modalPhrasing':{addModalPhrasing:x=>x},'./rareRhythm':{addRareThirtySeconds:x=>x},'./leapPractice':{addLeapPractice:x=>x},
    './exerciseQuality':{...quality,reviewExercise:(...args)=>{assert.equal(args[3],'leaps');return quality.reviewExercise(...args);}},
  });
  explicit.composeExercise({...base,pitchFocus:'leaps'});
});

test('representative modes, meters, ranges and instruments preserve timing, grading and physically checked harmony',()=>{
  const {composeExercise}=loadModule('src/music/composeExercise.ts',20261019);
  const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
  const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',20261019);
  const {isShengPracticeVoicing,isShengInstrument}=loadModule('src/music/shengFingering.ts');
  const {pipaDoubleStopFingering}=loadModule('src/music/pipaFingering.ts');
  const {refineFastPassages}=loadModule('src/music/tempoFlow.ts');
  const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
  let cases=0;
  for(const instrumentProfile of ['Sheng','Alto Sheng','Tenor Sheng','Bass Sheng','Pipa','Piano','Flute','Erhu'])
    for(const difficulty of ['beginner','intermediate','advanced'])for(const timeSignature of ['4/4','6/8','7/8']) {
      const profile=INSTRUMENTS[instrumentProfile],range=instrumentProfile==='Piano'?{min:36,max:84}:{min:profile.min,max:profile.max};
      const index=cases++,tonic=['C','D','F'][index%3],scaleId=['major','harmonic-minor','dorian','major-pentatonic'][index%4];
      const options={...base,instrument:profile.engineInstrument,instrumentProfile,difficulty,timeSignature,range,tonic,scaleId,
        measures:[2,4,8,16][index%4],rhythmLevel:['simple','medium','complex'][index%3],mixedMeters:index%2===0,meters:['4/4','6/8','7/8']};
      let ex=composeExercise(options,instrumentProfile==='Piano'?'two-hand':undefined);
      ex.soundProfile=instrumentProfile;
      ex=refineFastPassages(ex,range,instrumentProfile);
      quality.validateGeneratedExercise(ex,range,false);
      const before=plain(ex),withChords=addInstrumentHarmony(ex,range);
      assert.equal(rhythm(withChords),rhythm(ex));
      assert.equal(createPlaybackEvents(withChords,80).duration,createPlaybackEvents(ex,80).duration);
      assert.deepEqual(plain(ex),before,'adding playable accompaniment does not mutate the candidate');
      for(const b of [...withChords.measures,...withChords.lowerMeasures??[]])for(const n of b.events)if(n.chord){
        assert.ok(n.chord.every(p=>p.midi>=range.min&&p.midi<=range.max));
        if(isShengInstrument(instrumentProfile))assert.ok(isShengPracticeVoicing(n.chord.map(p=>p.midi),instrumentProfile));
        if(instrumentProfile==='Pipa')assert.ok(pipaDoubleStopFingering(n.chord));
      }
    }
  assert.equal(cases,72);
  for(const range of [{min:61,max:62},{min:65,max:69}])for(const scaleId of ['major','dorian','major-pentatonic']){
    const options={...base,range,scaleId,measures:8};
    quality.validateGeneratedExercise(composeExercise(options),range,false);
  }
});
