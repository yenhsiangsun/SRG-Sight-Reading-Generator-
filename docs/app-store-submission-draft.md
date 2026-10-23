# App Store 正式上架資料草稿

**2026-10-23 新一輪授權**：使用者要求「上傳最新版 然後提交審查」。本輪準備上傳包含 C 長線展開、雙聲部和聲、節奏分級、琵琶輪音記譜與星點確認兌換的最新來源；880 項測試通過。已重讀 Apple：目前仍是舊 1.0（12）的準備審查草稿，尚無等待審查證據；已開始移除該舊項目以便更換新 build。本輪不把歷史成功提示當成已完成送審。商店文案將移除已停用的麥克風測驗、小節循環及時間成長說法，改為實際星點兌換。最終 build、提交識別碼與狀態待 Apple 實際回傳後另存結果。

核對日期：2026-10-16（Asia/Taipei）。本文件保存本輪商店文案、審查說明與已驗證的後台狀態。使用者本輪明確表示先不進行 iPhone Duo／雲端實機測試，改為授權正式上架。**1.0 (12) 已執行正式送審操作，Apple 顯示提交成功提示，但後續全新清單仍為「準備審查」且詳情頁報錯，實際進入審查尚未確認；勿重複送件。尚未核准或公開發行。** 發布方式已改為審核通過後自動發布，維持免費及 148 個發行地區（排除歐盟 27 國）。

本次 Submission ID：`ce7d54ba-06c0-4c4f-ada0-f9ede29de2db`。送出當時的 DOM 觀察顯示「已提交 1 個項目」；`.tmp-release-proof/apple-formal-submission-confirmation.png` 的裁切沒有拍到該視窗，不能當作成功提示的圖片證據。後續完整錯誤頁證據：`.tmp-release-proof/apple-review-verification-error.png`。成功提示不等於 Apple 已開始審查、核准或商店已可下載。

**2026-10-16 22:20（Asia/Taipei）複查及本輪後續**：重新載入 App 審查頁仍報錯；當時重新讀取的 App 清單顯示 iOS 1.0 為「準備審查」。其後使用者已完成 Apple 重新登入與驗證，但審查清單、版本詳細及同一 Submission ID 的詳情頁仍顯示「抱歉，發生錯誤」，重新載入的 App 清單也曾持續轉圈。官方系統狀態未公告相關事故，不能據此判定本次故障原因。使用者已明確授權送出 Apple Developer 聯絡頁「App 審查 → 其他 App 審查問題」的支援回報，內容包含 App 名稱／ID、iOS、提交成功提示與未確認進入等待審查的經過及同一 Submission ID；**回報已送出，Apple 確認收到並提供案例 ID `102998672834`，目前等待 Apple 回覆**。確認頁證據：`.tmp-release-proof/apple-support-case-102998672834.png`。這是支援案件受理，不代表 App 已進入審查；本輪沒有再次點擊 App 送審或建立新 build，尚無 **Waiting for Review／等待審查** 證據，仍未證明送審完成，也尚未公開；不重複建立或送出另一筆提交。Sauce Labs 支援信仍保留為未寄出的 Gmail 草稿。

## 本輪上架準備狀態

