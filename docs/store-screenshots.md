# Store screenshot preparation — 2026-10-16

Status: **two physical-device-based store showcase graphics are now uploaded
and saved in the Traditional Chinese App Store 1.0 draft, one for iPhone and one
for iPad**. Both were verified again after reloading App Store Connect. The
selected App remains TestFlight **1.0 (12)**; no new App was uploaded and formal
App Review has not been submitted. Full device acceptance remains with the user.

## Saved store graphics — 2026-10-16

| Device slot | Final JPEG | Dimensions | Saved count |
| --- | --- | --- | ---: |
| Dynamic Island iPhone, medium | [iphone-store-zh-TW.jpg](./store-assets/zh-TW/iphone-store-zh-TW.jpg) | 1179 × 2556 | 1 |
| iPad 13-inch | [ipad-store-zh-TW.jpg](./store-assets/zh-TW/ipad-store-zh-TW.jpg) | 2048 × 2732 | 1 |

The user supplied actual iPad and iPhone practice screenshots, with normal
Chinese text and notation. The received JPEGs were compressed to 960 × 1280 and
590 × 1280 respectively. The final graphics preserve each complete real UI at
its original aspect ratio, with a flat cream background and brand/captions
outside the UI. They do not redraw notation, reconstruct missing text, or claim
to restore the original native resolution. Both are RGB JPEGs without alpha.
Independent visual review confirmed clear main notation, BPM and interface;
small text retains the source compression's softness. Detailed hashes, original
dimensions and transformation disclosures are in
[provenance.json](./store-assets/zh-TW/provenance.json).

App Store Connect accepted both files, displayed one screenshot in each correct
device tab, and retained them after a page reload. The media saves automatically;
the main Save control was disabled after processing. Evidence screenshots are
`.tmp-release-proof/apple-store-iphone-physical-saved.jpg` and
`.tmp-release-proof/apple-store-ipad-physical-saved.jpg`. This is a saved-draft
verification, not Apple review approval. The Add for Review button was not used.

