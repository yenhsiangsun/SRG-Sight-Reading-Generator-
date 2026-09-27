# Musical short studies (2026-09-26)

New scores now use whole-study melodic planning in `music/studyMelody.ts`, via
`composeExercise`. The earlier minority two-bar contour helper remains available
for its existing callers; the app's composition pipeline enables the complete
study plan explicitly. Saved scores retain their original notes.

## Musical direction

- Eight forms provide different register arcs: singing arch, question/answer,
  climbing sequence, returning wave, descending song, valley response, early peak,
  and terraced dialogue.
- Every sounded onset receives a scale-degree target. Phrases use varied two-,
  three- and four-bar proportions and continue their figure across barlines. A later
  answer recalls a gesture without duplicating or transposing a finished bar.
- Scale fragments, turns, thirds, and broken-chord figures share a vocabulary
  within the study. Initial/intermediate bowed-string studies (erhu, gaohu,
  zhonghu) favor scale fragments, turns, and thirds, informed by the supplied
  sight-reading examples. The supplied melodies were not transcribed/copied.
- The whole-path solver balances those targets against the chosen difficulty's
  interval bounds and the shared harmonic plan. Short connecting notes prefer
  manageable movement, while higher pitch grades retain wider spans and jumps.
- The final preparation, actual modal neighbour, and tonic are considered
  together. The penultimate harmonic role is now used for every study length,
  including 12 bars. Final tonic harmonies do not combine both major and minor
  thirds merely because a blues collection contains both.

These are on-device compositional rules and a bounded candidate search, **not a
connected generative-AI service**. They add no network dependency or API charge.
Musical enjoyment still needs listening/user feedback; structural tests cannot
prove that every randomly produced study will sound good.

## Preserved behavior and limits

Rhythms and rests are planned first, independently of pitch grade. The melody
stage preserves durations, tuplets, mixed meter, 6/8 grouping, selected rhythm
combinations, and playback timing. The existing range/leap validator and physical
instrument-harmony checks still apply. Performance marks decorate the resulting
line without changing its pitches. Piano hands keep independent rhythms and a
shared harmonic direction; monophonic grand staves are shaped as one voice.

As previously requested, atonal studies and explicitly extra-chromatic studies
bypass modal shaping. A custom range without the tonic is respected rather than
silently expanded for a cadence. Non-Western modes are represented by the app's
existing equal-tempered pitch collections; this is not a claim to model their
full traditional tuning, ornamentation, or composition grammar. The bowed-string
profiles do not yet claim validated bowing/fingering instruction.

## Regression evidence

### Difficulty refinement, 2026-09-27

The existing phrase roles, modal path solver and cadences remain in
place. Beginner melody targets use a narrower five-degree region, mainly scalar
figures and small turns, with stronger stepwise weighting and 2% optional
chromatic selection. Existing hard leap limits remain available for legal modal
cadences. Intermediate and advanced retain their broader figures.

Simple balanced rhythm recalls a smaller vocabulary more often. In 2/4, 3/4 and
4/4 it adds half-note holds before pitch composition, without crossing the
middle of 4/4. Medium uses fewer holds; complex retains its subdivisions. /8
simple rhythms favor quarters and dotted quarters while retaining occasional
sixteenths and the original beat grouping. Incidental simple triplets are capped
at one group per study; simple piano accompaniment adds no extra triplet group.
Explicit rhythm-focus drills retain their requested material. Pitch grade still
does not change rhythm level. Existing saved scores are not rewritten.

`tests/study-grading.test.mjs` checks the actual composed tiers statistically,
long-note notation and playback duration, and the two-hand triplet budget.

`tests/musical-study.test.mjs` checks full-note phrase coverage, eight forms and
four figure families, later responses, scale figures in every section, no
adjacent-bar copies across a seeded corpus, and independent grade separation.
It compares new/legacy 6/8 scalar connections while asserting identical playback
timing, checks modal cadences across study lengths/modes and narrow ranges, and
checks bowed-string profiles together with mixed targeted rhythms and expression.

The existing modal, phrase-composition, mixed-practice, notation, instrument
harmony, difficulty, and playback suites remain regression contracts. Browser
or desktop tests do not substitute for listening on the user's physical iPad.

### Musical scale focus

Scale focus uses the existing whole-study register arc with short scalar gestures,
turns, repeated-note pickups and small graded links. A local seeded planner varies
opening degrees and recalls gestures across two-bar phrases without copying bars.
A bounded pitch-path solver preserves the chosen rhythms, rests and mixed meters,
respects range and leap limits, and approaches the final modal tonic by scale step.
It does not require the final pitch to equal the opening pitch. Narrow ranges without
a tonic remain within range. Ordinary balanced generation is unchanged.

Scale regression tests cover all supported pitch collections, staff modes, saved
settings, rhythm combinations, timing, varied starts and rare adjacent-bar repetition.

### Rare subdivisions and variety (2026-09-27)

General medium rhythm studies have a 12% chance, complex 30%, to subdivide one
eighth-note span into four adjacent 32nds. Simple and dedicated rhythm
drills are unchanged. The draw occurs once after rhythm-plan selection, before
pitch candidates, and only in the melody, so two-hand studies still have at most
one group overall. Final landing notes and tuplets are excluded. Six internal
ticks per 32nd preserve exact timing. Engraving, mixed clefs, silent-staff rest
consolidation and saved-score validation all support the new duration.

Whole-study variety combines eight register arcs, four phrase-proportion plans,
three variants of each figure family and six modal harmonic paths. Internal
phrase endings follow the chosen phrase boundaries; the final modal cadence and
graded pitch limits remain. This is varied rule-based composition, not a claim
that every consecutive random score must have a unique form.