- **公開網站已完成**：2026-10-15 23:21:48（台北）部署。首頁 https://tonecraft-zhuoyin.smt2640630223.chatgpt.site ；政策 https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy ；支援 https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/support 。首頁與繁中、簡中、英文政策／支援共 7 頁公開請求均成功（200）。
- **發布者已確認**：YenHsiang Sun（琢音 TONECRAFT）；使用者已同意公開法定姓名＋品牌。支援 Email 為 tonecraft.zhuoyin@gmail.com，政策生效日 2026-10-15，支援處理完成後最遲 90 天刪信（法律要求除外）。
- **Apple 隱私申報已發布**：使用者明確確認後已完成最後發布；Apple 顯示「由 SUN Yen-Hsiang 於數秒鐘前發佈」，內容為 No Data Collected 與正式政策 URL。證據：`.tmp-release-proof/apple-privacy-published.png`。
- **開發者協議已處理**：使用者本人接受新版 Developer Program License Agreement；重載後提醒消失，帳號 History 顯示 Issued October 14, 2026; Accepted October 15, 2026。
- **年齡分級已儲存並重讀確認**：依目前實作作答後為 4+（172 個國家／地區），另有各地區分級；沒有選 Made for Kids 或年齡覆寫。證據：`.tmp-release-proof/apple-app-info.png`。
- **商店欄位已儲存並重新讀取確認**：繁中副標題、主要教育／次要音樂類別、1.0 宣傳文字與 713 字描述、關鍵字、正式支援 URL、網站首頁 Marketing URL、Copyright `2026 YenHsiang Sun · TONECRAFT`，以及英文審查說明與正式網址。審查不需要登入，登入需求未勾選；本輪依使用者正式上架意圖，版本發布方式已改為審核通過後自動發布。
- **審查聯絡已完成**：使用者授權後填入 Apple 帳號姓名／電話，Email 使用品牌 Gmail；儲存並重新開啟確認姓名正確、電話與 Email 有值，Save 已停用且無警示。私人電話只填於 Apple 審查聯絡，不寫入公開網站或本文件。
- **首版免費已完成**：台灣基準價格 0.00 已儲存；重讀定價彈窗共 175 個價格列全部為 0.00。正式首版維持免費下載、不限出題，沒有訂閱或自動扣款。證據：`.tmp-release-proof/apple-free-pricing.png`。
- **發行地區已完成設定**：使用者後續明確決定排除歐盟 27 國；已由全部 175 個地區改為 148 個，並關閉自動加入未來新地區。新畫面確認 148：台灣、英國與瑞士顯示 Available on App Release；法國、德國仍顯示處理為 Not Available。選定地區不等於全部已公開下載。證據：`.tmp-release-proof/apple-worldwide-except-eu.png`。
- **DSA 表單已依不在歐盟發行的條件完成**：採用表單內「非貿易商，或者不打算在歐盟發佈」的合併選項，依據是後者；Business 顯示數位服務法 27 個國家、2026/10/15 通過審查。這不是法律上的非貿易商身份判定，也不是已驗證貿易商身份。
- **新版 TestFlight 已可測試**：source `555d0505b35188f2ce9bb6a799b03c4e4da1d6ad` 的 Codemagic #12 成功建置並上傳，Apple 已完成處理。1.0 (12) 已加入內部群組 `22f627bb-f031-4af4-bb0d-e45ecdc29cab`（1 名測試者），群組版本列顯示「正在測試」及剩餘 90 天。使用者已於 2026-10-16 確認 iPad 中文字顯示正常；其後決定暫不繼續 iPhone Duo／雲端實機測試並授權正式送審，未完成的實機項目仍記為未驗證。
- **正式送審操作已執行**：App Store 1.0 使用 **1.0 (12)**，送出前已確認版本選擇。送出當時 DOM 顯示「已提交 1 個項目」，Submission ID 為 `ce7d54ba-06c0-4c4f-ada0-f9ede29de2db`。Apple 顯示提交成功提示，但後續全新清單仍為「準備審查」且詳情頁報錯，實際進入審查尚未確認；勿重複送件。尚未核准或公開發布。
- **商店截圖已補齊最低組合**：使用者提供實機畫面後，已製作並上傳 iPhone 1179 × 2556 與 iPad 2048 × 2732 展示圖各一張；繁體中文 App Store 1.0 草稿重新載入後仍各顯示一張。圖片處理與來源證據見 `docs/store-screenshots.md`。本輪已執行正式提交，不再把等待完整實機測試或再次授權列為送審阻擋。
- 詳細部署證據見 [public-support-site.md](./public-support-site.md)。

## 本輪 TestFlight 與正式送審證據

