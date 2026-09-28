# Mobile store release content and privacy draft

Reviewed: 2026-09-28. This file prepares Google Play and iPhone/iPad listing content; it is not evidence that a store submission, approval, account verification, or device test has completed.

## Current delivery route

Paid Google Play Console registration is complete for a personal account, and access to the main app list has been verified in the live interface. Identity documents have been submitted and are under Google review; the interface says this may take days. Physical Android-device verification can be completed now. Phone-contact verification must wait until identity approval. App creation is currently disabled until account verification is complete. The immediate Android deliverable is an installable testing APK; that does not require publishing on Google Play. The repository includes Android native packaging and build workflows, and the iOS project targets both iPhone and iPad.

Verified mobile release evidence: TestFlight version **1.0 (4)** was uploaded from commit `9772833`. Apple's processed binary lists support for both iPhone and iPad, and the build is assigned to the existing internal testing group with one tester. This confirms binary processing and internal distribution setup, not a completed physical-device test or public App Store release. Android preview build #1 from the same commit completed successfully: 361 regression tests passed, `assembleDebug`, `bundleRelease`, and `lintRelease` passed. The downloaded 180.06 MiB APK contains 354 web assets, including 339 sample/credit files, and has no remote development-server override. APK SHA-256: `F159AFB3026A6EF6EE6BC5CB3C1203D980DEE59EF372B9F23FF50CCE08D77C5F`. It has not yet been tested on physical Android hardware. The AAB remains unsigned and is not ready for Play submission.

The release workflow separates two outputs:

- `android-preview`: debug-signed test APK plus an explicitly **unsigned AAB** for build inspection. The unsigned bundle is not a Google Play submission artifact. A test APK is not a public store release.
- `android-play-release`: manually started workflow for a release bundle signed with the configured upload keystore. It requires the real signing configuration; do not reuse a debug key as the production upload identity.

