# Phrase rhythm and candidate review

Implemented 2026-09-23. Applies to newly generated exercises; saved scores keep their original notes.

## Generation order

1. Select tonality with the existing readability policy.
2. Select the complete meter sequence, changing only at two-bar boundaries.
3. Plan rhythm before pitch. `phraseRhythm.ts` gives each four-bar section a small pulse-cell palette, interleaves fresh connecting cells, and starts a new palette at a meter change. Cells use actual pulse lengths: quarter beats in /4, dotted-quarter beats in compound meters, and 2+2+3 eighths in 7/8. Recalling a cell does not copy a whole measure or its pitches.
4. Reserve the final landing before drawing pitches: a sounded quarter or dotted quarter that reaches the barline. A 3/8 ending has an eighth approach followed by a quarter. Intermediate four-bar boundaries may ease the last pulse without ending the exercise.
5. Review three rhythm plans. Penalize sustained dense subdivision, weakly penalize copied subdivided bars, and preserve the chosen level's subdivision challenge. Ordinary repeated quarter/eighth pulses are useful, not defects. Triplets are occasional independent contrasts, not recalled palette cells. Focused dotted/sixteenth drills keep their selected focus apart from the closing landing.
6. `composeExercise.ts` tries at most three pitch candidates on the **same** rhythm, applies the existing two-bar contour and modal rules, and selects the least problematic legal candidate. The rhythm does not change with pitch difficulty or the chromatic switch.
7. Add existing instrument-specific harmony, select a playable tempo, and add contextual performance marks.

Two-hand grand scores now generate the entire lower voice continuously, with its own rhythm palette on the shared meter sequence. Previously the bass was generated independently one bar at a time. Grand monophonic instruments still distribute a single line between staves.

## Review boundaries

Hard checks reject inconsistent duration/spelling, out-of-range notes, forbidden scale outsiders, excessive grade-specific intervals, and mismatched staff boundaries. Musical preferences penalize exact adjacent-bar copies, excessive consecutive identical pitches, and long strings of wide leaps. They do **not** minimize average interval size or remove legitimate advanced challenges. A bounded review may retain some soft flags; it does not guarantee that a human will prefer every score.

Atonal and extra-chromatic exercises still bypass modal pitch shaping. All existing scale families remain available. The approach is a practice-generation heuristic, not a complete harmonic-composition system or a reconstruction of traditional performance grammar. Instrument fingerings remain enforced by the subsequent harmony stage.

## Verification

- `npm test`: 246 passed, including six new phrase-composition tests.
- `npm run build`: passed; existing bundle-size notice remains.
- `npm run lint`: no new issues; existing `MobileInstallPrompt.tsx` effect warning remains.
- New coverage checks all nine meters, all pitch/rhythm levels, 1/2/8-bar endings, all 33 scales, narrow ranges, grand voices, independent difficulty settings, harmony feasibility, playback end time, and bounded candidate rejection/selection.
- Existing contour placement, tier-separation, triplet, VexFlow, rest/beaming, mixed-tempo and playback tests pass. The random-tonality hook integration sample increased from 50 to 100 generations to reduce sensitivity to RNG consumption while retaining its diversity assertion and the 5% open-signature policy.
- Seed 92361, 100 eight-bar intermediate/medium C-major studies, G3–E6, alternating 4/4 and 6/8: zero eighth-or-shorter endings; zero adjacent bars with identical pitch/rest/duration content. Three retained soft quality flags; no structural violations. This is a reproducible sample, not a musical-quality guarantee.
- Browser: generated and visually inspected mixed 4/4–6/8 Sheng and advanced two-hand piano scores. Sheng playback returned to idle at the ending with no browser errors; piano score rendered with both hands, tuplets and octave lines.

No new controls are required. Click “產生下一份” to hear the new generation rules.