使用者原先要求先上傳 TestFlight、測試後才送審；2026-10-16 本輪已明確改為暫不進行 iPhone Duo／雲端實機測試，直接正式上架，取代先前的送審等待條件。沿用已處理的 **1.0 (12)**，沒有另建 App 版本或重新觸發 CI。2026-10-15 本地驗證為 499/499 tests、完整 lint（僅既有 MobileInstallPrompt 警告）、production build 與 cap sync ios 通過。449 個路由使用中的音源檔及 664 個 dist/native web 檔已逐檔核對；三個封存音源目錄與未使用模板圖示未包入。

2026-10-16 已核對實際 IPA 與 Apple TestFlight：

- **雲端建置成功**：Codemagic #12，build ID `6ad0f8a812cce3cb996db903`，source commit `555d0505b35188f2ce9bb6a799b03c4e4da1d6ad`。雲端測試 498 項通過、0 失敗、1 項跳過；跳過的是不隨 Git 提交的選用原始音源快取檢查，不是測試失敗。
- **上傳成功且 Apple 已處理**：Apple UUID `7fcccdbb-12dd-46f1-853f-3a1c14eefbd2`；上傳時間 2026-10-15 16:15:39 UTC，即 2026-10-16 00:15:39 台北時間。上傳結果為 `UPLOAD SUCCEEDED with no errors`。
- **實際 IPA 檢查通過**：bundle `com.yenhsiang.sightreadinggenerator`，1.0 (12)，device families 1、2（iPhone／iPad）。IPA SHA-256 `493fcdb4493bbe0982fdd8665f9c3b4a93d72aa9f6affa92e7d9b43deae4ddd3`。全部 664 個建置 web 檔與封裝內容相同；615 個打包音檔包含 449 個路由音檔及 166 個已額外查核來源的舊輸入／未使用音檔，詳見內容權利文件。封存三目錄均排除，沒有開發伺服器 override。
- **內部測試已啟用**：版本加入群組 `22f627bb-f031-4af4-bb0d-e45ecdc29cab`，1 名測試者；群組版本列為「正在測試」，顯示剩餘 90 天。264 字元的繁中「測試內容／What to Test」說明已儲存。
- **App Store 送審版本已選定**：1.0 使用 1.0 (12)，送出前已確認選擇。Apple 顯示提交成功提示，但後續全新清單仍為「準備審查」且詳情頁報錯，實際進入審查尚未確認；勿重複送件。成功提示依當時 DOM 觀察記錄，沒有公開發布。
- **實機測試範圍如實保留**：iPad 中文字與使用者提供的實機練習畫面已有證據；iPhone 真機聲音、麥克風／延遲、音訊中斷恢復及原生 PDF 分享未完成驗證。使用者決定暫不繼續該測試並授權送審，不能將這項決定寫成測試通過。Sauce Labs 未成功開通、未上傳 App 或開始裝置測試；支援信保留未寄出的 Gmail 草稿。

本機收據為 `.tmp-testflight-1.0-12-release.json`；實際 IPA 檢查為 `.tmp-release-proof/build12-artifacts/build/ios/release-inventory.json`。

[content-rights-release.md](./content-rights-release.md) 已記錄第三方音源、38 個套件及 6 個字型的權利依據，完整 notices 包含於離線音源授權視窗。3478 字元的審查備註已加入英文內容來源與授權說明，Apple 顯示儲存完成。商店截圖實際操作與尺寸見 [store-screenshots.md](./store-screenshots.md)，尚未把準備計畫當作圖片已完成的證據。

Apple「內容版權」現已選擇「是，此 App 具有第三方內容的必要權利」，儲存完成並重新載入確認。這是依記錄的第三方許可作答，並非宣稱所有素材皆由發布者原創。2026-10-16 的雲端 #11 在 macOS 暫存目錄別名的測試清理檢查失敗，未 archive 或上傳；修正只涉及測試路徑正規化，已以一般路徑與別名路徑各驗證 3/3 通過。修正版 commit `555d0505b35188f2ce9bb6a799b03c4e4da1d6ad` 的雲端 #12 已成功，並以 Apple 實際處理完成及群組「正在測試」狀態確認本次交付。

