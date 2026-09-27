# Practice improvements (2026-09-23)

This change implements selected audit items 1, 2, 3, 4, 5, 6 and 8.

## 1. Saved studies and tempo

`audio/tempo.ts` defines the supported integer BPM range, 40–400. Scores and
presets use the same validator on both save and restore; malformed entries fail
before a success message. Opening a preset preserves its saved BPM instead of
passing the preceding exercise's tempo into random tempo selection.

Normal new studies still use the existing quarter-note 48–160 range and density
guard. Opening /8 meters display the equivalent eighth-note BPM. The free
metronome still reaches 400. This cannot recover entries that a previous version
already removed from browser storage.

## 2. Shared musical direction

`music/phraseHarmony.ts` plans modal pitch centers before auditioning melody
candidates. Both hands and instrument harmony consult this same plan. Strong
beats favor its tones, the bass favors its root, and the final bar returns to the
modal center when the range permits. Passing tones, characteristic modal notes,
existing minority two-bar contours and graded interval limits remain available.

Only tones belonging to the actual mode are used. Atonal studies and studies
with extra chromatic notes bypass this plan. These are pitch-set practice
heuristics, not claims to reproduce every culture's traditional composition
grammar. Candidate generation is still bounded to three attempts.

## 3. Instrument-sensitive movement

Wind/voice rhythm planning can reserve an eighth-note rest at internal four-bar
boundaries. It never cuts a tuplet or changes the final held cadence. Existing
rests are retained; strings and keyboards do not receive this breathing rule.
Rapid consecutive wide jumps receive a candidate-selection penalty. Valid pipa
and sheng voicings are ranked by movement to neighboring notes and nearby
selected chords, including across a barline.

These preferences supplement the existing physical chord checks. They do not
model every fingering, string crossing, breath capacity or instrument variant.
See `instrument-harmony.md` for the supported sheng button layouts.

## 4. Gradual suggestions

`practice/training.ts` retains at most 100 local attempts, deduplicated by study.
Only reliable captures with confidence >= 88%, completion >= 70%, and no detected
clipping enter this history. Recommendations require three distinct attempts
with matching instrument, staff, expression setting, pitch/rhythm levels, range, focus, accidental option
and meter settings, at comparable quarter-note speeds (within 8 BPM or 15%).

Three strong attempts (pitch/rhythm >= 90%, completion >= 95%) suggest raising
one level on one axis. Repeated scores below 70% suggest reducing that axis.
At the ends of the level ladder, tempo may change instead. Increases respect the
generated study's ceiling; reductions stay above its floor. The user explicitly applies the suggestion; ordinary controls
stay available. Applying a level suggestion preserves BPM. Recordings are not
saved to this history or uploaded.

## 5. Targeted practice

The existing collapsed Practice Tools now includes triplets, offbeats within a
beat, interval leaps and 4/4–6/8 changes, alongside dotted/sixteenth studies.
Skills can be selected together. Compatible rhythmic cells are distributed in
shuffled rounds so dotted/sixteenth and other combinations share one score.
Triplets use /4 meters; mixed-meter studies contain at least four bars and keep
the natural /8 pulse. Interval practice preserves the selected rhythm level,
including when chosen without another skill. Range, mode and pitch-grade leap
limits remain in force. Weakness recommendations distinguish these cases when the assessment
has enough heard notes. Cross-beat tied syncopations are not added in this pass.

The score page also has a collapsed Range and Difficulty panel with the existing
interactive staff range picker, clef, independent pitch/rhythm levels and extra
chromatic-note setting. Edits are drafts until Apply generates a new score;
generation failure keeps the previous score and saved settings. Playback and
active assessments disable these controls. Next-study generation and saved
presets retain the applied range and all focused skills. Legacy single-focus
library entries and training contexts continue to work.

## 6. Monophonic capture and calibration

