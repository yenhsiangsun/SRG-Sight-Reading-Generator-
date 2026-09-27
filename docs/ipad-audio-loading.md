# Bundled instrument playback on iPad

## Failure found in the installed dependencies

The installed Capacitor 8.5.2 `WebViewAssetHandler.swift` sends a Foundation
`URLResponse` for WAV and MP3 assets, while non-media assets receive an
`HTTPURLResponse` with status 200. In a WKWebView this media response can surface
as fetch status 0. Tone 15.1.22's `ToneAudioBuffer.load()` rejects any response
whose `ok` property is false, before reading or decoding its body.

All referenced public samples were present in this checkout and its prior
`dist` and iOS public directories. Missing local files were not the observed
cause. The reported TestFlight binary has not been inspected on a physical iPad;
the custom-scheme failure is reproduced with response fixtures.

## Changes

- `loadRecordedSamples.ts` reads and decodes the actual bundled recordings, then
  passes AudioBuffers to Tone Sampler. This bypasses Tone's HTTP-only check.
- Status 0 is accepted only for a non-opaque response on the same `capacitor:`
  host as the application. HTTP errors, cross-host requests, empty files, HTML
  fallback pages, invalid headers and decoder failures are still rejected.
- Paths resolve against the document base URI, including web deployment
  subpaths. Production uses `public/samples` bundled by Vite and Capacitor;
  the existing developer-only Pipa preview stays developer-only.
- Only roots required by the score's actual sounding pitches are decoded. This
  includes both staves, chords and instrument transposition. Nearest-root
  selection matches Tone's original behavior, including its upper-root tie rule.
- At most three fetch/decode operations run at once. A failed or timed-out load
  aborts queued requests and releases decoded references. No synthetic substitute
  is silently played when a recording fails.
- All recorded instruments use this same loader. The full 85-root piano catalog
  remains available; a C4/D4/E4/G4 study loads four roots instead of all 85.
- The synthetic-instrument effects chain also had a routing bug: `connect()`
  returns its source node, not the destination. The loop now explicitly advances
  to each effect before connecting the final output, so the existing filters,
  modulation, reverb and compressor are audible rather than bypassed.
- Soprano sheng (`Sheng`) intentionally retains its original direct output at
  the user's request: the newly audible effects changed its accepted timbre.
  Oscillator partials, envelope, voice filter and volume remain unchanged. Other
  instruments keep the corrected effects chain.

## Verification, 2026-09-26

- 20 recorded instrument banks: Voice, Pipa, Erhu and 17 Western instruments.
- All 331 manifest assets exist with valid WAV/MP3 headers. Total compressed/PCM
  asset size is 174,303,644 bytes.
- All 331 files were actually decoded locally with the existing miniaudio tools:
  2,961.9 seconds total, nonempty finite and audible samples. This checks file
  integrity, not Safari's exact decoder or subjective timbre quality.
- Every remaining one of the 42 instrument profiles successfully constructs its
  synthesis graph in the adapter test, triggers a note and disposes all nodes.
- Regression tests cover native status 0, ordinary HTTP, subpaths, native and
  HTTP failures, opaque responses, bad data, timeout cleanup, concurrency limits,
  pitch-root selection, both hands/transposition and synth routing.

The iPad build needs a fresh `npm run build` and `npx cap sync ios`, followed by
an Xcode archive and TestFlight update. Test a recorded and synthetic instrument
with networking off, then switching instruments, stop/replay and app background
resume. No physical iPad verification is claimed here.