原 #12 的模擬器截圖作業沒有產生 PNG，不能當成截圖已完成。下列為歷史首輪獨立截圖作業，均已結束且沒有產出可用 PNG；最新結果與繁中環境重試的失敗驗收以 `docs/store-screenshots.md` 為準，不發布另一個 App build：

| 目標 | Codemagic job ID | 隔離分支 | Commit |
| --- | --- | --- | --- |
| iPad | `6ad0fe9312cce3cb996dd877` | `codex/store-screenshot-capture` | `f2a0da3` |
| iPhone | `6ad0ff1f45beff93db2985f0` | `codex/store-screenshot-iphone` | `7d499ba` |

五張正式網頁 UI 草稿僅用於確認內容與構圖，沒有當作原生截圖上傳。模擬器缺字曾阻擋截圖，後續已改用使用者提供的兩裝置實機圖製作展示圖；兩張皆已上傳正確裝置欄位、處理完成並在重載後確認保存。原先模擬器圖片仍為拒收診斷資料。

## 名稱與建議設定

| 欄位 | 可用內容／處理方式 |
| --- | --- |
| App 名稱 | **Sight Reading Generator**。保留目前 App 名稱，不自行改名。 |
| 品牌 | **琢音 TONECRAFT**。品牌名稱不取代 Apple 個人開發者帳號的法定銷售者身份。 |
| 繁體中文副標題 | **有旋律的視譜與節奏練習** |
| 主要類別建議 | **教育 Education**：核心用途是循序學習視譜與演奏。 |
| 次要類別建議 | **音樂 Music**：樂器、五線譜、播放與練習工具。 |
| 使用者支援 Email | **tonecraft.zhuoyin@gmail.com** |
| 支援 URL | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/support |
| 隱私政策 URL | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy |
| 收費 | 首版免費下載已儲存：台灣基準 0.00，重讀 175 個價格列全部 0.00；現階段不限出題，`MEMBERSHIP_ENABLED=false`，無可用訂閱或內購流程。 |
| 發行地區 | 使用者明確選擇排除歐盟 27 國，現設定 148 個地區；自動加入未來地區已關閉。實際發行仍以各地區要求與審查狀態為準。 |
| 發布方式 | 本輪已改為審核通過後自動發布；收到提交成功提示不代表已通過或公開。 |

副標題限制 30 字元；以下宣傳文字低於 170 字元、描述低於 4,000 字元。關鍵字以 UTF-8 bytes 計算，維持低於 100 bytes，避免重複 App／品牌名稱。欄位規則與支援頁要求以 [Apple 平台版本資訊](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) 為準。

## 繁體中文商店文案

### 宣傳文字

從適合自己的音域開始，練習音高、節奏與樂句。每次生成一份有旋律的新譜，搭配播放、小節循環與音階練習，讓日常練習更有方向。

### 描述

練習讀譜，也練習把音符奏成音樂。

Sight Reading Generator 是琢音 TONECRAFT 的視譜練習工具。選好樂器、音域與難度，即可產生一份新的短篇樂譜；讓每次練習保留旋律的起伏與樂句的完整感。

依自己的程度練習
・選擇國樂、西洋樂器或人聲，直接在譜表上設定音域。
・分別調整音高難度與節奏複雜度，選擇希望練習的調號、拍號與混合拍子。
・可搭配音階、附點、十六分音符、三連音、大跳等練習重點，也能混合選擇。

用簡單工具，練好每一段
・播放樂譜，跟著游標掌握音符與節奏位置。
・選擇小節反覆練習，使用節拍器與可調赫茲的音叉。
・在練習頁調整音域與難度，繼續產生下一份樂譜。
・收藏喜歡的譜、保存練習設定，或匯出標明速度的 PDF。

讓練習慢慢累積
・查看本機練習紀錄，讓森林手繪精靈隨練習時間成長。
・已解鎖的成長造型可自由切換，保留自己喜歡的樣子。
・不需註冊 App 帳號，練習資料保存在裝置上。

選用演奏回饋
・測驗模式提供麥克風時間校正，以及單音旋律的音準、節奏與音長回饋。
・聲音在裝置上即時分析，不保存為錄音檔，也不由 App 上傳。
・不開啟麥克風，仍可使用出題、看譜及播放功能。

