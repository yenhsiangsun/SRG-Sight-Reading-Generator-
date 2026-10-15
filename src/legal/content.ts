import type {Locale} from '../i18n/messages';
import {publisher,legalUpdated,publicContactReady,validPolicyDate} from './publisher.ts';

export interface LegalDocument {
  title: string;
  introduction: string;
  sections: Array<{heading:string; paragraphs:string[]}>;
}

export const legalLabels: Record<Locale,{privacy:string;support:string;close:string;fallback:string}> = {
  'zh-TW': {privacy:'隱私權政策',support:'支援與聯絡',close:'關閉',fallback:''},
  'zh-CN': {privacy:'隐私政策',support:'支持与联系',close:'关闭',fallback:''},
  en: {privacy:'Privacy policy',support:'Help & contact',close:'Close',fallback:''},
  ja: {privacy:'プライバシーポリシー',support:'ヘルプ・お問い合わせ',close:'閉じる',fallback:'この文書は英語で表示しています。繁體中文と简体中文でもご覧いただけます。'},
  es: {privacy:'Política de privacidad',support:'Ayuda y contacto',close:'Cerrar',fallback:'Este documento se muestra en inglés. También está disponible en chino tradicional y simplificado.'},
  de: {privacy:'Datenschutzerklärung',support:'Hilfe & Kontakt',close:'Schließen',fallback:'Dieses Dokument wird auf Englisch angezeigt und ist auch auf traditionellem und vereinfachtem Chinesisch verfügbar.'},
  fr: {privacy:'Politique de confidentialité',support:'Aide et contact',close:'Fermer',fallback:'Ce document est affiché en anglais. Il est également disponible en chinois traditionnel et simplifié.'},
  ko: {privacy:'개인정보 처리방침',support:'도움말 및 문의',close:'닫기',fallback:'이 문서는 영어로 표시됩니다. 중국어 번체와 간체로도 제공됩니다.'},
  th: {privacy:'นโยบายความเป็นส่วนตัว',support:'ความช่วยเหลือและติดต่อ',close:'ปิด',fallback:'เอกสารนี้แสดงเป็นภาษาอังกฤษ และมีให้บริการเป็นภาษาจีนตัวเต็มและตัวย่อด้วย'},
  'pt-BR': {privacy:'Política de privacidade',support:'Ajuda e contato',close:'Fechar',fallback:'Este documento é exibido em inglês e também está disponível em chinês tradicional e simplificado.'},
  ru: {privacy:'Политика конфиденциальности',support:'Помощь и контакты',close:'Закрыть',fallback:'Документ отображается на английском языке. Он также доступен на традиционном и упрощённом китайском.'},
  it: {privacy:'Informativa sulla privacy',support:'Aiuto e contatti',close:'Chiudi',fallback:'Questo documento è visualizzato in inglese ed è disponibile anche in cinese tradizionale e semplificato.'},
};

