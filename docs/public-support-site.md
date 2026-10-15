# 琢音 TONECRAFT 公開網站與支援資料

核對日期：2026-10-15（Asia/Taipei）。公開網站已部署，三語頁面已驗證可匿名存取；App 原始碼已接上正式聯絡資料。**App 儲存庫尚未推送、未觸發新 TestFlight 建置，也未送正式審查。**

## 已公開的正式網址

| 用途 | 正式網址 |
| --- | --- |
| 琢音首頁 | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site |
| 繁體中文隱私政策（Apple 使用） | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy |
| 繁體中文支援與聯絡（商店使用） | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/support |
| 簡體中文隱私政策 | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-CN/privacy |
| 簡體中文支援與聯絡 | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-CN/support |
| 英文隱私政策 | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/en/privacy |
| 英文支援與聯絡 | https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/en/support |

首頁與三語支援／政策共 **7 個公開頁面**的 HTTP 請求均成功（200），包括簡中與英文支援頁；舊式 `.html` 連結會轉到上表無副檔名的正式路徑。這些公開網址取代先前未執行的 GitHub Pages 規劃，沒有另外把 App 儲存庫改成公開。

## 已確認的發布者資料

- 品牌：**琢音 TONECRAFT**；產品名稱保留 **Sight Reading Generator**。
- 隱私政策發布者：**YenHsiang Sun（琢音 TONECRAFT）**。使用者已明確同意公開 Apple 帳號法定姓名＋琢音品牌；姓名已在 Apple Business 資料核對。
- 專用支援信箱：**tonecraft.zhuoyin@gmail.com**。已確認帳戶地址與 Gmail 收件匣可開啟；不等於已完成對外寄收信測試。
- 政策生效日：**2026-10-15**。
- 已同意的支援保存方式：發布者持有的支援信件與附件於問題處理完成後**最多 90 天刪除**，法律要求保留的除外。這不是對 Gmail 或代管商所有備份／連線紀錄保存期限的保證。

品牌不是已登記的公司名稱，也不取代 Apple 個人帳號的法定銷售者身份。使用專用 Gmail 與平台提供的 HTTPS 網址即可完成目前的聯絡與政策用途，不必先成立公司或購買網域。未來更換網域／信箱時，須同步更新公開網站、App 與商店欄位。

## 部署證據

| 項目 | 已核對值 |
| --- | --- |
| 平台與可見度 | OpenAI Sites／Cloudflare；PUBLIC |
| 部署成功時間 | 2026-10-15 15:21:48 UTC（台北 23:21:48） |
| Site ID | `appgprj_6ad0ecab80b881919ed4197e4f45a7bb` |
| Version ID | `appgprj_6ad0ecab80b881919ed4197e4f45a7bb~appgver_d331581acc0c8191a721f93afe88780d` |
| Deployment ID | `appgdep_6ad0ef78795c8191b19c5a7e3cea5e78` |
| 網站來源 commit | `e155cda3e4687150841b6c7a2ac5f840eb38d8d0` |
| 隔離網站工作目錄 | `.tmp-tonecraft-public-site`，含 `.openai` manifest 與靜態 `dist` |

網站發布只包含介紹、支援與政策的靜態成品，不包含完整 App 程式碼、樂器音檔、憑證、私密帳號資料或使用者練習紀錄。代管商為傳送網頁與維護安全仍會處理 IP、時間、瀏覽器與路徑等連線資料；已在三語政策中與原生 App 的本機資料處理分開說明。發布者未加入分析 SDK、廣告、追蹤或資料提交表單。

## App 入口與後續維護

- App 頁尾的「隱私權政策」「支援與聯絡」開啟完整本機文字，不要求麥克風權限；對話框提供 `mailto:` 聯絡信箱。目前沒有開啟公開網站的按鈕，正式網站 URL 用於商店及政策設定，不能把設定值當作已存在的 App 內網頁入口。
- App 與網站由同一份 `src/legal/content.ts` 內容產生，發布者及網址由 `src/legal/publisher.ts` 管理；目前已填入正式姓名、Email、生效日與上述繁中網址。
- `npm run preview:store-site` 產生本機審閱輸出；`npm run build:store-site` 產生靜態發布輸出。**建置命令本身不會重新部署網站。**
- 更新政策後須重新生成、部署並打開公開網址確認；網站改變也不會自動更新已安裝的原生 App。
- 本輪 focused lint、**499 項測試**、正式 Web build，以及網址更新後的 `cap copy ios` 已通過。此結果不等同真機或正式 iOS archive 驗證。

## Apple 目前狀態與剩餘事項

使用者明確確認後，已完成 Apple App Privacy 的最後發布，後台顯示「由 SUN Yen-Hsiang 於數秒鐘前發佈」，內容為 **No Data Collected** 與同一個繁中公開政策 URL。證據：`.tmp-release-proof/apple-privacy-published.png`。這是隱私申報發布，不是 App 已上架。

新版 Apple Developer Program License Agreement 已由使用者本人完成接受；重載後提醒消失，帳號 History 顯示 **Issued October 14, 2026; Accepted October 15, 2026**。此項已解除，不再列為待辦。

繁中商店副標題、教育／音樂類別、宣傳文字、描述、關鍵字、支援／Marketing URL、copyright 與英文審查說明也已儲存並重新讀取確認；版本設為手動發布、不需要登入。審查聯絡四欄已按使用者授權填入 Apple 登記姓名／電話與品牌 Gmail，儲存重讀無警示；私人電話不寫入本文件或公開網站。新 build 與截圖仍未完成，不能把這些儲存動作說成已送審。

年齡問卷已按目前功能填寫並儲存，重新開啟確認為 **4+（172 個國家／地區）**，另有各地區分級；沒有選 Made for Kids 或較高年齡覆寫。證據：`.tmp-release-proof/apple-app-info.png`。

首版免費價格已儲存：台灣基準 0.00，重讀定價彈窗 175 個價格列全部為 0.00；現階段維持不限出題的免費測試。未來每日免費 3–5 份＋訂閱不限新譜只是提出的方向；5 份建議未核定實作，現在沒有額度、訂閱或自動扣款。

使用者後續明確決定先排除歐盟 27 國，實際發行設定為 **148 個地區**，關閉自動加入未來新地區。重讀顯示台灣／英國／瑞士為 App 發行時可用，法國／德國仍在處理為不可用。DSA 依表單「非貿易商，或者不打算在歐盟發佈」的後者條件完成，Business 顯示 27 個國家、2026/10/15 通過審查；**不是法律上的非貿易商身份判定或貿易商驗證**。未來加入歐盟必須重新決定 DSA 與公開聯絡資料的處理。選定地區仍受當地要求與 Apple 最終狀態限制，不能宣稱全球已可下載。證據：`.tmp-release-proof/apple-free-pricing.png`、`.tmp-release-proof/apple-worldwide-except-eu.png`。

仍需新原生版本納入本輪政策入口與音源清理，完成 archive／實機查核、正式截圖與最終內容權利聲明，再送審。TestFlight 1.0（10）早於這些改動；此次網站發布沒有更新 TestFlight，App 儲存庫仍未推送。

資料使用申報的原始碼證據、網站／支援郵件界線及最終封版查核見 [app-privacy-declaration.md](./app-privacy-declaration.md)；商店文案、截圖與審查走法見 [app-store-submission-draft.md](./app-store-submission-draft.md)。
