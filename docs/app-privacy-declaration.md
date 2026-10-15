# Apple App Privacy 申報準備

查核日期：2026-10-15（台北）
基準版本：App checkout `38771a057307ed8f93b90dde2f67771874fbd2c7` 與本輪未推送的原始碼變更；公開網站來源 commit `e155cda3e4687150841b6c7a2ac5f840eb38d8d0`。
狀態：公開政策已部署；使用者明確確認後，Apple **不收集資料的申報與政策 URL 已發布**。**App 未送審、未公開發行**；網站／申報發布沒有推送 App 儲存庫或觸發新 TestFlight。

## 本輪已核對狀態

- 公開網站於 **2026-10-15 15:21:48 UTC（台北 23:21:48）** 部署成功。首頁為 https://tonecraft-zhuoyin.smt2640630223.chatgpt.site ，正式繁中政策為 https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy ，支援頁為 https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/support 。首頁與三語政策／支援共 7 頁公開存取均成功（200），`.html` 連結轉向正式無副檔名路徑。
- 發布者 **YenHsiang Sun（琢音 TONECRAFT）** 已與 Apple Business 資料核對，且使用者已同意以法定姓名＋品牌公開。Email 為 **tonecraft.zhuoyin@gmail.com**；生效日 **2026-10-15**。App 設定與網站目前一致。
- 使用者明確確認發布後，Apple App Privacy 已完成最後發布並顯示「由 SUN Yen-Hsiang 於數秒鐘前發佈」，內容為 **No Data Collected** 與上述正式政策網址。證據：`.tmp-release-proof/apple-privacy-published.png`。App 正式版本仍未送審，不能把隱私申報發布寫成 App 已公開下載。
- 新版 Apple Developer Program License Agreement 已由使用者本人接受；重載後提醒消失，帳號 History 顯示 **Issued October 14, 2026; Accepted October 15, 2026**。此項已解決，未代替使用者接受協議。
- 年齡問卷已依目前功能儲存並重讀確認為 **4+（172 個國家／地區）**，各地區可有不同分級；沒有選擇 Made for Kids 或年齡覆寫。這與 App Privacy 申報及 App 審查是分開的項目。
- 審查聯絡四欄已按使用者授權使用 Apple 帳號姓名／電話與品牌 Gmail 儲存並重讀確認；不在本文件或公開網站寫入私人電話。首版免費價格也已儲存，台灣基準 0.00、定價表重讀 175 列全為 0.00。這些欄位不會替代 App 的資料流程申報。
- 使用者明確決定排除歐盟 27 國，發行選取 148 個地區並停用自動加入未來地區。DSA 表單採合併選項中的「不打算在歐盟發佈」條件完成，Business 顯示 27 個國家、2026/10/15 通過審查；不代表法律上的非貿易商認定或貿易商驗證。未來若加入歐盟須重新處理 DSA 與公開聯絡資料。這個發行範圍變更沒有改動原生 App 的本機處理方式。
- focused lint、499 項測試、Web build 與網址更新後的 `cap copy ios` 已通過；仍須實際送審 iOS archive／真機核對。部署識別與維護方式見 [public-support-site.md](./public-support-site.md)。

## 建議答案

以目前「原生 App 內附網頁、音源與圖像，練習資料在本機處理」的實作而言，**有原始碼證據支持選擇「否，我們不會從此 App 收集資料」（No, we do not collect data from this app）**。這裡的「收集」採 Apple 的申報定義，並不表示 App 沒有使用麥克風，也不表示 App 沒有在本機保存資料。

