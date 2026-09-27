# Pipa technique studies

Techniques decorate an already composed melody when expression practice is enabled. They do not replace rhythm, transpose melody, or introduce pitches outside the selected modal material/range. There is at most one marked technique per two-bar region, with a lower overall budget for beginners. Unsupported registers simply omit that technique.

- Five separated rays indicate a five-finger roll on one sustained upper-string note; the mark applies to that note's written duration.
- Straight brush arrows and arpeggio waves use VexFlow strokes. Their sounding pitches occupy different adjacent strings with a conservative maximum four-semitone stopped-fret spread. Larger chords require an open string. The melody stays the highest pitch; supporting notes come from the current mode and planned harmonic center.
- Open-string double stops retain both pitches without displaying a fingering digit. Standard tuning is A2–D3–E3–A3.

Sources: [Moshe Denburg / VICO practical pipa guide, pp. 3, 5–6](https://www.atlasensemble.nl/assets/images/practical%20info/Pipa%20by%20Moshe%20Denburg%20VICO.pdf), [Patty Chan, Centre for Music Innovations](https://musinno.com/plucked-strings-pipa-%E7%90%B5%E7%90%B6/). The user's exam photos informed the choice of techniques and phrase roles; no exam melody is copied.

Playback approximates roll timing with repeated attacks and brush/arpeggio timing with staggered notes. It uses the existing pipa recordings. It does **not** contain separately recorded finger-roll or brush samples. The collapsed expression guide explains this in all 12 languages. Microphone assessment removes both techniques and chords from its displayed and scored melody to avoid scoring approximated ornament attacks as written notes.

Regression tests cover fingering, modal range, unchanged melody and timing, sparse placement, unchanged scoring onsets, playback boundaries, and saved-score validation. `tests/fixtures/pipa-techniques.html` is a manual SVG/PDF-renderer fixture for visual placement of all four techniques. This conservative fingering subset still needs an experienced pipa player's review before claiming exam-standard technique pedagogy.
