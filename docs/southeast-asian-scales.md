# 南洋風格練習音階

「南洋」不是單一固定調式；本次以印尼甘美朗相關的 Pelog 與 Slendro 為起點。現有引擎、取樣播放及測驗使用十二平均律，因此加入的是可用目前樂器演奏的近似音集合，不是傳統調律或完整傳統曲風生成器。

| ID | 半音間距（相對起音） | C 起音的記譜 | 近似方式 |
| --- | --- | --- | --- |
| `pelog-pentatonic` | 0, 1, 3, 7, 8 | C、D♭、E♭、G、A♭ | 採 Tonal 音階資料庫的 Pelog 五聲形式 |
| `slendro-pentatonic` | 0, 2, 5, 7, 10 | C、D、F、G、B♭ | 將理想化五等分八度 0、240、480、720、960 音分四捨五入至最近半音 |

Slendro 的這項取整是本專案的設計選擇。取整後與現有埃及五聲／商調式同音集合；不宣稱因此產生不同的傳統曲風。兩項均不套用西方大小調調號，變化音依小節的臨時記號規則顯示。

來源：

- [Iwan Gunawan：Ableton 巽他甘美朗調律指南](https://tuning.ableton.com/sundanese-gamelan/intro-to-sundanese-gamelan/) 說明實際音程因樂器而異，Salendro 的五音接近平均分布，Pelog 的七音可取不同五音子集。本文不能當作固定半音表的證據。
- [Tonal 音階資料定義](https://github.com/tonaljs/tonal/blob/main/packages/scale-type/data.ts) 的 `pelog` 使用 1P、2m、3m、5P、6m。本專案採用這組十二平均律音程作練習。

## 出題與驗證

- 跟其他音階一起由 `selectRandomTonality` 抽選；一份樂譜與大譜表雙手共用同一音階。整體調號抽選比例見 [調性生成規則](tonality-generation.md)。
- 主音、調式控制維持隱藏；依自訂音域尋找可用移調，沿用音高難度、節奏及樂器和聲可演奏性限制。
- 「臨時記號」選項仍控制額外調外音；關閉不會刪除音階本身所需的降音。
- 原有已收藏樂譜不會被重新轉換。
- 本機開發預覽可使用 `/?previewScale=pelog-pentatonic` 或 `/?previewScale=slendro-pentatonic`；只對第一份成功產生的譜固定 C 起音並關閉額外調外音。頁面顯示試奏提醒與退出連結，成功後移除網址參數；「產生下一份」恢復隨機出題及原本臨時記號偏好。正式建置忽略此參數。
- 測試涵蓋音名／八度、所有主音移調、窄音域、雙手音域、隨機抽選、VexFlow 記譜、和聲及收藏還原。