The first Play submission still requires an enrolled/verified developer account, the production upload keystore and securely stored credentials, app creation and listing/content declarations in Play Console, and the applicable testing/review steps. Key names/workflow settings belong in the deployment configuration; key material and passwords do not belong in Git. [Android app signing](https://developer.android.com/studio/publish/app-signing)

## Information required from the publisher

| Required item | Why it is needed | Current status |
| --- | --- | --- |
| Google Play Console account access; personal/organization account type; account creation date and verification status | Determines who may publish and whether production-access testing applies | Paid registration and access verified; personal account. Submitted identity documents are under Google review, which may take days. Physical Android-device verification is available now; phone-contact verification waits for identity approval. App creation is disabled until account verification is complete. Account creation date still needs confirmation |
| Public developer/publisher name | Must identify the party responsible for the app and privacy inquiries | Publisher must supply |
| Working public support/privacy email or privacy inquiry mechanism | Required store support contact and usable privacy contact | Publisher must supply; do not substitute a Git commit email |
| Public HTTPS privacy-policy URL and hosting owner | Must resolve without sign-in or geographic restrictions | Not deployed; the draft below is not a published policy |
| Intended audience age groups and distribution countries | Needed for content rating, target-audience and distribution declarations | Publisher must decide; an educational theme does not establish the intended age group |
| Initial free/paid listing choice | Current app has no active membership purchase flow; store pricing is a separate decision | Publisher must confirm; do not enable the prototype membership flow |
| Testers and real testing feedback, if the account requires closed testing | Needed before applying for production access | Not verified |
| Support-message retention/deletion practice | The final privacy policy must describe the publisher's actual support handling | Publisher must supply before replacing the contact placeholders |

Do not put Play Console passwords, verification documents, signing keys, or service-account JSON into this repository or this document. Complete identity and payment steps through the official account interface.

## Current Google Play requirements checked against official sources

- Register and verify a Play Console developer account. Google currently lists a one-time US$25 registration fee; new personal accounts also require Android-device verification. [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- Personal accounts created after November 13, 2023 must complete a closed test with at least 12 testers continuously opted in for 14 days, then apply for production access. Internal testing is a separate early distribution option and does not itself satisfy that closed-test requirement. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- Every app needs a privacy policy in Play Console and an accessible policy link or text inside the app. Include publisher/contact information, data access/use/sharing, security, retention and deletion. The public policy URL must be active, non-geofenced, non-editable by visitors, and not a PDF. [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- Complete Data safety declarations for the actual release and all included SDKs. Google's definition excludes data processed only on the device without being sent off-device from the collected-data disclosure. That does not remove the privacy-policy requirement. [Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- Google Play listing limits are 30 characters for the app name, 80 for the short description, and 4,000 for the full description. A public support email is required. [Create and set up an app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)

Use the live Play Console requirements for the account and final bundle when submitting. These checks do not establish production access or predict review approval.

## Data handling observed in the application source

| Data or capability | Actual handling | Evidence |
| --- | --- | --- |
| Microphone sound | Requested when the user starts calibration or a test. PCM windows are analyzed in memory for pitch, timing, level and clipping. There is no recording-file persistence or upload path in this code. Streams stop on cancel, completion, interruption or leaving the assessment | `src/assessment/MicrophoneSession.ts`, `public/capture-worklet.js`, `src/components/AssessmentPanel.tsx` |
| Microphone/output route | A short local hash derived from browser microphone/output identifiers and sample rate matches calibration to an audio route. The actual device identifier is not persisted by the app. This is a matching key, not a claim of cryptographic anonymization | `src/assessment/calibration.ts` |
| Calibration | Local timing offsets, measurement date, output category and route hash; up to 12 route entries | `src/assessment/calibration.ts` |
| Assessment history | Up to 100 qualifying summaries: timestamp, practice ID, instrument, difficulty, tempo, pitch/rhythm/completion and comparison settings. No waveform or recording file | `src/practice/training.ts`, `src/hooks/useTraining.ts` |
| Practice and rewards | Local XP, stars, owned/selected companions, daily count, up to 365 practice dates and 512 completion identifiers | `src/progress/progress.ts`, `src/progress/useProgress.ts` |
| Saved scores and presets | Local library of up to 50 score snapshots and 20 presets; entries can be removed from the library | `src/practice/library.ts`, `src/hooks/useLibrary.ts` |
| Resume | One most-recent score snapshot, settings, tempo, completion identity and playback position | `src/practice/resume.ts`, `src/hooks/usePracticeResume.ts` |
| Preferences | Language, theme, density, score sizes, tuning reference, companion design/position and install-prompt preference stored locally | Corresponding modules under `src/i18n`, `src/theme`, `src/hooks`, `src/progress`, `src/audio` |
| PDF export | Score PDF generated locally at the user's request. The mobile implementation uses a temporary app-cache file through Capacitor Filesystem and opens the native share sheet through Capacitor Share; the user chooses the receiving app or save destination. The web implementation uses a browser download | `src/export/exportScorePdf.ts`, `src/export/savePdfBlob.ts`, `package.json` |
| Networking | App-owned instrument loading resolves bundled assets. Credits/source links open third-party content only when followed. No app analytics, advertising, login, cloud-sync or user-data upload integration was found in the reviewed code/dependencies | `src/audio/loadRecordedSamples.ts`, `src/audio/createPlaybackInstrument.ts`, `package.json`, `src/App.tsx` |
| Purchases | Prototype membership entry points disabled; no active checkout or subscriptions in the reviewed app | `src/featureFlags.ts` |

### Final-binary checks before Data safety submission

The source supports a **provisional “no user data collected or shared by the app”** answer under Google's off-device definition. Verify that answer against the final Android/iOS artifacts and dependencies. Do not submit the form on the strength of this document alone.

Check native permissions, added SDKs, network destinations, and backup/device-transfer behavior. The Android manifest now sets `allowBackup=false` and references cloud-backup/device-transfer exclusion rules; verify that the merged release manifest and all relevant storage domains are excluded when the artifact is built. The iOS backup behavior must be described separately. Avoid an absolute “your data never leaves your device” claim: the user can explicitly export a PDF to another app or provider. The policy draft below distinguishes app-operated transmission from operating-system services.

User-directed saving/sharing of a generated PDF and opening an external site are different from an app silently uploading practice data. The new Filesystem/Share path is only invoked for user-requested PDF export; verify its final implementation and assess it under Google's user-initiated sharing guidance. Reassess declarations if analytics, advertising, accounts, crash reporting or cloud storage are introduced. This build has no account-creation feature, so do not invent an account-deletion service; describe removal of local data instead.

## Audio redistribution audit

Retain `public/samples/CREDITS.txt`, provenance JSON and the in-app credits link in every release. The following records describe evidence and unresolved checks; they are not a warranty of rights clearance.

| Audio family | Evidence and handling | Release implication |
| --- | --- | --- |
| `tonejs-instruments` distributed MP3 recordings | Upstream distinguishes MIT software from CC BY 3.0 samples. Local credits identify the distributor, original sources, license and modifications | Preserve sample attribution and CC BY conditions; the code's MIT license alone is not a sample license. [Upstream license](https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/LICENSE.md) |
| VSCO 2 CE and VCSL WAV sources | Official repositories identify CC0; VCSL explicitly discusses software use | Retain provenance and existing credits. Do not replace source records with a blanket claim that all recordings are project-owned. [VSCO 2 CE](https://github.com/sgossner/VSCO-2-CE), [VCSL](https://github.com/sgossner/VCSL) |
| Voice, Freesound 555984 by owstu | The source currently identifies CC0. The app uses a processed excerpt of the public MP3 preview, as recorded in `voice/provenance.json` | Preserve that exact-source distinction and existing credits. [Source](https://freesound.org/people/owstu/sounds/555984/) |
| Erhu, Berklee BISA A4/E5 | Collection currently states CC BY; neither inspected item page names a license version. Local credits already disclose that uncertainty and list contributors and changes | Do not invent a version or assert unrestricted rights. Resolve the precise license/version with the source for the commercial rights record. [Collection](https://remix.berklee.edu/bisa-chinese-erhu/), [A4](https://remix.berklee.edu/bisa-chinese-erhu-oneshots-vibrato/7/), [E5](https://remix.berklee.edu/bisa-chinese-erhu-oneshots-vibrato/8/) |
| Production Pipa, Freesound 162086 by xserra | Local `pipa/provenance.json` and credits record CC BY 4.0, source hash, excerpts and tuning changes. The exact live source page could not be retrieved during this review | Preserve the current production source and attribution. Obtain/retrieve exact-source license evidence before treating the commercial sample audit as complete; do not substitute the license of neighboring recordings. [Recorded source URL](https://freesound.org/people/xserra/sounds/162086/) |
| User-supplied Eamon/Pianobook Pipa preview | `LOCAL_PIPA_PREVIEW.md` limits it to ignored `pipa-preview.local/`; Vite enables it only during development. Pianobook's FAQ permits use in compositions but forbids selling/redistributing libraries whose copyright the user does not own | **Keep excluded from the app bundle and Git.** Separate permission from the rights holder is needed before shipping those recordings in an app. Free download or commercial music use does not establish permission to redistribute sample files. [Pianobook FAQ](https://www.pianobook.co.uk/faq/) |

CC BY attribution licenses have their own conditions, including credit, a license reference, and identifying modifications where applicable. Other rights can remain outside the license. Preserve the existing no-endorsement language. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/deed.en), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.en)

No samples, mappings or credits were changed as part of this documentation task. Do not silently swap a restricted or uncertain sample to another source during release preparation.

## Privacy policy draft — 繁體中文

**草稿，尚未生效或發布。** 完成所有方括號欄位，確認客服資料保存方式與最終原生版本後，才可作為公開政策。將最終內容發布到可公開存取的網頁，並在 App 內加入入口。

### Sight Reading Generator 隱私政策

生效日期：[由發布者填寫]  
發布者：[公開開發者／公司名稱]  
隱私與支援聯絡：[有效電子郵件或詢問機制]  
政策網址：[公開 HTTPS 網址]

Sight Reading Generator 提供視譜出題、樂譜播放、練習紀錄與選用的麥克風測驗。本政策說明這個版本如何處理資料。

**麥克風。** 當你開始時間校正或演奏測驗時，App 會要求麥克風權限。聲音在裝置上即時分析，用於音準、節奏、音長及收音品質回饋。App 不把麥克風聲音保存為錄音檔，也不將錄音傳送給發布者或伺服器。取消、完成或中斷測驗時會停止收音。你可在裝置的權限設定撤銷麥克風權限；未授權時仍可使用不需要麥克風的出題與播放功能。

**保存在裝置上的資料。** App 會在本機保存收藏樂譜、練習設定、上次練習與播放位置、部分測驗摘要、練習日期、經驗值、星點和外觀選擇，以及語言、版面與音叉設定。麥克風校正資料包含時間補償及本機音訊路徑代碼，協助辨識目前設備組合；App 不保存原始麥克風設備識別碼。App 沒有自己的帳號或跨裝置雲端同步服務。

**傳送與第三方。** 這個版本沒有廣告或使用分析 SDK，也沒有把練習資料傳送給發布者的功能。App 會讀取隨程式提供的音色檔。你主動匯出 PDF 時，手機版會在 App 快取建立暫存檔並開啟系統分享介面；只有你選擇儲存或接收目的地後，檔案才交給該目的地處理。網頁版由瀏覽器下載檔案。你開啟音色來源等外部網站後，該網站依其自己的政策處理連線資料。應用程式商店、作業系統、裝置備份或移轉服務有各自的資料處理方式與設定，本 App 不營運這些服務。

**保存與刪除。** 本機資料會保存到你移除資料、移除 App，或 App 的紀錄上限淘汰較舊項目為止。你可以在收藏庫刪除個別樂譜或設定；其餘本機資料可透過裝置提供的清除 App 資料／刪除 App 功能，或網頁版的網站資料設定移除。Android 版本已設定停用 App 資料的雲端備份及裝置移轉；其他平台的裝置備份可能保留或還原副本，請一併管理相應備份。PDF 暫存檔位於 App 快取；你另外儲存或分享出去的 PDF 不會隨 App 的資料清除而自動刪除，需在保存位置另行刪除。

**資料保護。** 練習資料保存在裝置提供給 App 的本機儲存空間；App 未另設資料密碼或雲端保管服務。請使用裝置鎖定等功能保護可存取你裝置的人員範圍。

**聯絡與政策更新。** 如有隱私問題，請使用上述聯絡方式。若你主動寄送電子郵件或支援訊息，發布者會收到你提供的聯絡資料與內容。[發布者須補上實際客服服務供應者、使用目的、保存期間或判斷標準，以及刪除請求方式。] 未來如增加會改變資料處理的功能，將更新本政策與生效日期。

## Privacy policy draft — English

**Draft; not effective or published.** Replace every bracketed field and confirm support handling and the final native build before publishing this policy on a public web page and adding an in-app entry point.

### Sight Reading Generator Privacy Policy

Effective date: [Publisher to supply]  
Publisher: [Public developer or company name]  
Privacy and support contact: [Working email address or inquiry mechanism]  
Policy URL: [Public HTTPS URL]

Sight Reading Generator provides sight-reading exercises, score playback, practice records and optional microphone assessments. This policy describes the data handling of this version.

**Microphone.** The app requests microphone permission when you start timing calibration or an assessment. Sound is analyzed on your device for pitch, timing, note duration and capture-quality feedback. The app does not save microphone sound as a recording file or send recordings to the publisher or a server. Capture stops when you cancel, finish or interrupt the assessment. You can revoke microphone permission in your device settings. Exercise generation and playback remain available without microphone permission.

**Data stored on your device.** The app stores saved scores, practice settings, the last practice and playback position, selected assessment summaries, practice dates, experience points, stars and companion choices locally. It also stores language, layout and tuning-reference preferences. Calibration records include timing offsets and a local audio-route code to match the current equipment configuration; the app does not persist the original microphone device identifier. The app has no account system or app-operated cloud synchronization.

**Transfers and third parties.** This version includes no advertising or usage-analytics SDK and no feature that sends practice data to the publisher. Instrument playback reads recordings bundled with the app. When you request PDF export, the mobile app creates a temporary file in its cache and opens the system share sheet. The file is passed to a destination only after you choose where to save or send it. The web version uses a browser download. If you open an external source or credits website, that site handles connection data under its own policy. App stores, operating systems and device backup or migration services have their own data practices and settings; the app does not operate those services.

**Retention and deletion.** Local records remain until you remove the data, remove the app, or the app's history limits replace older entries. You can remove individual scores and presets from the library. Other local data can be removed through the device's app-data clearing or app-deletion controls, or through site-data controls for the web version. The Android version is configured to disable app-data cloud backup and device transfer. Backups on other platforms may retain or restore copies; manage those separately. Temporary PDFs are held in the app cache. PDF copies that you save or share elsewhere are not automatically deleted with app data and must be deleted from their destination.

**Protection.** Practice data is stored in the local storage area provided to the app by your device. The app does not add a separate data password or a cloud storage service. Use device access controls, such as a screen lock, to protect access to your device.

**Contact and changes.** Use the contact above for privacy questions. If you voluntarily send an email or support message, the publisher receives the contact details and content you provide. [Publisher must add the actual support provider, purposes, retention period or criteria, and method for requesting deletion.] This policy and its effective date will be updated if future features change data handling.

## Store listing draft — 繁體中文

App name: **Sight Reading Generator**

Short description:

> 自訂樂器、音域與節奏，生成視譜練習；搭配播放、節拍器與本機演奏回饋。

Full description:

從適合你的樂器和音域開始，把讀譜練習融入日常。Sight Reading Generator 依你的設定產生新譜，讓你循序練習音高、節奏與不同拍號。

- 選擇國樂、西洋樂器或人聲，設定音域、譜號及難度。
- 分別調整音高與節奏挑戰，練習音階、大跳、附點、三連音等內容。
- 用樂譜播放、節拍器、音叉與小節循環練習；可調整譜面大小及閱讀版面。
- 收藏樂譜與設定，回到上次尚未完成的練習，並匯出樂譜 PDF。
- 在裝置上記錄練習日期、星點與陪伴角色。
- 選用麥克風測驗，先完成時間校正，再查看單音演奏的音準與節奏回饋；聲音在本機分析，不保存或上傳錄音。
- 提供繁體中文、簡體中文、英文、日文及其他介面語言。

麥克風回饋目前適用於支援範圍內的單音旋律，不提供多音和弦辨識。收音環境、樂器與設備延遲會影響結果；回饋供練習參考，不代表考級認證或保證的演奏準確率。部分樂器使用錄音取樣，其他為合成音色，來源與授權可在 App 內查看。

練習紀錄保存在裝置上，沒有 App 帳號或跨裝置同步。請妥善保存已匯出的檔案。

## Store listing draft — English

App name: **Sight Reading Generator**

Short description:

> Custom sight-reading studies with playback, a metronome and local feedback.

Full description:

Start with your instrument and a comfortable range. Sight Reading Generator creates new studies from your settings so you can practice reading pitches, rhythms and different meters at your own pace.

- Choose Chinese or Western instruments, or voice, and set your range, clef and difficulty.
- Adjust pitch and rhythm challenges separately. Focus on scales, leaps, dotted rhythms, triplets and more.
- Practice with score playback, a metronome, a tuning reference and passage loops. Adjust score size and reading layout.
- Save studies and presets, continue your last practice, and export score PDFs.
- Keep local practice-day records, earn practice stars and choose a companion.
- Optionally calibrate your microphone for single-note pitch and timing feedback. Sound is analyzed on your device; microphone recordings are not saved or uploaded.
- Use Traditional Chinese, Simplified Chinese, English, Japanese and other interface languages.

Microphone feedback supports single-note melodies within the supported range; it does not recognize polyphonic chords. Results depend on recording conditions, instrument characteristics and device latency. Feedback is a practice aid, not an examination certification or a guarantee of performance accuracy. Some instruments use recorded samples and others use synthesized sounds. Credits and licenses are available in the app.

Practice records are stored on your device. There is no app account or cross-device synchronization. Keep exported files in a location you control.

## Final content checks

- Remove draft markers only after replacing all publisher/contact/retention placeholders with facts and publishing the public policy URL.
- Add the final policy link or full text inside the app; the current credits link does not replace a privacy policy.
- Use actual Android-phone, iPhone and tablet screenshots for each relevant listing/device family. Do not describe a desktop preview as device verification.
- Verify microphone permission denial, cancel/background interruption, offline bundled playback, saved-library deletion, resume and PDF saving/sharing on the final native packages.
- Complete content rating and target-audience declarations using the publisher's intended audience. Do not select children as an audience merely because practice companions are illustrated.
- Keep full sample credits and restricted local-preview exclusion intact. Resolve the exact-source licensing evidence noted above before claiming the commercial rights audit is complete.
- Update this document and the policy if final native packaging changes permissions, backups, sharing, SDKs or networking.
