# Content rights: release evidence and App Review note

Reviewed 2026-10-15 (Asia/Taipei). This record covers the current production source and bundled notices. It does not say that Apple has approved the app, that TestFlight has been updated, or that the publisher owns every third-party asset.

## Conclusion for the content-rights field

The production source contains third-party recordings, software and notation fonts. The appropriate answer is **Yes, the app contains/accesses third-party content and has the necessary rights**, based on the published permissions and retained notices described below. Do not select the answer saying that the app contains no third-party content.

The current evidence reasonably supports this answer for the present release configuration: 23 routed recorded banks (449 sample files), the permissive runtime packages and their embedded components, and the six unchanged VexFlow fonts. **Build 1.0 (12) contains 615 audio files in total: the 449 routed files plus 166 retained, unused source/previous-bank files. All 166 were separately checked on 2026-10-16 and belong to the same credited, permitted source families; see the binary follow-up below.** No bundled source was identified as noncommercial-only, no-derivatives-only, a paid proprietary sample library, or an unlicensed downloaded examination score. This is a source-and-license review, not a guarantee of exclusive title or an independent legal certification. Apple's [intellectual-property guidelines](https://developer.apple.com/app-store/review/guidelines/#intellectual-property) still make the publisher responsible for the submitted app.

Before a build is used for formal review, inspect that actual build for the exclusions and bundled notices below. A source audit alone does not inspect an uploaded IPA. The publisher has requested TestFlight testing before formal submission.

## Recordings actually selected in production

`src/audio/createPlaybackInstrument.ts`, `src/audio/playbackProfiles.ts` and `src/audio/sampleManifest.json` determine the playable recorded banks. `build/releasePublicAssets.ts` checks those routes and copies production public assets.

