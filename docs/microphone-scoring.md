# Microphone timing and duration feedback

The monophonic assessment reports pitch, rhythm, completion, note length and
extra attacks. Completion still means that a written note was heard; it does
not imply that the note lasted long enough.

Rhythm now requires a matched onset within its timing tolerance and sufficient
voiced duration. Extra unmatched attacks inside the score reduce the rhythm
score, including attacks in written rests. Pre-roll and post-score audio do
not count as extra attacks. The existing onset detector ignores gentle vibrato
and isolated pitch spikes.

Duration uses the union of short intervals around valid observations, so two
brief detections do not fill the silence between them. The target is 65% of
the playback note length, with one observation of boundary tolerance. Existing
staccato and tenuto marks therefore set different targets automatically.

For piano, guitar, bass guitar, Chinese plucked strings, yangqin and yunluo,
the required voiced interval is capped at 180 ms to allow natural decay below
the pitch detector's threshold. The result panel identifies this allowance.
This is a conservative practice heuristic, not a measurement of finger release
or dampening. These thresholds have not been validated against recorded
performances on physical iPads.

Regression cases cover 50 ms blips, normal sustained notes, staccato/tenuto,
natural decay, extra wrong notes, attacks in rests, gentle vibrato, interrupted
coverage, calibration offsets and sounds outside the score. A 50 ms blip no
longer passes as a full quarter note; two correct written attacks plus one
extra attack earn a rhythm score of 67%, not 100%.