Apple 說明僅在裝置內處理的資料不屬於其標籤中的收集；若衍生資料會傳出裝置，必須另外判斷。依目前查核範圍，沒有發現將音訊、評分、練習歷史或識別碼送到開發者／合作夥伴伺服器的呼叫。[Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

| App Store Connect 項目 | 目前可支持的答案 | 理由 |
| --- | --- | --- |
| 是否收集資料 | 否 | 核心 App 的資料處理與保存均在本機，沒有查到上傳端點或分析 SDK。 |
| 用於追蹤的資料 | 無 | 沒有廣告、跨 App 廣告識別、資料經紀商或追蹤 SDK 的實作。 |
| Audio Data | 不因本機麥克風分析而單獨勾選 | 原始聲音只用於當次本機音高／節奏分析；沒有錄音檔保存或上傳流程。 |
| Product Interaction／Gameplay Content | 不因本機練習與精靈紀錄而單獨勾選 | 這些資料有本機保存，但未查到傳給開發者或合作夥伴的流程。 |
| Device ID | 不因本機校正鍵而單獨勾選 | 校正使用短雜湊鍵保存在本機；沒有上傳。雜湊本身不構成匿名保證。 |
| 使用者主動寄出的支援信件 | 另按實際送出流程判斷 | 目前只有 `mailto:` 開啟外部郵件服務，App 沒有客服表單、寄信 API 或自動附加練習資料；不可把這個事實概括成發布者從未收到個人資料。 |
| Privacy Policy URL | 已儲存並發布正式繁中公開網址 | `https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy` 已可公開讀取。即使不收集資料仍須提供政策。 |

本表不是要求勾選多個「否」欄位；在目前的 Apple 問卷中，選擇不收集資料後，後續資料種類問題通常不需作答。若之後新增網路分析、廣告、雲端同步、雲端 AI 或上傳錄音，本答案必須重新查核。

## 實際資料流程與證據

### 麥克風與校正

- `src/assessment/MicrophoneSession.ts:48`：只請求音訊、`video:false`；沒有相機請求。
- `public/capture-worklet.js:1-17`：以 2048 個樣本的短視窗，在 App 內的 AudioWorklet 與主執行緒之間傳遞音訊，`postMessage` 在這裡不是網路上傳。
- `src/assessment/MicrophoneSession.ts:83-92`：即時分析樣本，留下時間、音高、可信度、音量與過載狀態等數值觀察；未將原始音訊寫成檔案。
- `src/assessment/MicrophoneSession.ts:12-20,93-105`：停止時中止音軌並關閉音訊工作；完整樣本／觀察數值的當次生命週期在記憶體中，沒有查到 MediaRecorder 或音訊檔持久化。
- `src/components/AssessmentPanel.tsx:32`：畫面隱藏時停止測驗或校正。
- `src/assessment/calibration.ts:29-47`：校正偏移、離散程度、日期、輸出種類與路徑雜湊存在 localStorage。原始麥克風 deviceId 不會直接保存；`audioRouteKey` 為短本機雜湊，不能描述成密碼學匿名化。
- `ios/App/App/Info.plist:29-30`：已有麥克風使用說明。授權視窗與 App Privacy 標籤是不同要求，不能互相取代。

### 本機紀錄

| 資料 | 保存方式及內容 | 證據 |
| --- | --- | --- |
| 收藏樂譜與設定 | localStorage；譜例、樂器、音域、難度、速度、日期和本機項目 ID；最多 50 份譜與 20 組設定 | `src/hooks/useLibrary.ts:4-20`、`src/practice/library.ts:14-17,101-118` |
| 上次練習 | localStorage；譜例快照與播放位置，不會自動恢復發聲 | `src/hooks/usePracticeResume.ts:5-35`、`src/practice/resume.ts:4-35` |
| 練習評分摘要 | localStorage；最多 100 筆可信的完成紀錄，包括時間、樂器、難度、速度、音準／節奏／完成度；詳細當次逐音結果在畫面狀態中 | `src/practice/training.ts:8-31`、`src/hooks/useTraining.ts:4-12`、`src/App.tsx:98` |
| 精靈與練習進度 | localStorage；星點、XP、完成 ID、練習日期、已解鎖精靈、所選形態與陪伴秒數 | `src/progress/progress.ts:45-57`、`src/progress/useProgress.ts:4-22` |
| 避免相似出題 | localStorage；最近題目的旋律、節奏、樂句與和聲數值摘要 | `src/practice/recentVariety.ts:153-190` |
| 使用偏好 | localStorage；語言、樂器、畫面與樂譜大小、音叉頻率等 | `src/i18n/I18n.tsx:25-28`、`src/practice/instrumentPreference.ts:3-14`、`src/hooks/useLayoutSize.ts:5-14`、`src/hooks/useScoreFocus.ts:5-18`、`src/audio/tuningFork.ts:9-22` |

收藏／設定可逐筆刪除（`src/hooks/useLibrary.ts:19-20`）。查核基準版沒有「清除所有 App 本機資料」的整合按鈕，也沒有開發者伺服器端帳號或刪除 API；政策不可聲稱已有這些功能。刪除 App、清除網站資料、作業系統備份與之後還原的實際行為應分別說明，不應保證單一操作永久刪除使用者所有備份或已分享檔案。

### 網路、音源、字型與外部連結

- `capacitor.config.ts:3-29`：`webDir:'dist'`，沒有設定遠端 `server.url`。原生 App 使用內附的前端資源。
- `src/audio/createPlaybackInstrument.ts:18-29`：音源從 `BASE_URL + samples/...` 讀取，音源清單沒有 HTTP(S) 網址；開發時的本機琵琶例外仍是本機 URL。
- `src/audio/loadRecordedSamples.ts:97-109` 的 fetch 是讀取上述音源，不是把使用者演奏上傳。`src/native/loadSoundCredits.ts:3-9` 是讀取同來源的授權文字。
- `index.html` 與 `src/index.css` 使用本機入口及系統字型，未引用外部追蹤、廣告或字型 CSS。
- 樂譜使用完整 `vexflow` 入口：`node_modules/vexflow/build/esm/entry/vexflow.js:1-27` 以內嵌的字型資料初始化；例如 `src/fonts/bravura.js:1` 是 `data:font/woff2`。VexFlow 套件另有 CDN 預設常數，但目前 App 未呼叫以該預設下載的 `loadFonts`，不能只因搜尋到 CDN 字串就判定 App 使用外部字型服務。
- `src/components/SetupPage.tsx:286-289` 有使用者點擊才開啟的樂器資料來源連結，`target='_blank'`、`rel='noreferrer'`。來源網站可依自己的政策處理連線資料；這不是 App 暗中上傳練習歷史。
- `public/samples/*/provenance.json` 和 `CREDITS.txt` 內的來源網址是來源／授權紀錄，不能等同於執行中的網路端點。

**原生 App、公開支援網站與支援郵件分別判斷。** 以下政策內容已納入三語共用來源 `src/legal/content.ts`；本輪已透過部署、公開 HTTP 與 Apple 後台確認網站公開及隱私申報發布。App 正式發行狀態仍須分開確認。

### 公開支援網站及電子郵件

- 公開介紹、支援及隱私權政策頁是靜態內容，透過 OpenAI Sites／Cloudflare 代管提供，並不是把原生 App 的練習紀錄公開上傳。發布者沒有加入分析 SDK、廣告、追蹤工具、資料提交表單或跨網站練習資料同步。
- 訪客向網站請求頁面時，代管服務商會處理 IP 位址、時間、瀏覽器與請求路徑等連線資料以傳送內容及維護安全。沒有查得可適用於此部署的固定代管紀錄保存期限，因此政策不捏造保存天數，也不將網站說成「完全不處理任何資料」。提供者的處理依其條款及政策：[OpenAI](https://openai.com/policies/privacy-policy/)、[Cloudflare](https://www.cloudflare.com/privacypolicy/)。
- App 內政策與支援對話框讀取完整本機文字，提供 `mailto:` 聯絡，沒有公開網站連結按鈕；正式 URL 配置給商店與政策資料。公開網站的請求紀錄不應直接等同於原生 App 會自動上傳使用資料。若改為嵌入遠端網頁、內建客服或加入網站遙測，必須重做 App Privacy 判斷；Apple 特別要求評估 App WebView 的網路流量。
- 專用支援信箱為 `tonecraft.zhuoyin@gmail.com`。使用者來信時，發布者會收到寄件地址、內容及自行提供的附件；用途僅為處理詢問及後續支援，不作廣告、追蹤或名單行銷。Gmail 的處理、安全、備份及刪除另依 [Google 隱私政策](https://policies.google.com/privacy)。
- 帳號持有人已確認：**發布者保留的支援信件及附件，在問題處理完成後最遲 90 天內刪除；法律要求保留的部分除外。** 這是發布者對其持有副本的作業承諾，不是對 Gmail 或網站代管商所有備份及紀錄的保存期限保證。應在實際客服作業中記錄處理完成日並執行刪除，清除 Gmail 垃圾桶中的相關副本；使用者可透過專用信箱提出刪除請求。

Apple 的 Optional Disclosure 例外要求所有條件同時符合：非追蹤及非廣告／行銷用途、偶發而非主要功能、使用者自願，以及送出介面清楚呈現資料和姓名／帳號且每次主動提交。僅有「自願來信」不足以證明整套例外成立。目前 App 沒有內建提交介面，`mailto:` 是讓使用者自行透過外部郵件服務聯絡；「App 不收集資料」的依據是目前原生 App 沒有資料上傳流程，不能改寫成「客服信件一律不必申報」。若加入 App 內客服表單或自動傳送診斷，應依實際流程重新判斷是否要揭露 Email Address、Customer Support、其他提交內容及是否連結使用者。[Apple：App Privacy Details（Data collection、Optional disclosure、Web views）](https://developer.apple.com/app-store/app-privacy-details/)

### PDF、分享與備份界線

- `src/export/exportScorePdf.ts:9-68`：在裝置內建立 PDF；內容包括譜例、樂器標題、設定摘要與明確速度，沒有聲音錄音。
- `src/export/savePdfBlob.ts:24-44`：原生 App 先將 PDF 寫入 App 快取，再叫出系統分享面板；使用者可自行選擇檔案、郵件、雲端硬碟等目的地。
- `src/export/savePdfBlob.ts:48-56`：瀏覽器以 Blob URL 下載。
- 以上表示使用者可主動把 PDF 傳離裝置；應寫「App 不會自動將練習資料上傳給開發者」，**不要寫「任何資料永遠不會離開裝置」**。
- Android 明確停用備份並在 `backup_rules.xml`／`data_extraction_rules.xml` 排除各資料領域。iOS 原始碼沒有查到全面排除 WebView 本機資料備份的設定，所以不能保證 iOS 裝置備份或使用者自行保存的內容只存在單一裝置。

### SDK 與原生隱私宣告

- `package.json:16-28`：執行期套件為 Capacitor、React、Tone、VexFlow、jsPDF；沒有列入廣告、Firebase、Sentry、Amplitude 等分析或崩潰回報 SDK。
- `ios/App/CapApp-SPM/Package.swift:13-28`：原生插件為 CapacitorApp、Filesystem、Share。Filesystem 另依賴 `ion-ios-filesystem`（本機 `node_modules/@capacitor/filesystem/Package.swift:13-24`）。這些不是雲端儲存服務名稱。
- `ios/App/App/AppDelegate.swift`、`SceneDelegate.swift` 未加入自訂遙測或上傳。
- `ios/App/App/PrivacyInfo.xcprivacy:5-17`：`NSPrivacyTracking=false`、`NSPrivacyCollectedDataTypes=[]`，File Timestamp 使用理由為 `C617.1`，用於文件／快取操作。
- 本機 Capacitor／Cordova 核心的 privacy manifests 亦列出無收集／無追蹤。但 App 自己的 manifest **不會自動替代 App Store Connect 問卷**，也不能僅憑 manifest 保證所有依賴與最終 archive 的實際行為。
- `MEMBERSHIP_ENABLED=false`，沒有啟用的付款／訂閱 SDK；星點是本機練習獎勵。文案中的「跨裝置同步（規劃）」不是目前資料流程。

## 實際填寫路徑

1. App Store Connect → App →「App 隱私權」→ 開始使用。
2. 在正式封版和實機網路查核相符的前提下，選擇不收集資料，儲存。
3. 在隱私權政策欄填入公開 HTTPS 網址；選擇性填寫隱私權選項網址。
4. 檢查產品頁預覽。按「發布」會確認申報正確並公開／待產品頁公開時顯示；執行前核對實際資料流程、政策網址與本次授權範圍。

上述路徑與權限要求來自 [Apple：Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)。本輪已在使用者明確確認後完成第 1–4 步，並重新核對發布結果；正式 App 版本仍未送審。

## 正式封版前需完成的驗證

- 用預定送審的 iPhone／iPad archive 實測：生成、播放、校正、測驗、收藏、精靈與 PDF 匯出；利用裝置的網路記錄確認沒有意料外的資料傳輸。
- 在 Xcode archive 的 privacy report 中核對最後解析到的原生依賴；Windows 原始碼稽核無法替代 Mac 封存檔的彙整報告。
- 本輪已確認公開網址可匿名存取三語政策與支援頁。今後每次重部署應再次確認沒有未預期的表單、遙測或追蹤工具；網站代管與 Gmail 的處理、發布者的 90 天支援信件刪除方式應與已公開政策一致。
- 若變更版新增清除本機資料入口，需驗證它包含 library、resume、training、calibration、progress、recent variety 與偏好；外部已分享 PDF 或 OS 備份不受此按鈕控制。
- 本輪已檢查 Apple 發布的申報與政策 URL；尚未在 iPhone／iPad 執行封包攔截、備份／還原測試或最終 archive privacy report。不要把原始碼查核或 Web build 通過說成真機全項完成。