演奏回饋目前支援單音旋律及指定音域，不辨識多音和弦；收音環境、樂器特性與裝置延遲會影響結果。回饋供個人練習參考。部分國樂器使用其他錄音樂器作為替代音色，播放來源與授權可在 App 內查看。

本機資料目前不支援 App 自有的跨裝置同步。刪除 App 或清除資料前，請先匯出想保留的樂譜；PDF 不包含完整練習紀錄或精靈進度備份。

支援與意見：tonecraft.zhuoyin@gmail.com

### 關鍵字

```text
視譜練習,節奏訓練,五線譜,節拍器,音階練習,音準訓練
```

這份文案只描述現行本機產生與演奏功能。不宣稱 AI 雲端作曲、真人教學、考級認證、所有樂器均為原樂器錄音，或尚未完成的會員與同步服務。

## 可直接使用的英文審查說明

```text
Sight Reading Generator is a music sight-reading practice app by TONECRAFT.
No app account, sign-in, demo account or purchase is required.

To review the main flow:
1. Start a practice session from the home page.
2. Choose an instrument, set its written range and clef, then choose pitch and rhythm difficulty. Generate a score.
3. Play the score, use the metronome or tuning reference, and try a passage loop from Practice Tools.
4. Save a score or export it as PDF. On iOS/iPadOS, PDF export opens the system share sheet; choose Save to Files or another destination.

Optional microphone assessment:
Choose a monophonic instrument such as Flute and a written range within C3–F#6, with no chords. Open Test Mode and perform the timing calibration before starting an assessment. Follow the four audible count-in clicks and the calibration score/cursor, playing the displayed note as instructed. The microphone is requested only when calibration or assessment starts.

Polyphonic scores and notes outside the supported assessment range disable the assessment start button. Denying microphone permission does not block score generation or playback. Assessment is a practice aid and does not claim examination certification or polyphonic recognition.

The native app bundles its practice engine, playback samples and illustrations. Core score generation and playback do not need a network connection. Some Chinese instruments intentionally use similar recorded instruments as playback substitutes; the app discloses this in its sound information.

Microphone input is analyzed on the device. No audio recording is saved or uploaded. Practice data remains in local app storage. PDFs leave the app only when the user chooses a sharing destination. Support and license links open external destinations only when selected.

Membership and payment features are disabled in this version. Practice stars are earned through practice and are not sold or redeemable for money.

Support: tonecraft.zhuoyin@gmail.com
```

正式支援、Marketing URL 與英文審查欄位已使用上表的公開網址並儲存；上述內容為審查操作指引，不表示每項流程均已完成 iPhone 真機驗收。程式中的單音辨識範圍為 MIDI 36–90（C3–F#6）；樂器自己的音域可能更窄，兩個限制都須遵守。不要以鋼琴含和弦題目示範單音測驗。審查聯絡四欄已按使用者授權填寫並重讀確認；私人電話不列在商店描述或本文件中。

## 年齡分級：按功能填答的依據

本輪已按目前實作完成問卷、儲存並重讀確認為 **4+（172 個國家／地區）**，其他地區依本地規則顯示分級。現行內容沒有成人、暴力、醫療、賭博或聊天內容；以下保留填答依據，未來功能變更時須重查。[Apple 分級定義](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)

| 問卷範圍 | 現行實作對應 |
| --- | --- |
| 家長控制／年齡驗證 | 無專門的家長限制或年齡驗證功能。 |
| 無限制網頁存取 | 無網址輸入或通用網頁瀏覽器；固定支援／授權連結與系統分享另行檢查最終包。 |
| 使用者內容／社群／聊天 | 沒有公開內容社群、投稿、訊息或聊天；本機收藏和使用者主動匯出 PDF 不等同 App 內社群。 |
| 廣告 | 無廣告 SDK 或付費廣告版位。 |
| 成人、醫療、暴力內容 | 目前題庫、介面與角色內容沒有這些主題；應填沒有。 |
| 賭博／模擬賭博／戰利品箱 | 無下注、機率購買或現金兌換。星點用於明確選擇的造型，無隨機抽取。 |
| 競賽 | 現行測驗為個人本機回饋，沒有排行榜或玩家競爭；如後台文字涵蓋個人測驗，須按當次問卷定義核對。 |