const documents: Record<'zh-TW'|'zh-CN'|'en',{privacy:LegalDocument;support:LegalDocument}> = {
  'zh-TW': {
    privacy: {
      title:'隱私權政策',
      introduction:'琢音 TONECRAFT 的 Sight Reading Generator 提供視譜練習、樂譜播放、練習紀錄與選用的麥克風測驗。本政策分別說明原生 App、公開支援網站與選用電子郵件支援的資料處理。',
      sections:[
        {heading:'麥克風與測驗',paragraphs:['只有開始校正或演奏測驗時，App 才會請求麥克風權限。聲音在裝置上即時分析，用於音準、節奏、音長及收音品質回饋；不保存為錄音檔，也不傳送到發布者或伺服器。','取消、完成或中斷測驗時會停止收音。你可以在裝置設定撤銷麥克風權限；未授權仍可出題、看譜和播放。']},
        {heading:'保存在裝置上的資料',paragraphs:['收藏樂譜、練習設定、上次練習與播放位置、部分測驗摘要、練習日期、星點、精靈成長與外觀選擇，以及語言、版面與音叉設定，保存在本機。麥克風校正另保存時間補償與本機音訊路徑代碼，不保存原始設備識別碼。','App 沒有自己的帳號系統、雲端同步、廣告、使用行為分析或追蹤服務，也不會把練習資料傳送給發布者。']},
        {heading:'PDF、音源與外部服務',paragraphs:['樂譜 PDF 在裝置上產生。手機和平板會先建立暫存檔，再開啟系統分享選單；由你決定儲存或分享至哪個 App 或服務。瀏覽器版本以檔案下載方式匯出。','正式版樂器播放讀取隨 App 附帶的音源。只有你主動開啟外部來源或授權連結時，才會前往第三方網站；第三方依各自政策處理連線資料。作業系統、商店與備份服務的資料處理依其自身政策與你的設定運作。']},
        {heading:'公開支援網站',paragraphs:['公開的介紹、支援與政策頁是靜態網站，透過 OpenAI Sites 與 Cloudflare 代管服務提供。瀏覽網站時，代管服務商會為傳送頁面與維護安全而處理 IP 位址、請求時間、瀏覽器與請求路徑等連線資料；這與原生 App 在裝置上處理練習資料是不同的流程。','發布者沒有另外在網站加入使用行為分析、廣告、追蹤工具或資料提交表單，也不透過網站同步 App 的練習資料。代管商的安全措施、紀錄保存及其他處理依其服務條款與政策運作；本政策不承諾代管商的特定紀錄保存天數。OpenAI 隱私政策：https://openai.com/policies/privacy-policy/；Cloudflare 隱私政策：https://www.cloudflare.com/privacypolicy/。']},
        {heading:'保存、刪除與保護',paragraphs:['本機紀錄會保留至你刪除資料、移除 App，或被各項歷史紀錄的數量上限取代。收藏樂譜與設定可在收藏頁逐筆刪除；其他本機資料可透過裝置的 App 資料清除／刪除 App 功能移除，網頁版可清除網站資料。iOS 卸載 App 可能保留資料，請使用「刪除 App」。','裝置備份可能保留或還原資料，需另外管理。Android 版設定為停用 App 資料的雲端備份與裝置移轉；iOS 備份則依系統設定。匯出到其他地方的 PDF 不會隨 App 資料一起刪除。App 以裝置提供的本機儲存空間保存資料，沒有額外的資料密碼；請使用裝置鎖定等方式保護存取。']},
        {heading:'聯絡與政策更新',paragraphs:['若你主動來信，發布者會收到你的 Email、信件內容及你自行提供的附件，僅用於處理詢問與後續支援。發布者保留的支援信件及附件會在問題處理完成後最遲 90 天內刪除；法律要求保留的部分除外。可以透過下列支援信箱詢問個資或提出刪除請求。寄信是你主動使用郵件服務，不是 App 自動上傳練習資料。','支援信箱使用 Gmail 收發信件，Google 會依其服務條款與隱私政策處理郵件及相關資料，並有自己的安全、備份與刪除流程。Google 隱私政策：https://policies.google.com/privacy。請不要寄送密碼、付款資料或與問題無關的個人資料。','若未來加入帳號、同步、分析或收費等功能，會重新檢查資料使用方式，更新本政策與商店申報。']},
      ],
    },
    support: {
      title:'支援與聯絡',introduction:'遇到問題時，可以先試試下列方法。你的練習資料保存在裝置上，聯絡前不需要提供整份練習紀錄。',
      sections:[
        {heading:'播放沒有聲音',paragraphs:['請檢查裝置音量、音訊輸出裝置及藍牙連線，然後停止播放再重試。正式 App 的音源隨安裝包提供，不需要另外購買或下載音色。']},
        {heading:'麥克風校正或測驗',paragraphs:['請確認裝置已允許麥克風權限，並在安靜環境下重新校正。更換耳機或音訊設備後應再次校正。演奏回饋目前支援單音旋律，不辨識多音和弦；結果供練習參考。']},
        {heading:'收藏、紀錄與 PDF',paragraphs:['收藏與成長紀錄目前沒有跨裝置同步。移除 App 或清除網站資料前，請先匯出想保留的樂譜；匯出的 PDF 不包含完整的收藏或成長備份。','手機與平板匯出 PDF 後，請在系統分享選單選擇儲存到檔案或其他接收 App；取消分享不會刪除原樂譜。']},
        {heading:'回報問題',paragraphs:['來信請描述操作步驟、裝置型號、系統版本與 App 版本，並可附上能顯示問題的截圖。請避免附上密碼、付款資料或不必要的個人資料。發布者不會要求你的 Apple／Google 密碼。']},
      ],
    },
  },
  'zh-CN': {
    privacy: {
      title:'隐私政策',introduction:'琢音 TONECRAFT 的 Sight Reading Generator 提供视谱练习、乐谱播放、练习记录及可选的麦克风测验。本政策分别说明原生 App、公开支持网站与可选电子邮件支持的数据处理。',
      sections:[
        {heading:'麦克风与测验',paragraphs:['只有开始校准或演奏测验时，App 才请求麦克风权限。声音在设备上实时分析，用于音准、节奏、音长及收音质量反馈，不保存为录音文件，也不发送给发布者或服务器。','取消、完成或中断测验会停止收音。你可在设备设置中撤销麦克风权限；未授权仍可生成、阅读和播放乐谱。']},
        {heading:'设备上的数据',paragraphs:['收藏乐谱、练习设置、上次练习和播放位置、部分测验摘要、练习日期、星点、精灵成长与外观，以及语言、布局和音叉设置保存在本地。校准另保存时间补偿和本地音频路径代码，不保存原始设备标识符。','App 没有自己的账户、云端同步、广告、行为分析或跟踪服务，不会把练习数据发送给发布者。']},
        {heading:'PDF、音源与外部服务',paragraphs:['PDF 在设备上生成。手机和平板先创建缓存文件，再打开系统分享菜单，由你选择保存或分享目的地；浏览器通过下载导出。','正式版音源随 App 提供。只有你主动打开外部来源或授权链接时才访问第三方网站，其连接数据由第三方依各自政策处理。操作系统、商店、备份和迁移服务有各自政策，并按你的设置运行。']},
        {heading:'公开支持网站',paragraphs:['公开的介绍、支持与政策页是静态网站，通过 OpenAI Sites 与 Cloudflare 托管服务提供。浏览网站时，托管服务商为传送页面与维护安全而处理 IP 地址、请求时间、浏览器与请求路径等连接数据；这与原生 App 在设备上处理练习数据是不同的流程。','发布者没有另行在网站加入行为分析、广告、跟踪工具或数据提交表单，也不通过网站同步 App 的练习数据。托管商的安全措施、记录保存及其他处理依其服务条款与政策运行；本政策不承诺托管商的特定记录保存天数。OpenAI 隐私政策：https://openai.com/policies/privacy-policy/；Cloudflare 隐私政策：https://www.cloudflare.com/privacypolicy/。']},
        {heading:'保存、删除与保护',paragraphs:['本地数据保留至你删除数据、移除 App 或历史记录数量上限替换旧记录。收藏页可逐项删除乐谱与预设；其他本地数据可通过设备的清除 App 数据或删除 App 功能移除，网页版可清除网站数据。iOS「卸载 App」可能保留数据，请使用「删除 App」。','备份可能保留或恢复数据，需要另行管理。Android 版配置为停用 App 数据云端备份与设备转移；iOS 备份依系统设置。已保存或分享的 PDF 不随 App 数据一起删除。数据保存在设备提供的本地空间，App 不另设数据密码；请使用设备锁屏等方式保护访问。']},
        {heading:'联系与更新',paragraphs:['主动来信时，发布者会收到你的 Email、邮件内容和你自行提供的附件，仅用于处理询问与后续支持。发布者保留的支持邮件及附件会在问题处理完成后最迟 90 天内删除；法律要求保留的部分除外。可通过下方支持邮箱询问个人信息或请求删除。邮件由你主动通过邮件服务发送，App 不会自动上传练习数据。','支持邮箱使用 Gmail 收发邮件，Google 会依其服务条款与隐私政策处理邮件及相关数据，并有自己的安全、备份与删除流程。Google 隐私政策：https://policies.google.com/privacy。请不要发送密码、付款资料或与问题无关的个人信息。','若未来加入账户、同步、分析或收费等功能，将重新检查数据使用情况并更新本政策和商店申报。']},
      ],
    },
    support: {
      title:'支持与联系',introduction:'遇到问题时，可以先尝试以下方法。练习数据保存在设备上，联系时不需要提交完整练习记录。',
      sections:[
        {heading:'播放没有声音',paragraphs:['检查设备音量、输出设备和蓝牙连接，然后停止播放再重试。正式 App 的音源随安装包提供，无需另外购买或下载。']},
        {heading:'麦克风校准或测验',paragraphs:['确认已允许麦克风权限，并在安静环境重新校准。更换耳机或音频设备后请重新校准。演奏反馈目前只支持单音旋律，不辨识多音和弦，结果仅供练习参考。']},
        {heading:'收藏、记录与 PDF',paragraphs:['收藏与成长记录目前没有跨设备同步。移除 App 或清除网站数据前，请先导出需要的乐谱；PDF 不包含完整收藏或成长备份。','手机和平板导出 PDF 后，请在系统分享菜单选择保存到文件或其他 App；取消分享不会删除原乐谱。']},
        {heading:'报告问题',paragraphs:['来信请描述操作步骤、设备型号、系统与 App 版本，可附上显示问题的截图。不要提供密码、付款资料或不必要的个人信息。发布者不会要求 Apple／Google 密码。']},
      ],
    },
  },
  en: {
    privacy: {
      title:'Privacy policy',introduction:'Sight Reading Generator by 琢音 TONECRAFT provides sight-reading studies, playback, practice records and optional microphone assessments. This policy distinguishes data handling in the native app, on the public support website and through optional email support.',
      sections:[
        {heading:'Microphone and assessments',paragraphs:['Microphone permission is requested only when you start calibration or an assessment. Sound is analyzed on your device for pitch, timing, duration and capture quality. The app does not save microphone recordings or send sound to the publisher or a server.','Capture stops when you cancel, finish or interrupt an assessment. You can revoke microphone permission in device settings. Generating, reading and playing studies remains available without microphone access.']},
        {heading:'Data stored on your device',paragraphs:['Saved scores, practice settings, the last study and playback position, selected assessment summaries, practice dates, stars, companion growth and appearance, language, layout and tuning preferences are stored locally. Calibration also stores timing offsets and a local audio-route code, not the original microphone device identifier.','The app has no account system, app-operated cloud sync, advertising, usage analytics or tracking service, and does not send practice records to the publisher.']},
        {heading:'PDFs, sounds and external services',paragraphs:['PDF scores are generated locally. On phones and tablets, the app writes a temporary cache file and opens the system share sheet. You choose the receiving app or save destination. The browser version exports a download.','Production instrument sounds are bundled with the app. External source and license websites are opened only when you follow a link; those sites handle connection data under their own policies. Operating systems, app stores, backup and migration services have their own policies and settings.']},
        {heading:'Public support website',paragraphs:['The public information, support and policy pages are a static website served through OpenAI Sites and Cloudflare hosting services. When you visit, hosting providers process connection information such as IP address, request time, browser and request path to deliver pages and maintain security. This is separate from the native app processing practice data on your device.','The publisher adds no usage analytics, advertising, tracking tools or data-submission forms to the website, and does not sync app practice records through it. Hosting security, log retention and other processing follow the providers’ terms and policies; this policy does not promise a specific retention period for provider logs. OpenAI privacy policy: https://openai.com/policies/privacy-policy/ . Cloudflare privacy policy: https://www.cloudflare.com/privacypolicy/ .']},
        {heading:'Retention, deletion and protection',paragraphs:['Local records remain until you remove the data or app, or history limits replace older entries. You can remove individual scores and presets in the library. Other local records can be removed through device app-data clearing or app-deletion controls, or site-data controls on the web. On iOS, use Delete App; Offload App can retain data.','Device backups may retain or restore copies and must be managed separately. Android app-data cloud backup and device transfer are disabled in this app; iOS backups follow system settings. Exported PDFs must be deleted from their chosen destinations separately. Data uses device-provided local storage without a separate app data password. Use device access controls such as a screen lock.']},
        {heading:'Contact and changes',paragraphs:['If you choose to send support email, the publisher receives your address, message and any attachments you provide to handle your inquiry and follow-up support. Support messages and attachments held by the publisher are deleted no later than 90 days after the issue is resolved, except where retention is required by law. Use the contact below for privacy questions or deletion requests. Email is user-initiated through your mail service; the app does not automatically upload practice data.','Gmail is used to receive and send support email. Google processes messages and related information under its own terms and privacy policy, including its security, backup and deletion processes. Google privacy policy: https://policies.google.com/privacy . Do not send passwords, payment details or personal information unrelated to your issue.','If accounts, sync, analytics or paid features are added later, data practices will be reviewed and this policy and store disclosures will be updated.']},
      ],
    },
    support: {
      title:'Help & contact',introduction:'These steps may help you resolve a problem. Practice data stays in local app storage; you do not need to send your full practice history to request help.',
      sections:[
        {heading:'No playback sound',paragraphs:['Check device volume, audio output and Bluetooth connections, then stop playback and retry. Production sounds are included in the app and do not require another sound-library purchase or download.']},
        {heading:'Microphone calibration or assessment',paragraphs:['Allow microphone access in device settings and recalibrate in a quiet environment. Recalibrate after changing headphones or audio equipment. Assessments currently support single-note melodies rather than polyphonic chords; feedback is a practice aid.']},
        {heading:'Library, records and PDF export',paragraphs:['Library and companion progress do not currently sync across devices. Export scores you want to keep before deleting app or site data. PDFs do not contain a complete library or companion-progress backup.','After exporting on a phone or tablet, choose Save to Files or another destination in the system share sheet. Cancelling sharing does not delete the source study.']},
        {heading:'Report a problem',paragraphs:['Describe what you did, your device model, system and app versions, and optionally include a screenshot showing the problem. Avoid sending passwords, payment details or unnecessary personal data. The publisher will never ask for your Apple or Google password.']},
      ],
    },
  },
};

