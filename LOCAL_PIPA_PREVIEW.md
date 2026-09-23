# Local Pipa preview

Eamon's Pipa.zip is user-supplied and is NOT licensed here for redistribution.
Pianobook FAQ: https://www.pianobook.co.uk/faq/
Instrument: https://www.pianobook.co.uk/packs/pipa/

`scripts/prepare-local-pipa.py <Pipa.zip>` prepares nine high-velocity plucks in
`pipa-preview.local/` (ignored by Git). Requires Python with numpy. Source filenames,
measured tuning and original author information remain in that local folder.
File octave labels use a different convention: a1 is sounding A2 (110 Hz).
The processing trims leading silence, corrects tuning, levels peaks and fades edges.
No original library audio is placed in public/, dist/, or source control.

Vite serves only the nine named WAVs during development. Production disables this
override and retains the existing distributable source. Restart Vite after preparing
the samples. The standalone pipa-check.html page uses the same playback factory as
the App. This prototype uses one loud pluck per pitch; it does not yet switch
velocity layers or round robins. Obtain the author's separate permission before
shipping these recordings in an App.