本輪維持一般音樂練習工具定位，沒有勾選 Made for Kids 或較高年齡覆寫。兒童專屬分類與低年齡分級不同，若未來要改定位需另外確認；Apple 說明 Made for Kids 選項在通過審查後不能改變。[Apple 設定年齡分級](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)

## 商店截圖：iPhone／iPad 各一張已保存

截至 2026-10-15，Apple 官方頁面的必要類別為 iPhone Dynamic Island **medium display** 與（支援 iPadOS 時）**13 吋 iPad**。每個裝置尺寸至少 1 張、最多 10 張，JPEG／PNG，不能帶透明通道。可採下列同方向尺寸；若後台有更新提示，重新依該欄位核對。[Apple 截圖規格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

| 必要類別 | 官方接受尺寸（直向） | 對應橫向 |
| --- | --- | --- |
| iPhone Dynamic Island medium | 1179 × 2556 或 1206 × 2622 | 2556 × 1179 或 2622 × 1206 |
| iPad 13 吋 | 2064 × 2752 或 2048 × 2732 | 2752 × 2064 或 2732 × 2048 |

本輪先完成 iPhone／iPad 各一張正式商店展示圖，主要呈現實際生成的練習樂譜。使用者提供的原始附件為 590 × 1280 與 960 × 1280 壓縮 JPEG；展示圖以完整等比例實機畫面配合琢音標題與米白背景，輸出 1179 × 2556 與 2048 × 2732 RGB JPEG，沒有重畫音符、遮住功能或宣稱恢復原生解析度。兩張經獨立目視檢查後上傳繁體中文草稿，Apple 接受尺寸並各顯示一張，重新載入確認保存。檔案與 SHA-256 在 `docs/store-assets/zh-TW/`；五張網頁草稿保留為往後擴充圖集的參考，不是本次上傳的圖片。這解決商店圖片的最低資料需求，不代表完整 iPhone／iPad 功能與直橫向測試或 Apple 審查已通過。

## 地區與 DSA 的實際邊界

使用者最初希望全球可用，之後為避免公開私人聯絡資料，明確選擇**先排除歐盟 27 國**。因此現況是選擇 148 個地區，不是「全球全部」；關閉自動新增地區可避免未檢查的新區域被加入。價格表有 175 列、分級顯示 172 個地區，都不代表已選取相同數量的發行地區。

DSA 表單使用合併選項中的「不打算在歐盟發佈」條件，與已移除 EU 的設定一致；不能把後台通過審查寫成發布者已被認定為法律上的非貿易商。日後若加入歐盟，須重新處理 DSA 身份／公開聯絡資料要求並取得使用者決定，不能沿用本次排除歐盟的選項。這不是用免費首版推定非貿易商。

Apple 選取的地區仍可能因各區要求、核准或其他後台條件而延後或無法發行；正式狀態需以各地區實際可用性為準，不保證一經送審便在所有 148 區同步公開。

## 後續免費額度與訂閱方向（未實作）

發布者提出未來「每天免費生成 3–5 份新譜，訂閱可不限出題」的想法。**目前仍維持免費、無每日額度、無訂閱，沒有修改 App、政策或後端。** 現階段免費測試不是 StoreKit 免費試用，不會因時間到了自動扣款，也不應宣傳成「永久不限量」。

產品建議先採 **每天 5 份新譜**，給使用者足夠空間選擇音域／難度；反覆播放、練習與打開已收藏譜不限次數。只計算成功提供給使用者的新譜，失敗、取消及出題引擎內部候選嘗試不重複扣額。這些只是下一版設計建議，尚未成為使用者已核定的額度規則。

若未來採自動續訂，建議同一訂閱群組只提供同等權益的月繳／年繳，購買前講清楚不限新譜的範圍；持續的練習內容／功能改進作為續訂價值。不能只把現有功能鎖住就宣稱保證通過訂閱審查。Apple 要求持續價值、至少 7 天及支援使用者所有可用裝置，亦須保留既有已付費買斷權益；實作再依當時規則驗證。[Apple Review Guidelines 3.1.2](https://developer.apple.com/app-store/review/guidelines/#subscriptions)

上線訂閱前先完成：StoreKit 購買與權益驗證、恢復購買／訂閱狀態與管理入口、取消／到期／退款／換機恢復處理及實機 Sandbox 測試。付費頁清楚列出名稱、週期、完整實際扣款總額、權益、條款與隱私連結；若日後提供真正的訂閱免費試用，須同時說明試用期與結束後費用，不能把每日免費額度叫作自動續訂試用。[Apple 自動續訂設計說明](https://developer.apple.com/app-store/subscriptions/)

新增訂閱時需重新檢查資料流程、政策與商店申報；目前「No Data Collected」是按現行本機版本查核，不能預先套到未來新增的購買 SDK、交易紀錄、帳號或雲端服務。若日後改為包含歐盟的發行範圍，須按上節重新處理 DSA；本文件沒有代為判定發布者的法律交易者身份。

## 正式提交後的狀態與後續

1. 公開政策、發布者資料、90 天支援信保存方式、App Privacy、開發者協議、年齡問卷、審查聯絡與內容權利資料均已準備；iPhone／iPad 商店展示圖已各上傳並重載確認。
2. 本次使用已處理的 **1.0 (12)**；使用者本輪明確取消繼續 iPhone Duo／雲端實機測試並授權正式上架，原先等待實機測試後再次確認的條件已被取代。沒有為本次送審建立新 build。
3. 已按正式送審最後按鈕，當時 DOM 顯示「已提交 1 個項目」；Submission ID `ce7d54ba-06c0-4c4f-ada0-f9ede29de2db`。Apple 顯示提交成功提示，但後續全新清單仍為「準備審查」且詳情頁報錯，實際進入審查尚未確認；勿重複送件。完整錯誤頁證據為 `.tmp-release-proof/apple-review-verification-error.png`；`apple-formal-submission-confirmation.png` 未拍到成功視窗，不能當作該提示的圖片證據。
4. 發布方式已改為審核通過後自動發布；免費、148 個地區（排除 EU27）及不自動加入未來地區的設定維持。尚未核准或公開發布，各地區是否可下載仍須以正式商店狀態確認。
5. 未完成的 iPhone 真機聲音、麥克風／延遲、中斷恢復與原生 PDF 分享仍列為未驗證；若後續出現具體缺陷或 Apple 要求補充，再按實際問題處理。音源清理與授權證據以 `docs/audio-release-audit.md` 及 `docs/content-rights-release.md` 的 build 12 查核為準。

本文件沒有發現需要改寫樂譜生成規則才可上架的理由。網站、品牌與政策準備應維持目前生成、音域、播放及收藏行為。

## 原始碼依據

- `src/brand.ts`、`ios/App/App/Info.plist`：品牌與現行 App 顯示名稱。
- `src/components/SetupPage.tsx`、`src/components/StaffRangePicker.tsx`、`src/components/PracticeSettings.tsx`：樂器、音域與難度。
- `src/components/PracticeTools.tsx`、`src/music/scales.ts`：混合練習重點、音階及調式。
- `src/components/AssessmentPanel.tsx`、`src/assessment/MicrophoneSession.ts`：單音範圍、校正、可選麥克風與停止收音。
- `src/featureFlags.ts`、`src/components/StudioHome.tsx`：會員入口關閉。
- `src/audio/playbackProfiles.ts`：國樂器替代錄音路由。
- `src/export/savePdfBlob.ts`：PDF 本機建立及使用者主動系統分享。
- `src/legal/publisher.ts`、`docs/app-privacy-declaration.md`：正式聯絡資料與 App Privacy 申報分開管理。