The capture worklet now emits overlapping 2048-sample windows every 512 samples
(about 11 ms between analyses at 48 kHz). Stable pitch changes, silence gaps and
amplitude re-attacks inform onset detection; detected onsets are assigned only
once in temporal order. The following attack bounds each note's pitch window.
Clipped captures are excluded from reliable grading. Written rests get a
separate silence score; staccato releases are not treated as written rests.

Calibration is associated with a locally hashed microphone identity, sample
rate, selected output type, and output sink where the browser exposes it. The
route is checked before the count-in. Unknown routes request calibration;
returning to a saved route reuses its result. Legacy calibration without device
identity requires confirmation through a new calibration. Failed storage still
allows the current session's calibration to work.

Browsers cannot identify every physical headphone change, especially on Safari.
Users choose speakers/wired/Bluetooth and can recalibrate after a device change.
The method estimates recording/output plus performance timing from eight played
notes; it is not a laboratory measurement of hardware latency alone. Polyphonic
grading remains unsupported. Automated tests use synthetic frames and mocked
device lifecycle; real instrument/iPad microphone validation remains necessary.

## 8. Focused tablet reading

The score page offers Focus Reading plus independent score engraving size
(80–150%). Portrait and landscape sizes are stored separately. A larger size
reflows systems instead of stretching the entire page. The companion and extra
navigation/tools are hidden in focus mode; playback controls and an exit button
remain available. Escape also exits on keyboards.

VexFlow SVG CSS dimensions, playback geometry, pointer seeking and feedback
markers use the same scale. PDF export continues using its own page layout.

## Verification

- Full suite: 272 tests passed, including strict VexFlow voices, mixed meters,
  tuplets, modal range/leap limits, saved harmony and playback timing.
- Added regression coverage for high-BPM saving, harmonic-plan membership,
  breathing, targeted patterns, three-attempt advice, route-specific calibration,
  short/repeated attacks, rests/clipping and scaled cursor geometry.
- Browser: generated and played a triplet-focused study; checked moving cursor,
  scaled engraving/overlay alignment, focus entry/exit, and independent portrait
  and landscape settings. This checks responsive browser behavior, not native
  iPad hardware or its audio input.
- Browser follow-up: changed the staff range via keyboard and note menus,
  applied independent difficulty levels without leaving the score, generated
  dotted plus sixteenth practice, verified selection retention and playback
  edit-locking, and checked the new controls at tablet and phone widths.
- Production build succeeds; pre-existing large-bundle warning remains. Lint
  retains the existing `MobileInstallPrompt.tsx` effect warning.

New sound banks, cloud backup and offline/startup work were not part of the
selected scope. No commit or push is performed by this change.

## Follow-up audit items 1–5 (2026-09-28)

- Scale practice consults the shared harmonic plan and actual upper-hand pulse
  arrivals when selecting lower-hand pitches. Leap practice preserves the final
  three sounded notes, retaining the original cadence preparation.
- Neither the leap focus nor its assessment shortcut forces a Simple rhythm.
- Assessment now reports duration and unmatched extra attacks; rhythm credit
  requires sufficient observed duration. See `microphone-scoring.md` for decay
  allowances and the limits of synthetic-frame validation.
- Recorded samples use a context/URL-keyed LRU of at most 32 MiB and 64 decoded
  entries. Stop, replay, seek and unmount cancel pending fetches; a late,
  noncancelable decode is discarded. Developer Pipa preview bypasses the cache.
- `practice/resume.ts` validates one local score snapshot containing the exact
  exercise, settings, BPM, stable session ID and playback position. The hook
  saves changes once per second, on leaving practice, pagehide and visibility
  changes. Home offers Continue last practice; resumption seeks without playing.
  Invalid data is ignored, and failed storage produces a localized warning while
  retaining the in-memory snapshot. This is local to each browser/app install.

The integrated suite passes 338 tests, production build succeeds and assets were
copied into the local iOS project. Browser reload restored identical score SVG
content, BPM and a nonzero playhead without autoplay. This does not publish a
TestFlight build or validate real iPad microphone measurements. Existing lint
and bundle-size warnings remain unrelated to these changes.
