import {themeMessages} from './themeMessages';
import {layoutMessages} from './layoutMessages';
import {practiceToolsMessages} from './practiceToolsMessages';
import {playbackMessages} from './playbackMessages';
import {additionalMessages} from './additionalMessages';
import {additionalDetails} from './additionalDetails';
import {practiceCompanionMessages} from './practiceCompanionMessages';
import {namedCatalogs} from './namedCatalogs';
import {tuningMessages} from './tuningMessages';
import {staffMessages} from './staffMessages';
import {difficultyMessages} from './difficultyMessages';
import {tonalityMessages} from './tonalityMessages';
import {pdfMessages} from './pdfMessages';

export const localeOrder = ['zh-TW', 'en', 'ja', 'es', 'de', 'fr', 'ko', 'pt-BR', 'ru', 'it', 'zh-CN', 'th'] as const;

export type Locale = (typeof localeOrder)[number];

export const locales: Locale[] = [...localeOrder];

export const messages = {
  ...pdfMessages,
  ...tonalityMessages,
  ...difficultyMessages,
  ...staffMessages,
  ...tuningMessages,
  ...layoutMessages,
  ...practiceToolsMessages,
  ...practiceCompanionMessages,
  ...playbackMessages,
  recorded:['真實樂器錄音','Recorded instrument samples','実楽器の録音'],
  soundCredits:['音色來源與授權','Sound credits & licenses','音源とライセンス'],
  calibrationTitle:['麥克風時間校正','Microphone timing calibration','マイクのタイミング調整'],
  calibrationHelp:['戴上耳機。預備四拍後，以每分鐘 60 拍演奏 8 個短促、分開的八分音符（共四拍），使用同一個舒適的中音；每音之間留一點空隙。','Wear headphones. After four count-in beats at 60 BPM, play eight detached eighth notes on one comfortable middle pitch, leaving a short gap between notes.','ヘッドホンを使用し、60 BPM の4拍のカウント後、同じ無理のない中音を8分音符で8回、短く区切って演奏してください。'],
  calibrationPattern:['四拍，每拍兩個八分音符','Four beats, two eighth notes per beat','4拍、各拍に8分音符2つ'],
  calibrationRequired:['首次測驗請先完成校正。','Calibrate before your first assessment.','初回テスト前に調整してください。'],
  calibrationValue:['已套用時間補償','Applied timing offset','適用中の補正'],
  calibrate:['開始校正','Calibrate','調整を開始'],
  recalibrate:['重新測量','Recalibrate','再測定'],
  calibrationSaved:['校正已儲存在此瀏覽器，下次自動套用。','Saved in this browser for future assessments.','このブラウザに保存しました。次回も適用します。'],
  calibrationTemporary:['本次已套用；瀏覽器無法儲存，下次需重新校正。','Applied for this session; browser storage is unavailable.','今回適用しましたが、保存できませんでした。'],
  calibrationFailed:['未偵測到穩定的八次起音，請保持音符短而分開並重試；原有校正不變。','Eight consistent onsets were not detected. Keep notes short and separated and retry. Previous calibration is retained.','安定した8回の発音を検出できませんでした。短く区切って再試行してください。以前の値は保持します。'],
  calibrationCaution:['這是演奏與收音的綜合時間補償，包含個人跟拍偏差，並非純硬體延遲。更換耳機、麥克風或覺得評分跑掉時可重新測量。','This estimates combined playing and capture timing, including your timing bias, not hardware latency alone. Recalibrate after changing headphones or microphone, or if timing feels wrong.','演奏の癖を含む総合的な補正で、機器遅延だけの測定ではありません。機器の変更時や違和感がある場合は再測定してください。'],
  grandMonoHelp:['單音模式：同一條旋律依音高分配到上下譜表，不同時產生第二聲部。','One melody distributed between staves by pitch; no simultaneous second part.','単旋律を音域に応じて上下の譜表に振り分けます。'],
  language:['語言','Language','言語'],
  setup:['練習設定','Practice setup','練習設定'],
  practice:['自由練習','Practice','自由練習'],
  test:['測驗模式','Assessment','テスト'],
  instruments:['樂器','Instrument','楽器'],
  rangeStaff:['音域與譜表','Range & staff','音域と譜表'],
  challenge:['難度與規則','Difficulty & rules','難易度とルール'],
  chooseInstrument:['選擇你的樂器','Choose your instrument','楽器を選びましょう'],
  chooseRange:['找到舒適的音域','Find your comfortable range','無理のない音域を選びましょう'],
  chooseChallenge:['設計今天的挑戰','Shape today’s practice','今日の練習を設定'],
  intro:['每天一點，讀譜更從容。','A little practice. More fluent reading.','毎日の練習で、読譜をもっと自然に。'],
  setupHelp:['先選樂器，再設定音域、譜表與節奏。','Choose an instrument, then set your range, staff and rhythm.','楽器を選び、音域・譜表・リズムを設定します。'],
  ...themeMessages,
  all:['全部','All','すべて'],keyboard:['鍵盤','Keyboard','鍵盤'],strings:['弦樂','Strings','弦楽器'],woodwinds:['木管','Woodwinds','木管楽器'],brass:['銅管','Brass','金管楽器'],other:['其他','Other','その他'],
  cnWind:['國樂・吹管','Chinese winds','中国の吹奏楽器'],cnPlucked:['國樂・彈撥','Chinese plucked strings','中国の撥弦楽器'],cnBowed:['國樂・拉弦','Chinese bowed strings','中国の擦弦楽器'],cnPercussion:['國樂・打擊','Chinese percussion','中国の打楽器'],
  search:['搜尋樂器或規格','Search instruments or models','楽器・仕様を検索'],
  noResults:['找不到符合的樂器。','No matching instruments.','該当する楽器がありません。'],
  sample:['♫ 試聽音色','♫ Preview sound','♫ 音色を試聴'],stopSample:['■ 停止試聽','■ Stop preview','■ 試聴を停止'],
  synthetic:['合成音色','Synthesized sound','合成音色'],soundHelp:['音色依發聲特性合成，並非真實錄音取樣。同樂器不同調性共用音色。','Sounds are synthesized, not recorded samples. Different keys of the same instrument share a timbre.','録音サンプルではなく合成音色です。同じ楽器の調違いは音色を共有します。'],
  instrumentHelp:['選樂器會套用參考音域與譜表。國樂依正式樂團型制列出，並非所有地方型制。','Choosing an instrument applies its reference range and staff. Chinese models follow an orchestra’s range table, not every regional variant.','楽器を選ぶと参考音域と譜表が設定されます。中国楽器は楽団の仕様に基づき、すべての地方型を網羅するものではありません。'],
  written:['記譜音域','Written range','記譜音域'],sounding:['實際音域','Sounding range','実音域'],
  rangeHelp:['包含上下限；中央 C = C4。','Inclusive bounds; middle C = C4.','上下限を含みます。中央ド = C4。'],
  minimum:['最低音','Lowest note','最低音'],maximum:['最高音','Highest note','最高音'],
  reference:['參考音域','Reference range','参考音域'],source:['查看音域來源 ↗','Range source ↗','音域の出典 ↗'],
  modelHelp:['音域依指定型制；未必包含極限音。定弦、指法與快速半音的可行性需依實琴調整。','Ranges depend on the specified model and may exclude extreme notes. Tuning, fingering and fast chromatic passages depend on the actual instrument.','音域は指定仕様に基づき、限界音を含まない場合があります。調弦・運指・速い半音進行は実際の楽器に合わせてください。'],
  voiceHelp:['人聲沒有統一音域，請依自己的舒適音域設定。','There is no universal vocal range. Set your own comfortable range.','声の音域には個人差があります。無理のない範囲に設定してください。'],
  transpose:['播放移調（半音）','Playback transposition (semitones)','再生の移調（半音）'],applyRange:['套用參考音域','Use reference range','参考音域を適用'],pianoRange:['鋼琴基礎 C3–C6','Piano starter C3–C6','ピアノ基礎 C3–C6'],outside:['自訂音域已超出此型制的參考範圍。','Custom range extends beyond this model’s reference range.','設定音域がこの仕様の参考範囲を超えています。'],
  treble:['高音譜表','Treble staff','ト音譜表'],bass:['低音譜表','Bass staff','ヘ音譜表'],alto:['中音譜表','Alto staff','アルト譜表'],tenor:['次中音譜表','Tenor staff','テノール譜表'],grand:['大譜表','Grand staff','大譜表'],
  grandHelp:['右手 C4 以上，左手 B3 以下；左手採簡單節奏。音域需包含中央 C 兩側。','Right hand: C4 and above. Left hand: B3 and below, with simpler rhythms. Include both sides of middle C.','右手は C4 以上、左手は B3 以下で簡単なリズムです。中央ドの両側を含めてください。'],
  length:['小節數','Measures','小節数'],phoneHelp:['手機新題最多 8 小節，每行一小節；平板與電腦可產生更長練習。','Phone exercises are limited to 8 measures, one per row. Tablets and computers support longer exercises.','スマートフォンは最大8小節、1段1小節です。タブレットとパソコンでは長い練習も可能です。'],
  beginner:['初級','Beginner','初級'],intermediate:['中級','Intermediate','中級'],advanced:['進階','Advanced','上級'],difficulty:['視譜難度','Reading difficulty','読譜の難易度'],rhythm:['節奏複雜度','Rhythm complexity','リズムの複雑さ'],simple:['簡單','Simple','簡単'],moderate:['適中','Moderate','普通'],complex:['複雜','Complex','複雑'],
  meter:['拍號','Time signature','拍子'],mixed:['混合拍號','Mixed meter','変拍子'],mixedHelp:['每兩小節切換拍號，至少選擇兩種。','Change meter every two measures. Select at least two.','2小節ごとに拍子を変えます。2種類以上選んでください。'],
  chromatic:['增加音高變化','Add chromatic variety','音の変化を増やす'],chromaticHelp:['加入少量額外變化音。無論開關，記譜所需的升降與還原記號都會保留。','Add occasional altered notes. Necessary accidentals are always included, even with this off.','変化音を少し加えます。オフでも、記譜に必要な臨時記号は表示されます。'],
  previous:['← 上一步','← Back','← 戻る'],next:['下一步 →','Continue →','次へ →'],start:['開始視譜練習 →','Start reading →','読譜を始める →'],
  scale:['音階／調式','Scale / mode','音階／モード'],tonic:['主音','Tonic','主音'],noTonic:['非調性・無主音','Atonal · no tonic','無調・主音なし'],keySignature:['調號','Key signature','調号'],noSignature:['不預設調號；逐音標示記號','Open key signature; explicit accidentals','調号なし・臨時記号を表示'],intervals:['距主音半音數','Semitones above tonic','主音からの半音数'],
  modeFamily:['大小調與教會調式','Tonal & church modes','長短音階・教会旋法'],pentatonic:['五聲音階','Pentatonic scales','五音音階'],japanese:['日本音階','Japanese scales','日本の音階'],otherScales:['藍調與其他音階','Blues & other scales','ブルース・その他'],atonalFamily:['非調性','Atonal','無調'],
  major:['大音階／伊奧尼安','Major / Ionian','長音階／アイオニアン'],naturalMinor:['自然小音階','Natural minor / Aeolian','自然短音階'],harmonicMinor:['和聲小音階','Harmonic minor','和声的短音階'],melodicMinor:['旋律小音階（爵士型）','Melodic minor (jazz)','旋律的短音階（ジャズ）'],
  backSetup:['← 調整設定','← Settings','← 設定'],newExercise:['↻ 產生下一份','↻ New exercise','↻ 新しい練習'],practiceTitle:['讓每一拍，都更從容。','Find your reading rhythm.','自分の読譜リズムを見つけよう。'],
  play:['播放樂譜','Play score','楽譜を再生'],resume:['繼續播放','Resume','再開'],pause:['暫停','Pause','一時停止'],stop:['停止','Stop','停止'],replay:['從頭重播','Replay','最初から再生'],tempo:['速度','Tempo','テンポ'],metronome:['節拍器','Metronome','メトロノーム'],downbeat:['每小節首拍加重音','Accent each measure’s first beat','各小節の第1拍を強調'],
  ready:['準備就緒','Ready','準備完了'],loadingAudio:['正在啟動音訊','Starting audio','音声を準備中'],playing:['樂譜播放中','Playing score','再生中'],clicking:['節拍器運行中','Metronome running','メトロノーム動作中'],paused:['已暫停','Paused','一時停止中'],sound:['音色','Sound','音色'],
  tempoHelp: ["BPM 以第一小節為準；混合拍號維持音符時值。例如 ♩ = 60 切到 /8 時為 ♪ = 120，切回 /4 則為 ♩ = 60。","BPM refers to the opening meter. Note values stay constant: ♩ = 60 becomes ♪ = 120 in /8, then ♩ = 60 on returning to /4.","BPM は最初の拍子が基準です。音価は一定：♩ = 60 → /8 では ♪ = 120 → /4 では ♩ = 60。","El BPM se refiere al compás inicial. Los valores se mantienen: ♩ = 60 → ♪ = 120 en /8 → ♩ = 60 al volver a /4.","Der BPM-Wert gilt für den Anfangstakt. Notenwerte bleiben gleich: ♩ = 60 → ♪ = 120 bei /8 → ♩ = 60 zurück bei /4.","Le BPM se réfère à la mesure initiale. Les durées restent constantes : ♩ = 60 → ♪ = 120 en /8 → ♩ = 60 au retour en /4.","BPM은 첫 마디 기준이에요. 음표 길이는 유지돼요: ♩ = 60 → /8에서 ♪ = 120 → /4로 돌아오면 ♩ = 60.","O BPM se refere ao compasso inicial. As durações se mantêm: ♩ = 60 → ♪ = 120 em /8 → ♩ = 60 ao voltar a /4.","BPM относится к начальному размеру. Длительности сохраняются: ♩ = 60 → ♪ = 120 в /8 → ♩ = 60 при возврате в /4.","Il BPM si riferisce al metro iniziale. Le durate restano costanti: ♩ = 60 → ♪ = 120 in /8 → ♩ = 60 tornando a /4."],
  score:['五線譜','Score','楽譜'],error:['無法完成操作，請檢查音域、拍號或裝置權限後重試。','Unable to complete this action. Check the range, meters or device permissions and try again.','操作を完了できません。音域・拍子・端末の権限を確認してください。'],
  readingTime:['讀譜時間','Reading time','読譜時間'],seconds:['秒','seconds','秒'],questions:['題數','Questions','問題数'],oneQuestion:['單題練習','One question','1問'],tenQuestions:['10 題綜合評估','10-question assessment','10問の総合評価'],
  examHelp:['先讀譜 30 或 60 秒，再聽四下預備拍後演奏。收音只在本機分析，不保存或上傳錄音。請戴耳機，避免預備拍被麥克風收進去。','Read for 30 or 60 seconds, then play after four count-in clicks. Audio is analyzed locally, never saved or uploaded. Use headphones to keep the count-in out of the microphone.','30秒または60秒読譜し、4回の予備拍の後に演奏します。音声は端末内で解析し、保存・送信しません。予備拍の回り込みを防ぐためイヤホンを使用してください。'],
  examLimit:['目前為單音收音測驗，約 C2–F♯6；不支援和弦／鋼琴雙手。結果是練習估計，尚非考級標準。','Microphone assessment currently supports single-note melodies, about C2–F♯6, not chords or both piano hands. Results are practice estimates, not certified grades.','現在は単音旋律（約 C2–F♯6）の収音テストです。和音・ピアノ両手には未対応です。結果は練習の目安で、公的な評価ではありません。'],
  latency:['輸入延遲補償（毫秒）','Input latency compensation (ms)','入力遅延の補正（ms）'],latencyHelp:['裝置延遲會影響節奏結果；未校正時不要把小幅偏差當成演奏錯誤。','Device latency affects rhythm results. Small offsets may be device delay until calibrated.','端末の遅延がリズム評価に影響します。未調整時の小さなずれは端末由来の可能性があります。'],
  startExam:['啟用麥克風並開始','Enable microphone & start','マイクを有効にして開始'],cancelExam:['取消本題','Cancel question','この問題を中止'],nextQuestion:['下一題 →','Next question →','次の問題 →'],restartExam:['重新開始測驗','New assessment','新しいテスト'],
  permission:['等待麥克風授權','Waiting for microphone permission','マイクの許可を待機中'],reading:['默讀譜例','Read the score','楽譜を黙読'],countin:['四下預備拍','Four-beat count-in','4回の予備拍'],performing:['請開始演奏','Play now','演奏してください'],result:['本題結果','Question result','今回の結果'],summary:['綜合評估','Overall assessment','総合評価'],
  pitchScore:['音高','Pitch','音高'],rhythmScore:['節奏','Rhythm','リズム'],completion:['完成度','Coverage','演奏率'],confidence:['辨識信心','Detection confidence','検出の信頼度'],
  noSignal:['收音不足，無法可靠評分。請檢查麥克風、環境與音域後重試。','Not enough clear input to grade reliably. Check your microphone, surroundings and range, then retry.','明瞭な音声が不足しています。マイク・環境・音域を確認して再試行してください。'],
  completionAdvice:['先縮小音域並放慢速度，練習完整走完每小節；確認收音清楚後再比較音高與節奏。','Use a smaller range and slower tempo to complete each measure. Confirm clear microphone input before comparing pitch and rhythm.','音域を狭めてテンポを落とし、各小節を最後まで演奏しましょう。収音を確認してから音高とリズムを比較してください。'],
  pitchAdvice:['建議先放慢速度，逐音確認音程與升降記號，再串成樂句。','Slow down and check intervals and accidentals note by note before joining the phrase.','テンポを落とし、音程と臨時記号を一音ずつ確認してからつなげましょう。'],
  rhythmAdvice:['建議先拍出節奏，保持穩定分拍，再加入音高；也請確認延遲補償。','Clap the rhythm with steady subdivisions before adding pitches. Check latency compensation too.','細かい拍を保ってリズムを手で打ち、その後音を加えましょう。遅延補正も確認してください。'],
  balancedAdvice:['音高與節奏表現接近；先維持正確率，再逐步提高速度。','Pitch and rhythm are balanced. Keep accuracy stable before increasing tempo.','音高とリズムのバランスが良好です。正確さを保ちながら少しずつ速くしましょう。'],
  noteDetails:['逐音結果','Note details','各音の結果'],expected:['預期音','Expected','指定音'],onset:['起音偏差（ms）','Onset offset (ms)','発音のずれ（ms）'],heard:['有偵測到音','Detected','検出'],notHeard:['未偵測','Not detected','未検出'],
  micError:['無法啟用麥克風，請檢查權限並使用 HTTPS 或本機預覽。','Microphone unavailable. Check permission and use HTTPS or localhost.','マイクを使用できません。権限を確認し、HTTPS または localhost を使用してください。'],
  interrupted:['測驗因離開頁面或切換背景而取消，本題未計分。','Assessment canceled after leaving the page or switching to the background. This question was not graded.','ページ移動またはバックグラウンド移行により中止しました。この問題は採点していません。'],
} as const;
export type MessageKey = keyof typeof messages;
type MessageValue = ReadonlyArray<string>;
export function translate(locale: Locale, key: MessageKey): string {
  const named = namedCatalogs[locale];
  if (named) return named.messages[key];
  const values: MessageValue = messages[key];
  const index = localeOrder.indexOf(locale);
  return values[index] ?? additionalMessages[key]?.[index - 3] ?? additionalDetails[key]?.[index - 3] ?? values[1];
}