export function getLegalContent(locale:Locale) {
  const language=locale==='zh-TW'||locale==='zh-CN'?locale:'en';
  const zh=language==='zh-TW',cn=language==='zh-CN';
  const ready=publicContactReady();
  const emailReady=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publisher.supportEmail);
  const pending=[
    !publisher.name.trim()&&(zh?'發布者資料':cn?'发布者信息':'publisher details'),
    !emailReady&&(zh?'專用聯絡信箱':cn?'专用联系邮箱':'dedicated contact email'),
    !validPolicyDate(publisher.effectiveDate)&&(zh?'生效日期':cn?'生效日期':'effective date'),
  ].filter(Boolean).join(zh||cn?'、':', ');
  return {
    ...documents[language],language,
    fallbackNotice:legalLabels[locale].fallback||undefined,
    closeLabel:legalLabels[locale].close,
    updatedLabel:ready?(zh?'生效日期':cn?'生效日期':'Effective date'):(zh?'草稿更新日期':cn?'草稿更新日期':'Draft updated'),
    updated:ready?publisher.effectiveDate:legalUpdated,
    publisherLabel:zh?'發布者':cn?'发布者':'Publisher',
    publisherName:publisher.name.trim()||undefined,
    contactLabel:zh?'隱私與支援聯絡':cn?'隐私与支持联系':'Privacy & support contact',
    supportEmail:emailReady?publisher.supportEmail:undefined,
    draftNotice:ready?undefined:(zh?`這是上架準備中的草稿。${pending}尚未確認，正式發布前會補齊。`:cn?`这是上架准备中的草稿。${pending}尚未确认，正式发布前将补齐。`:`This is a pre-release draft. Pending confirmation: ${pending}. These details will be completed before publication.`),
  };
}
