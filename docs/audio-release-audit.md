# Audio release audit

Reviewed 2026-10-15. This audit prepares a future store build; it is not a claim that the currently installed TestFlight build has been replaced or that a store has approved the app.

## Current playback and release decision

Production playback is determined by `src/audio/createPlaybackInstrument.ts` → `getPlaybackSoundProfile` → `src/audio/playbackProfiles.ts`, not by the presence of a bank in `sampleManifest.json` alone.

- Erhu and Gaohu use the recorded Violin substitute. Zhonghu uses recorded Viola.
- Pipa uses the recorded Guitar substitute in packaged builds. The old Pipa manifest entry is historical and does not cause those recital extracts to play in production.
- The user-supplied Pipa library in ignored `pipa-preview.local/` is enabled only by Vite's `serve` command after all nine local WAV files are found. It is not included in Git or packaged builds.
- No playback profile, sample waveform, instrument range, transposition, score-generation rule or local preview was changed by this release cleanup.

The production asset copier excludes these complete directories:

| Source directory retained in the repository | Reason for exclusion |
| --- | --- |
| `public/samples/erhu/` | Previous rejected recordings; not selected by the production Erhu route |
| `public/samples/erhu-bisa/` | Rejected BISA recording trial; precise collection license version remains unresolved in the older audit; no active route uses it |
| `public/samples/pipa/` | Old recital excerpts; no active packaged Pipa route uses them |

`build/releasePublicAssets.ts` replaces Vite's blanket public-directory copy during builds only. The copier retains all other public assets and the original `samples/CREDITS.txt` plus remaining source/provenance records. It checks every bank reachable through production playback routing before copying and fails if an active sample would be excluded or missing. It also rejects archived files left in an uncleared output directory. It never deletes the source recordings.

Development mode keeps Vite's usual public-directory handling, so historical audition pages and existing source tests remain usable. Any future decision to restore one of these banks must explicitly resolve its source quality/rights and update the release rule; a manifest change cannot silently ship a blocked bank.

## Active source permissions and attribution

Code licenses and recording licenses are separate. The MIT license for a sampler or playback package is not permission to distribute every recording it can load. A library permitting commercial compositions also does not necessarily permit embedding reusable WAV files in an app.

| Active source family | Source evidence rechecked | Required handling |
| --- | --- | --- |
| Distributed `tonejs-instruments` MP3s, including current Guitar and Violin substitutes | Upstream explicitly separates MIT software from **CC BY 3.0 samples**. [Official license](https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/LICENSE.md) | Retain distributor/original-source credit, license link and modification information in the bundled credits. The samples are not project-owned recordings |
| VSCO 2 Community Edition | Official source repository identifies **CC0 1.0** and the recording/cutting contributors. [Official repository](https://github.com/sgossner/VSCO-2-CE) | Retain provenance and existing credits |
| VCSL recordings, including Harmonica, Vibraphone and selected Western additions | Official project explicitly permits software use, including commercial software, under **CC0**. [Official repository](https://github.com/sgossner/VCSL) | Retain pinned source revisions, source hashes and processing records |
| University of Iowa MIS solo strings and additional Western roots | The source owner states the recordings may be used in any projects without restrictions and specifically includes application developers. [Official MIS page](https://theremin.music.uiowa.edu/MIS.html) | Preserve original source URLs and processing records; do not describe these as newly recorded by the app |
| Voice: owstu, Freesound 555984 | Exact source page currently identifies **CC0**. [Source recording](https://freesound.org/people/owstu/sounds/555984/) | Keep the credit's distinction that the app processes a public MP3 preview rather than shipping the original uploaded WAV |
| Guzheng: Pufermufin, Freesound 396868 | Exact source page currently identifies **CC0**. [Source recording](https://freesound.org/people/Pufermufin/sounds/396868/) | Preserve original hash, crop times, tuning and fade details |
| C-dizi: Hypnotriod pack 21613 | Current accessible A5 source page identifies **CC0**; local per-file provenance records the exact source for all 15 roots. The G5/384940 page could not be retrieved by the web reader during this recheck; this is not evidence of a changed license. [Pack](https://freesound.org/people/Hypnotriod/packs/21613/), [exact accessible root](https://freesound.org/people/Hypnotriod/sounds/384938/) | Retain all per-file source/license records and the existing disclosure that this is one shared C-dizi bank with repitching |
| Hammered Dulcimer: iternetcone pack 19445 | All seven exact source pages were rechecked and identify **CC BY 4.0**: [342914](https://freesound.org/people/iternetcone/sounds/342914/), [342915](https://freesound.org/people/iternetcone/sounds/342915/), [342917](https://freesound.org/people/iternetcone/sounds/342917/), [342918](https://freesound.org/people/iternetcone/sounds/342918/), [342919](https://freesound.org/people/iternetcone/sounds/342919/), [342920](https://freesound.org/people/iternetcone/sounds/342920/), [342921](https://freesound.org/people/iternetcone/sounds/342921/) | Keep author, pack link, CC BY 4.0 link and explicit modification details in the app credits and per-root provenance |
| User-supplied Pianobook Pipa | Pianobook distinguishes composition use from redistribution of libraries whose copyright is not owned by the user. [Official FAQ](https://www.pianobook.co.uk/faq/) | Remains a development-only preview. Do not package it without separate redistribution permission from the relevant rights holder |

The older `docs/mobile-store-release.md` audio table describes an earlier state. Its statements that BISA Erhu and recital Pipa are production playback sources are superseded by the current routes and this audit. The old credits/provenance are kept as an evidence trail, not as an instruction to re-enable those recordings.

The app already exposes `samples/CREDITS.txt` through its sound-credits dialog. Keep that entry and file available in future releases. This source audit does not warrant rights beyond the permissions stated by the original publishers, and does not replace the final binary inspection before store submission.

## Verification

- `tests/audio-release.test.mjs` performs a real Vite build: archived paths are absent, active Guitar/Violin roots and relative-path range additions remain byte-identical, credits/worklet/companion assets remain, and source archives are untouched.
- The same suite verifies that a future active mapping into an excluded bank fails before creating an incomplete release, stale archived output is rejected, and source/output directories cannot overlap.
- Existing `tests/local-pipa.test.mjs`, `tests/erhu-samples.test.mjs` and `tests/pipa-samples.test.mjs` pass with source archives intact and production/development routing unchanged.
- An actual copy of the repository's current public assets verified all **449 active sample files across 23 routed banks** byte-for-byte, retained the credits unchanged, and confirmed all three archive directories absent from the output while their sources remained intact.
- A new store binary must be built and inspected after this change; TestFlight 1.0 (10) predates this cleanup.