Apple permits screenshots with text/image overlays provided core functionality
is not obscured and the actual App use remains clear
([guideline 2.3.3](https://developer.apple.com/help/app-review/guideline-reference/2-3-3-screenshots/)).
These two graphics show the App in use. No additional screenshot file is needed
for the current minimum media set; the five browser drafts below remain optional
plans for expanding the store gallery later.

## Earlier draft and capture history (superseded for current store media)

2026-10-16 capture update: five real production-web UI drafts have now been
captured from the normal flow (Piano preset C3–C6, beginner/simple, natural key,
8 measures), without injected scores or unlocked rewards. They are saved under
`.tmp-release-proof/store-screenshots/browser-drafts/` as `browser-instruments.jpg`,
`browser-staff-range.jpg`, `browser-challenge-options.jpg`,
`browser-musical-practice.jpg` and `browser-forest-companions.jpg`. These JPEGs are
layout/content drafts, not iPad or iPhone Simulator screenshots and not store
uploads. TestFlight **1.0 (12)** is available to the internal group with status
「正在測試」. The same build has been selected in the App Store 1.0 draft,
saved and verified after reload; it has not been submitted for review. Its
selection does not replace the user's pending iPad test or final approval.

The latest independent native Simulator screenshot jobs are listed below. Their
capture branches do not publish another TestFlight build. Their actual outputs,
pixel dimensions and visual quality must be reviewed before any store upload.

| Capture target | Codemagic job ID | Isolated branch | Source commit | Current result |
| --- | --- | --- | --- | --- |
| iPad | `6ad101fd45beff93db2994e0` | `codex/store-screenshot-capture` | `7d3dc75` | Captured one native PNG; visual QA rejected for missing Chinese glyphs |
| iPhone | `6ad101f745beff93db2994b6` | `codex/store-screenshot-iphone` | `e70f455` | Captured one native PNG; visual QA rejected for missing Chinese glyphs |
| iPhone + iPad, global Traditional Chinese retry | `6ad1a2b912cce3cb997099c8` | `codex/store-screenshot-capture` | `049bf5c` | Two homepage PNGs captured; both still rejected for missing Chinese glyphs; full UI sets incomplete |

The first capture-only jobs produced zero PNGs because initial CoreSimulator
device enumeration exceeded 30 seconds. The next iPhone job passed enumeration
in 33 seconds, then exposed a missing preparation step: the production pipeline
normalizes the source app icon from 1254 to 1024 pixels, while the independent
capture workflow had omitted it. The latest scripts perform that same existing
production step after strict App-source comparison, record before/after
properties, and allow a bounded cold Simulator initialization. These are
capture-automation repairs; no new TestFlight upload or App behavior change was
made. An unsigned Simulator build is not identical to the signed IPA.

## Historical Simulator visual QA: Chinese fallback remains unresolved

The iPhone 17 Pro capture job completed successfully and produced one native
1206 × 2622 PNG from version 1.0 (12). The iPad capture-only job also completed
and produced `ipad-home-zh-TW.png` at 2064 × 2752. Visual review rejected both:
general Chinese interface labels render as missing-glyph boxes, while serif
hero and brand text render correctly. The iPhone original and
`visual-review.json` are preserved in
`.tmp-release-proof/capture-iphone-attempt3/`; the iPad original is preserved in
`.tmp-release-proof/capture-ipad-attempt3/`. They are diagnostic evidence, not
store assets. Both images are RGBA with opaque alpha; the iPad's alpha values
are all 255. A final usable image must be exported without an alpha channel,
but removing alpha cannot fix the missing text and does not make either
rejected image eligible. Do not redraw, replace, or hide interface text in them.

The relevant typography CSS is unchanged from the previously tested build 10.
There is no bundled or remote CJK webfont. This supports a Simulator system-font
fallback problem but does not prove its exact cause or physical-device behavior.
On 2026-10-16 the user confirmed Chinese text is normal on the physical iPad in
TestFlight 12. This confirms only that text check, not all release acceptance.
Keep build 12, do not silently alter the App or claim a device regression, and do
not upload either rejected picture. The current store media requirement is now
met by the user-provided physical-device compositions above. The five browser drafts remain ready for content and
composition review and clearly labeled drafts; none is a native capture or
store upload. The later supplied iPhone practice screenshot also shows normal
Chinese text; full iPhone acceptance is still pending.

A single capture-only retry, job `6ad1a2b912cce3cb997099c8` at `049bf5c`,
initialized the entire ephemeral
Simulator guest to `zh-Hant-TW` / `zh_TW`, reboots normally and records preference
readback. Earlier attempts supplied only App launch-language arguments; those
are distinct from the system language and region ([Apple localization testing](https://developer.apple.com/documentation/xcode/testing-localizations-when-running-your-app)).
The preference plist retained the requested values after reboot, and the iPad
statusbar date changed to Chinese. Guest `defaults` readback was unavailable
(exit 134), so it was recorded as unavailable rather than silently treated as
successful. Visual review still found missing glyphs in both native home PNGs;
the system-locale hypothesis did **not** resolve the capture problem.
The retry also used an independent XCTest UI bundle to navigate the installed,
unchanged App through home, instruments, range, difficulty and generated score;
it injects no scores, preferences or unlocked rewards. Its source comparison
still targets App 12 commit `555d0505b35188f2ce9bb6a799b03c4e4da1d6ad`.
The XCTest projects compiled and ran, but their normal-flow test could not
reveal an expected button. Each exported only a home image and a failure
diagnostic, not the five-screen set. Neither accessibility success nor job
completion is a visual QA pass. Raw evidence is retained under
`.tmp-release-proof/capture-system-locale-attempt4/` with `visual-review.json`.

This retry did not sign/upload a new App or submit App Review. Stop font retries
on this runtime. This was resolved for store-media preparation when the user supplied real
iPad/iPhone practice screens. The rejected Simulator originals remain diagnostic
evidence only. The actual TestFlight 12 App remains unchanged.

## Apple upload specifications

The current app targets both iPhone and iPad (`TARGETED_DEVICE_FAMILY = "1,2"`).
Apple's current reference requires at least one screenshot for an iPhone with
Dynamic Island (medium display), and at least one for iPad 13-inch. Each device
size accepts 1–10 screenshots in PNG, JPG, or JPEG without transparency.

| Required group | Accepted portrait pixels | Accepted landscape pixels | Proposed capture |
| --- | --- | --- | --- |
| iPhone, Dynamic Island medium | 1179 × 2556; 1206 × 2622 | 2556 × 1179; 2622 × 1206 | 1179 × 2556 portrait |
| iPad, 13-inch | 2064 × 2752; 2048 × 2732 | 2752 × 2064; 2732 × 2048 | 2732 × 2048 landscape |

Reference, checked 2026-10-15:
[Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).
The live App Store Connect 1.0 Traditional Chinese media panel was checked on
2026-10-15. Its medium Dynamic Island iPhone slot explicitly accepts
1179 × 2556 or 1206 × 2622 portrait (and their landscape equivalents), matching
the current reference. The iPhone Duo slot is separate; no unsupported device
support claim or generated device frame is needed for this release.
The live iPad slot also explicitly accepts 2048 × 2732 or 2064 × 2752 portrait,
and their landscape equivalents. The optional CI native Simulator captures use
these supported portrait groups and record the actual pixel dimensions.
If the app's live App Store Connect media fields differ from the reference,
record their accepted device group and pixel sizes before uploading. Do not
force an image into a group that rejects its dimensions. Apple's legacy iPhone
Face ID large group, if shown, accepts 1242 × 2688 or 1284 × 2778 portrait and
their landscape counterparts; those are a separate size group.

For browser layout drafts only, 1366 × 1024 CSS pixels at device scale 2 match
the proposed iPad image dimensions; 393 × 852 at scale 3 match the proposed
iPhone dimensions. These drafts are responsive UI evidence, not iOS simulator
or physical-device evidence. Do not stretch a smaller screenshot to claim a
higher resolution or add a fake device status bar. Prefer native simulator or
device captures from the build being submitted for the final store set.

## Capture set and normal UI paths

Set the interface language to 繁體中文. Keep the standard layout size and forest
companion appearance. Disable any browser translation. Capture the actual
viewport, not a stitched full-page image. Allow page transitions, instrument
artwork, companion atlases, notation fonts and score rendering to settle.

The table is in proposed store order. The most efficient capture order is
02 → 03 → 04 → 01 → 05 so that the first four images use the same session.

| File stem | Screen and optional store caption | Actual UI path and preparation | What must remain visible |
| --- | --- | --- | --- |
| `01-musical-practice` | 練習樂譜／播放。Caption:「每次練習，都是一段音樂。」 | Home →「開始今日練習」→ choose Piano →「下一步」→ grand staff, C3–C6, 8 measures →「下一步」→ beginner pitch, simple rhythm, 4/4, natural key only, accidentals off →「開始視譜練習」。Use the resulting normal generated exercise. Scroll the score into a useful position; if showing playback, tap「播放樂譜」and capture while the real playhead is over the score. | Recognizable notation, printed BPM and playback controls. A still score is acceptable if capturing an active playhead is unreliable. Do not claim microphone feedback for polyphonic piano. |
| `02-instrument-selection` | 選擇樂器。Caption:「從熟悉的樂器開始。」 | Home →「開始今日練習」。This is step 01「選擇你的樂器」。Choose Piano explicitly so a remembered user preference does not affect the set. Clear search, leave all instrument families visible; choose the viewport scroll position that shows the featured instrument and several real cards. | Current cute instrument artwork, selected instrument name, category filters and real selection cards. Do not restore the removed Gehu, Bass Gehu or Yunluo. |
| `03-staff-range` | 譜表與選音域。Caption:「直接在譜上，找到舒適音域。」 | From step 01 tap「下一步」。Step 02「找到舒適的音域」has clef cards plus two vertical staff controls. For the piano set, select 大譜表 and adjust the lower/upper controls to C3 and C6. The「用音名精確調整」disclosure provides exact values if touch placement is awkward. Collapse it again before capture. | Real clef choices and both「最低音」「最高音」staff controls with their selected pitches. iPhone may require a natural scroll position instead of showing the entire page at once. |
| `04-challenge-options` | 音高、節奏與調號。Caption:「難度與節奏，依自己安排。」 | From step 02 tap「下一步」。Step 03「設計今天的挑戰」has independent pitch cards, rhythm and meter selectors, and the key signature picker. Use 初級 + 簡單 + 4/4 +「無升降記號」for the score set; optionally select a second permitted key through the actual picker for this screenshot, then return to「無升降記號」only before generating image 01. Keep accidentals and mixed meters off for the simple score example. | Pitch difficulty choices, rhythm selector and key selection controls. On iPhone capture the key-selection area as a focused natural page scroll if all controls do not fit. Do not shrink the UI beyond the normal app size or composite separated portions. |
| `05-forest-companions` | 森林小精靈成長。Caption:「讓每一天的練習，慢慢長大。」 | Header →「✦ … 星點」opens the real rewards dialog. Its upper section includes preview, and「一起長大的小精靈」shows 幼年／少年／成年. Use the permanently free 拍米 to show all three real forms without purchasing or inventing earned practice. Scroll the dialog so the growth selector is fully visible. Other animals may be previewed through「預覽造型」without unlocking. | Real forest artwork and honest locked/unlocked states. It is fine for 少年／成年 to remain locked. Do not inject progress, grant test points, remove lock symbols or claim a mature animal was earned when it was not. |

Piano's C3–C6 range is a capture setting rather than a new default or a change
to the generator. Do not change the app's code, music rules or persisted user
history to produce these images. If existing practice data is useful for a
native capture, use it with its actual unlocked stages; keep personal records
out of the public image.

## Current UI facts checked in source

- `src/App.tsx` owns home → setup → practice navigation, real playback, the
  rewards dialog and legal dialogs. There is no production URL that directly
  opens arbitrary setup steps or manufactures a finished exercise.
- `src/components/SetupPage.tsx` has step navigation (01/02/03), instrument
  family/search, clef selection, `StaffRangePicker`, independent pitch/rhythm
  controls, `KeySignaturePicker`, accidental and mixed-meter options.
- `src/components/StaffRangePicker.tsx` supports tap/drag, semitone and octave
  buttons, and keyboard arrows. `SetupPage` also offers exact note-name selects.
- `src/hooks/useExercise.ts` starts with Piano, beginner pitch, simple rhythm,
  4/4 and 8 measures; it restores the preferred instrument. New phone exercises
  are capped at 8 measures. Use normal generation, not `?previewScale=…`.
- `src/components/CompanionDesignPicker.tsx` displays all three actual forest
  forms even when the later forms are locked. Each companion grows separately:
  young at 30 minutes and adult at 180 minutes of credited practice. Original
  art remains hidden; test-star controls are development-only and must not
  appear in a store capture.
- `MEMBERSHIP_ENABLED` is false. Do not show the hidden proposal pricing page,
  imply a subscription exists, or advertise a daily generation cap. The proposed
  future five-study limit has not been implemented.
- Existing `.tmp-*.html`, `.tmp-*.tsx`, temporary screenshot previews and
  `tests/fixtures/safe-area.html` are for development/QA. They are not final
  store assets and cannot substitute for product-screen captures.

## Language and legal consistency

The app currently lists 12 interface locales: zh-TW, en, ja, es, de, fr, ko,
pt-BR, ru, it, zh-CN and th. `src/legal/content.ts` contains complete privacy
and support documents for zh-TW, zh-CN and English. The other nine locales show
the English document with an explicit notice in the selected language; close
and footer entry labels remain localized. Thus the proposed zh-TW screenshots
do not show English fallback notices. Do not advertise all 12 legal documents
as independently translated.

No privacy/support sheet should cover the product in the store screenshot set.
Separately verify the new native build opens the policy and support sheets
offline, shows the approved publisher/contact, and follows the public links.

## Capture receipt and acceptance

For each final image, record: filename; App version/build; source commit;
language; screen; actual pixel dimensions; portrait/landscape; capture source
(physical iPad, iOS simulator, or browser draft); configuration; any normal
scroll position; and whether uploaded to App Store Connect. Keep originals.

Before uploading, inspect every image at its full dimensions and check:

1. App branding, illustration style and controls match the new TestFlight build.
2. Staff, beams, phrase lines, printed BPM and selected pitches are sharp and
   readable; no incomplete load, blue caret overlap, warning or error banner.
3. No real name, email, private practice results, developer controls, preview
   banner, browser chrome, purchase proposal or misleading paid feature.
4. No clipped top controls, unsafe-area overlap, truncated key choices or
   artificial stretching. Do not use the iPad layout as an iPhone image.
5. Pixel dimensions match the actual ASC media group, all files are RGB without
   alpha, and the first screenshot communicates the working score experience.

Physical iPad playback, real microphone permission/calibration, interruption
recovery and safe-area behavior remain user TestFlight checks. A prepared
screenshot set cannot mark them as passed. Leave App Store review submission
pending until the user approves this TestFlight build.