| Source | Current permission and evidence | Release obligation |
| --- | --- | --- |
| tonejs-instruments distributed MP3s | [Official license](https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/LICENSE.md) distinguishes MIT software from **CC BY 3.0 samples**. Current source list and detailed file provenance are retained. | Credit Nicholaus P. Brosowsky and the original recording sources, retain license/source links, and disclose processing. These recordings are licensed third-party content, not app-owned recordings. |
| VSCO 2 Community Edition | [Official repository](https://github.com/sgossner/VSCO-2-CE), CC0 1.0. | Existing contributor credits and source records retained. |
| VCSL, including Harmonica, Vibraphone and Western additions | [Official repository](https://github.com/sgossner/VCSL) expressly permits use in software, including commercial software, under CC0. Pinned recording revision: `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`. | Source hashes, processing records and credits retained. |
| University of Iowa Musical Instrument Samples | [Source owner's permission](https://theremin.music.uiowa.edu/MIS.html) allows download/use in any project without restrictions and specifically identifies application developers. | Preserve original source links and acknowledge Lawrence Fritts and contributors; do not invent a CC license for this source. |
| Freesound Voice, owstu 555984 | [Exact recording](https://freesound.org/people/owstu/sounds/555984/), CC0. | Identify that the processed input was the public MP3 preview, rather than claiming the original WAV was supplied. |
| Freesound Guzheng, Pufermufin 396868 | [Exact recording](https://freesound.org/people/Pufermufin/sounds/396868/), CC0. | Existing excerpt times, tuning, fades and source hash retained. |
| Freesound C-dizi, Hypnotriod pack 21613 | [Pack](https://freesound.org/people/Hypnotriod/packs/21613/) and individual source URLs/license records in `dizi-recorded/provenance.json`, CC0. | Preserve per-file evidence. This is a shared C-dizi bank with repitching, not separately recorded models of every Chinese flute. See the single-page retrieval limitation in `audio-release-audit.md`. |
| Freesound Hammered Dulcimer, iternetcone pack 19445 | Seven exact source pages identified in [audio-release-audit.md](./audio-release-audit.md), each CC BY 4.0; [pack](https://freesound.org/people/iternetcone/packs/19445/). | Author, title/pack, source and [license](https://creativecommons.org/licenses/by/4.0/) links plus explicit changes retained. |

`public/samples/CREDITS.txt` contains the author/source/license/change notices and is displayed offline by the app's existing **Sound credits & licenses** entry. `public/samples/*/provenance.json`, the Western reports and source audits retain the detailed file evidence. Public upstream source links remain available; the app does not add a restriction to rights granted by those licenses.

Production substitutions are deliberate: Erhu/Gaohu → Violin, Zhonghu → Viola, Sheng family → Harmonica, and Pipa → Guitar. Other substitute routes are disclosed in the credits. This review changes no sample waveform, instrument route, pitch range or generation rule.

### Excluded sources

- `public/samples/erhu/`, `public/samples/erhu-bisa/` and `public/samples/pipa/` remain development/source archives and must not be in the production output. The release copier explicitly excludes their complete directories and rejects an active route pointing into them.
- The user-supplied Pianobook Pipa in ignored `pipa-preview.local/` is development-only. Its existing use permission is not treated as permission to redistribute a reusable sample library. No production override is enabled.
- BISA's historical collection/license-version uncertainty and old recital-excerpt provenance do not need to be asserted as licensed shipping content because those recordings are excluded. Restoring any archived bank requires a fresh rights decision.
- The app does not bundle Kong Audio, EastWest, Orchestral Tools, a commercial virtual-instrument library, or the user-provided examination photographs/scores.

## Software and embedded component notices

The 2026-10-15 review covers the **38 packages marked for production in `package-lock.json`**, including optional PDF modules, types and platform-specific components that may not all execute on an individual device. Their exact installed copyright and permission notices were added to `public/samples/CREDITS.txt`; no package version was changed. The inventory is intentionally broader than the executable JavaScript graph so optional jsPDF chunks and native plugins are not omitted.

- React, React DOM, scheduler, Tone.js, VexFlow, jsPDF, Capacitor and the other MIT/ISC/0BSD components retain their individual notices.
- DOMPurify is used under its **Apache-2.0 option**, with its supplied Apache license and author credit retained. This release does not elect the alternative MPL license.
- pako retains both its MIT wrapper notice and its zlib-origin source notice.
- The **19 additional copyright/license blocks embedded in jsPDF's published ES bundle** are also reproduced, including its Adobe-derived BSD material and other permissively licensed embedded components.
- Capacitor's iOS compatibility sources include Apache Cordova headers. The Apache Cordova acknowledgement and Apache license are included in addition to Ionic's MIT notice. The local Swift package depends on Capacitor 8.5.2 and the three existing App/Filesystem/Share plugins.
- `@capacitor/synapse` package metadata says ISC, while its installed `LICENSE.md` grants MIT. The actual supplied MIT copyright and permission text is preserved rather than silently treating the package label as the complete license.

The bundled text is available through the existing credits dialog, so no new online-only dependency or UI step is needed to see these notices. This file does not relicense the app as a whole under any third-party license.

## Notation fonts: verified unchanged bytes

VexFlow 5.0.0's default imported entry embeds and loads the following fonts. Each decoded WOFF2 was compared against the official [vexflow-fonts source](https://github.com/vexflow/vexflow-fonts/tree/b2bc3a6070225e4d395966b36de76c36a9429b1c) and matched byte-for-byte. The corresponding complete licenses and copyright notices are now in `CREDITS.txt`.

| Embedded font | Permission | SHA-256 of unchanged WOFF2 |
| --- | --- | --- |
| Academico regular | Steinberg; SIL OFL 1.1 | `363caf009818b9cebc7a2644d96b5dc10a20d3b5e557afdb4fb1a9a53d57e329` |
| Academico bold | Steinberg; SIL OFL 1.1 | `575c2e30fcf7dd9363e49890644b2ed23b6b518c9866aadb5370d470473297b6` |
| Bravura | Steinberg; SIL OFL 1.1 | `5c25278c208ca455dc7c3c0c95d833e134aca6d740a023767af50d0dfa06ef82` |
| Gonville | Simon Tatham; output font use/copy/redistribution unrestricted | `ab5de4020e1cde7a6f71b97968d9c83c1b02a32b8edc85fef32d4f8caccccb38` |
| Petaluma | Steinberg; SIL OFL 1.1 | `f8acde7c59a53fcd0c29ac2fe8831fcb5b10492f3c62eaa442a2dd045319b27b` |
| Petaluma Script | Steinberg; SIL OFL 1.1 | `10887da5e275b1996e4ca774403dcd4255e16dae6eae8d1aa74ea55c8c1499c3` |

OFL permits embedding/bundling these fonts with software and does not impose that license on the generated score documents. The font data and primary names are unchanged. CSS mentions of Inter, Noto, Georgia and platform fonts do not download or redistribute those fonts; no external font file or font CDN was found in the app's CSS.

## Illustrations and generated exercises

- The accepted homepage hero is `public/artwork/warm-music-studio-v2.webp`. Its project record in `docs/artwork/warm-music-studio-v2.json` identifies a built-in image-generation edit of the prior project hero.
- Instrument atlases/portraits have generator, date, prompts and asset mappings under `docs/artwork/`. Sheng/Pipa/Guan reference photographs were used for physical shape; the recorded prompts explicitly exclude reproducing the original product screenshots, logos, prices and webpage layout. The original reference photographs are not bundled in `public/`.
- The forest growth atlases have a project-specific generator/prompt and species/stage record in `public/companions/growth-art-prompts.json`, with `forest-storybook-v2.png` as the retained visual identity reference. The app uses its project illustrations, not third-party character names or a franchise logo.
- Generated exercises are computed by the app's local music rules; the supplied examination-sheet photographs are development references, not embedded exam pages or a transcribed copyrighted examination repertoire catalog.
- Under [OpenAI's terms](https://openai.com/policies/terms-of-use/), output rights as between the user and OpenAI do not establish ownership of a third party's inputs or guarantee that every output is unique or copyrightable. This audit therefore records project generation provenance and does **not** claim an exclusive copyright warranty or third-party endorsement for AI illustrations. It found no known unlicensed stock image in the accepted illustration records.
- The parent release task replaced the Vite/social-logo favicon, Apple touch-icon and web-manifest links with a copy of the existing native app icon at `public/app-icon.png`. The release copier excludes unused `favicon.svg` and `icons.svg` while retaining the source files. They are not represented as Tonecraft artwork. Check the final HTML/output before review.

## Short English App Review explanation

The following text describes the present configuration and can be added to Review Notes. It is not a forged license certificate or a statement that all third-party content was created by the publisher.

```text
Content rights and acknowledgements:
The app generates its sight-reading exercises locally. It does not bundle the examination-sheet photographs supplied during development or a third-party song catalogue.

Playback uses recorded samples distributed under CC0, CC BY 3.0, CC BY 4.0, or the University of Iowa Musical Instrument Samples' unrestricted project-use permission. Required author, source, license and processing notices are bundled and available from “Sound credits & licenses” in the app. Some Chinese instruments intentionally use disclosed recorded substitutes.

The former Erhu/BISA/recital-Pipa archives and the development-only Pianobook Pipa library are excluded from the production bundle. No Kong Audio, EastWest or Orchestral Tools sample library is included.

Open-source software and unchanged notation-font licenses, including the SIL Open Font License notices, are retained in the same offline acknowledgements. Project illustrations were prepared with image-generation tools; reference photographs and product screenshots are not distributed as original photographs. No affiliation or endorsement by the sample creators, instrument manufacturers or font publishers is claimed.

Contact: tonecraft.zhuoyin@gmail.com
```

## Release checks and limits

1. Run the production asset/build checks and inspect `dist` and the copied native web assets: all three archive sample directories absent; all active routed files and the expanded `samples/CREDITS.txt` present.
2. Open the credits dialog in the new native build, including while offline, and ensure its complete text scrolls. This audit's textual change is approximately 112 kB and does not change the loaded waveforms or notation assets.
3. Verify the root release task's self-branded icon replacement and screenshot source; screenshots must show the app being submitted, not another app's interface or supplied exam photos.
4. The exact accepted source-license statements and this evidence are retained; there is no purchased commercial-library receipt because such a library is not packaged. If Apple asks for a particular source, provide that source's license/provenance rather than inventing a publisher-issued grant.
5. No newly identified source-license issue requires changing the current score-generation/playback behavior. Restoring excluded recordings, importing songs, changing illustration sources or adding a new SDK requires another review.

Detailed local inventory and hash proof from this audit are in `.tmp-release-proof/content-rights-inventory.json`; the durable source/license/version and font-hash evidence is retained in this document and the bundled credits. Final TestFlight availability and iPad playback quality are separate verification steps owned by the release task.

## Build 1.0 (12): complete bundled-audio follow-up

Checked 2026-10-16 (Asia/Taipei), using the downloaded inspection report generated against the cloud IPA. The IPA inventory identifies source commit `555d0505b35188f2ce9bb6a799b03c4e4da1d6ad`, Codemagic build `6ad0f8a812cce3cb996db903` and IPA SHA-256 `493fcdb4493bbe0982fdd8665f9c3b4a93d72aa9f6affa92e7d9b43deae4ddd3`. It reports all 664 built web files matched inside the IPA, no server override, and the three excluded sample archives absent. Its **615 audio files** were compared with the production routing set; the extra **166 files** are distributed as follows:

| Extra files | Count | Permission already included in credits | Identity check |
| --- | ---: | --- | --- |
| Original MP3s in Bassoon, Flute, French Horn, Alto Saxophone, Trombone, Trumpet and Tuba folders | 99 | tonejs-instruments CC BY 3.0 | 98 match retained `preparedInputSha256` evidence. The older `trombone/As1.mp3`, outside the later import-plan pitch range, was freshly downloaded from the same pinned official revision and matches byte-for-byte. |
| Original Clarinet/Oboe WAVs and old Viola/Cello section banks | 45 | VSCO 2 Community Edition CC0 | 19 match retained `preparedInputSha256`. For the 26 section-string WAVs, original cached files match the Git blobs pinned in the import plan; reproducing the documented 44.1 kHz stereo PCM24-to-PCM16 conversion gives identical sample data. |
| Original Tenor Saxophone WAVs | 17 | VCSL CC0 | All match retained `preparedInputSha256` evidence. |
| Earlier processed Bassoon A#1/E2, Horn F4/A4 and Trombone C5 WAVs | 5 | Iowa MIS unrestricted project use | All match retained input hashes and their individual Iowa source/processing provenance. |
| **Total extra, unused audio** | **166** | **No additional license family** | **All accounted for; zero missing-source or identity-check failures.** |

These recordings remain because the production copier preserves public files other than the three explicitly excluded archives. They are no longer selected after the Western sustain update and the switch from section strings to solo strings. An unused file still needs redistribution permission; the check above covers the files actually packaged, not only playable routes. The existing credits expressly retain the earlier VSCO section sources and original/processed Western recordings, so no new credit text or audio change was required.

Evidence sources are `scripts/western-samples-plan.json`, `scripts/prepare-western-samples.py`, `public/samples/western-completion/provenance.json` (`preparedInput` and `preparedInputSha256`), and the Bassoon/Horn/Trombone `iowa-provenance.json` files. The pinned source revisions are tonejs-instruments `622c2f1c32c8cfce4158ddc3eb26e518ddef37e5`, VSCO 2 CE `440300901dfe9275fd84e0b7763af1f8443ae62e`, and VCSL `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`. The out-of-plan Trombone file's [official pinned source](https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/622c2f1c32c8cfce4158ddc3eb26e518ddef37e5/samples/trombone/As1.mp3) has SHA-256 `e2cc2810e93fa260b0db4bac9888d629342f98e4c2fe561666525c60ca5a9809`, exactly matching the packaged web asset.

The detailed 166-row local results are `.tmp-release-proof/build12-extra-audio-audit.json`; the downloaded binary report is `.tmp-release-proof/build12-artifacts/build/ios/release-inventory.json`. Keeping unused permitted recordings is a package-size issue, **not an identified rights blocker**. No extra exclusion, waveform modification or replacement upload is needed for rights in build 12. A later size-only cleanup can remove unused assets while preserving playback routes, but it was not performed by this audit. Apple processing/TestFlight availability and physical iPad acceptance remain separate checks.
