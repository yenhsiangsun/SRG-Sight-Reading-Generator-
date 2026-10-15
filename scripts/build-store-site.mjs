import {copyFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {getLegalContent} from '../src/legal/content.ts';
import {publisher,publicContactReady} from '../src/legal/publisher.ts';
import {brand} from '../src/brand.ts';

const preview=process.argv.includes('--preview');
const effectiveDate=new Date(`${publisher.effectiveDate}T00:00:00Z`);
const validEffectiveDate=!Number.isNaN(effectiveDate.valueOf())
  &&effectiveDate.toISOString().slice(0,10)===publisher.effectiveDate;
if(!preview&&(!publicContactReady()||!validEffectiveDate)) {
  console.error('Public site not built: confirm publisher name, public support email and a valid effective date in src/legal/publisher.ts first. Use --preview to review the draft locally.');
  process.exitCode=1;
} else {
  const root=dirname(dirname(fileURLToPath(import.meta.url)));
  const out=join(root,'.tmp-store-site',preview?'draft':'publish');
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const languageNames={'zh-TW':'繁體中文','zh-CN':'简体中文',en:'English'};
  const navigationLabels={'zh-TW':'文件語言','zh-CN':'文档语言',en:'Document language'};
  const skipLabels={'zh-TW':'跳至主要內容','zh-CN':'跳至主要内容',en:'Skip to main content'};
  const css=`
    :root{color-scheme:light;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;color:#392e25;background:#f8f5ee}
    *{box-sizing:border-box}body{margin:0;overflow-wrap:anywhere}a{color:#665035;text-underline-offset:4px}a:hover{color:#392e25}
    a:focus-visible,main:focus-visible{outline:2px solid #665035;outline-offset:5px}.skip-link{position:absolute;top:12px;left:20px;z-index:10;padding:12px 18px;background:#fffdf8;transform:translateY(-180%)}.skip-link:focus{transform:none}
    header,main,footer{max-width:820px;margin:auto;padding:28px 28px}header{display:flex;align-items:center;flex-wrap:wrap;gap:16px;justify-content:space-between;border-bottom:1px solid #ded5c7}
    .brand-link{display:inline-flex;align-items:baseline;flex-wrap:wrap;column-gap:12px;row-gap:0;text-decoration:none;min-height:44px}.brand-chinese{font-family:Georgia,"Noto Serif TC","Songti TC",serif;font-size:28px;letter-spacing:.16em;color:#392e25}.brand-english{font-size:11px;letter-spacing:.19em;color:#705e4f}
    nav{display:flex;flex-wrap:wrap;gap:8px 20px}nav a{display:inline-flex;min-height:44px;align-items:center;font-size:14px}nav a[aria-current="page"]{font-weight:600;text-decoration-thickness:2px}
    h1{font-family:Georgia,"Noto Serif TC","Songti TC",serif;font-size:clamp(28px,6vw,40px);font-weight:500;line-height:1.5;margin:18px 0 24px}h2{font-size:19px;font-weight:600;line-height:1.6}p{line-height:1.95;margin:12px 0}
    section{padding:18px 0;border-top:1px solid #ded5c7}.intro{color:#705e4f}.draft{padding:15px 20px;background:#eee6d8;border-left:3px solid #8c7956}
    dl{background:#fffdf8;padding:20px;border:1px solid #ded5c7;border-radius:8px;line-height:1.9}dt{font-size:13px;color:#705e4f}dd{margin:0 0 12px;overflow-wrap:anywhere}dd:last-child{margin-bottom:0}
    footer{border-top:1px solid #ded5c7;font-size:13px;line-height:1.9;color:#705e4f;overflow-wrap:anywhere}button,a{touch-action:manipulation}.links{display:flex;gap:4px 24px;flex-wrap:wrap}.links a{display:inline-flex;align-items:center;min-height:44px}
    .home header,.home main,.home footer{max-width:1160px}.home main{padding-top:30px;padding-bottom:48px}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.12fr);border:1px solid #d7c7b3;border-radius:8px;overflow:hidden;background:#f3e9da}
    .hero-copy{padding:42px 38px 34px;align-self:center}.eyebrow{font-size:11px;letter-spacing:.12em;color:#795c3e;margin:0 0 18px}.hero h1{font-size:clamp(30px,3.9vw,46px);line-height:1.6;letter-spacing:.025em;margin:0 0 20px}.hero-copy .intro{font-size:15px;margin:0;max-width:390px}
    .hero-image{display:block;width:100%;height:100%;min-height:420px;object-fit:cover;object-position:82% center}.prelaunch{margin:24px 0 20px;padding-top:16px;border-top:1px solid #d7c7b3;font-size:13px;line-height:1.85;color:#665035}.prelaunch strong{display:block;font-weight:600}
    .contact-cta{display:inline-flex;align-items:center;justify-content:center;gap:28px;min-height:48px;padding:12px 20px;border-radius:4px;background:#665035;color:#fffdf8;text-decoration:none;font-size:14px}.contact-cta:hover{background:#4f3c28;color:#fffdf8}
    .home-guide{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px 60px;margin:40px 0 10px;padding:0 6px}.home-guide section{padding-top:22px}.home-guide h2{font-family:Georgia,"Noto Serif TC","Songti TC",serif;font-size:23px;font-weight:500;margin:0 0 12px}.home-guide p{font-size:14px;color:#705e4f}.home-guide .links{font-size:14px}
    .documents{margin:30px 6px 0;padding:22px 0 0}.documents h2{font-size:14px;font-weight:500;color:#705e4f;margin:0 0 12px}.language-documents{display:flex;flex-wrap:wrap;gap:10px 42px}.language-document{min-width:150px}.language-document h3{font-size:14px;margin:0;font-weight:600;line-height:1.8}.language-document .links{gap:0 18px;margin:3px 0 0;font-size:13px}
    .home-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px}.home-footer p{margin:0}.home-footer a{overflow-wrap:anywhere}
    @media(max-width:720px){.hero{grid-template-columns:1fr}.hero-copy{padding:30px 28px}.hero h1{font-size:34px}.hero-image{height:auto;min-height:0;max-height:none;aspect-ratio:3/2;object-fit:contain}.home-guide{gap:20px 30px}.home main{padding-top:20px}}
    @media(max-width:480px){header,main,footer{padding:20px}.home-guide{grid-template-columns:1fr;gap:8px;margin-top:26px}.hero-copy{padding:28px 24px}.hero h1{font-size:30px}.documents{margin-top:24px}.language-documents{gap:12px 28px}.brand-english{font-size:10px}nav{gap:4px 16px}}
  `;
  const brandLink=href=>`<a class="brand-link" href="${href}" aria-label="${escape(brand.displayName)}"><span class="brand-chinese">${escape(brand.chinese)}</span><span class="brand-english" lang="en">${escape(brand.english)}</span></a>`;
  const page=(locale,kind)=>{
    const content=getLegalContent(locale),doc=content[kind];
    const links=Object.entries(languageNames).map(([lang,label])=>`<a href="${lang===locale?'':`../${lang}/`}${kind}.html" lang="${lang}" hreflang="${lang}"${lang===locale?' aria-current="page"':''}>${label}</a>`).join('');
    const metadata=`<dl><dt>${escape(content.updatedLabel)}</dt><dd><time datetime="${escape(content.updated)}">${escape(content.updated)}</time></dd>${content.publisherName?`<dt>${escape(content.publisherLabel)}</dt><dd>${escape(content.publisherName)}</dd>`:''}${content.supportEmail?`<dt>${escape(content.contactLabel)}</dt><dd><a href="mailto:${escape(content.supportEmail)}">${escape(content.supportEmail)}</a></dd>`:''}</dl>`;
    return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${content.draftNotice?'<meta name="robots" content="noindex,nofollow">':''}<meta name="description" content="${escape(doc.introduction)}"><title>${escape(doc.title)} · ${escape(brand.displayName)} · Sight Reading Generator</title><style>${css}</style></head><body><a class="skip-link" href="#main">${skipLabels[locale]}</a><header>${brandLink('../index.html')}<nav aria-label="${navigationLabels[locale]}">${links}</nav></header><main id="main" tabindex="-1"><h1>${escape(doc.title)}</h1><p class="intro">${escape(doc.introduction)}</p>${content.draftNotice?`<p class="draft">${escape(content.draftNotice)}</p>`:''}${doc.sections.map(section=>`<section><h2>${escape(section.heading)}</h2>${section.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`).join('')}${metadata}<p class="links"><a href="privacy.html">${escape(content.privacy.title)}</a><a href="support.html">${escape(content.support.title)}</a></p></main><footer>${escape(brand.displayName)} · Sight Reading Generator${content.publisherName?` · ${escape(content.publisherName)}`:''}</footer></body></html>`;
  };
  await mkdir(join(out,'assets'),{recursive:true});
  // Reuse the accepted v2 artwork selected by StudioHome; no app assets or code are published.
  await copyFile(join(root,'public','artwork','warm-music-studio-v2.webp'),join(out,'assets','hero.webp'));
  for(const locale of Object.keys(languageNames)) {
    await mkdir(join(out,locale),{recursive:true});
    for(const kind of ['privacy','support'])await writeFile(join(out,locale,`${kind}.html`),page(locale,kind),'utf8');
  }
  const content=getLegalContent('zh-TW');
  const contactLink=content.supportEmail?`<a class="contact-cta" href="mailto:${escape(content.supportEmail)}">聯絡琢音 <span aria-hidden="true">↗</span></a>`:'';
  const languageDocuments=Object.entries(languageNames).map(([locale,name])=>`<div class="language-document" lang="${locale}"><h3>${name}</h3><p class="links"><a href="${locale}/privacy.html" hreflang="${locale}">${escape(getLegalContent(locale).privacy.title)}</a><a href="${locale}/support.html" hreflang="${locale}">${escape(getLegalContent(locale).support.title)}</a></p></div>`).join('');
  await writeFile(join(out,'index.html'),`<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${content.draftNotice?'<meta name="robots" content="noindex,nofollow">':''}<meta name="description" content="琢音 TONECRAFT 的視譜練習 App、支援聯絡與隱私權政策。"><title>${escape(brand.displayName)} · 音樂練習與支援</title><style>${css}</style></head><body class="home"><a class="skip-link" href="#main">跳至主要內容</a><header>${brandLink('index.html')}<nav aria-label="主要導覽"><a href="zh-TW/support.html">常見問題與支援</a><a href="zh-TW/privacy.html">隱私權政策</a></nav></header><main id="main" tabindex="-1"><div class="hero"><div class="hero-copy"><p class="eyebrow" lang="en">SIGHT READING GENERATOR</p><h1>留一點時間，<br>給音樂。</h1><p class="intro">從適合自己的樂器與音域開始，練習讀譜、聆聽與演奏。讓每一段小小的練習，慢慢累積成自己的音樂。</p><p class="prelaunch"><strong>App 正式上架準備中</strong>目前尚未在商店公開提供下載。</p>${contactLink}</div><img class="hero-image" src="assets/hero.webp" alt="" width="1536" height="1024" fetchpriority="high"></div>${content.draftNotice?`<p class="draft">${escape(content.draftNotice)}</p>`:''}<div class="home-guide"><section><h2>一份譜，一段練習。</h2><p>選擇樂器、音域與音高及節奏難度，生成短篇視譜練習。可播放樂譜、收藏喜歡的題目，或匯出 PDF；也能選用麥克風校正與單音演奏測驗。</p></section><section><h2>需要一點幫忙？</h2><p>播放、麥克風校正、收藏與 PDF 匯出的常見問題，都整理在支援頁。仍有疑問時，歡迎來信描述遇到的情況。</p><p class="links"><a href="zh-TW/support.html">查看常見問題 <span aria-hidden="true">&nbsp;→</span></a><a href="zh-TW/privacy.html">閱讀隱私權政策</a></p></section></div><section class="documents" aria-labelledby="documents-heading"><h2 id="documents-heading">支援與隱私文件 / Help & privacy</h2><div class="language-documents">${languageDocuments}</div></section></main><footer class="home-footer"><p>${escape(brand.displayName)} · Sight Reading Generator${content.publisherName?`<br>${escape(content.publisherName)}`:''}</p>${content.supportEmail?`<p><a href="mailto:${escape(content.supportEmail)}">${escape(content.supportEmail)}</a></p>`:''}</footer></body></html>`,'utf8');
  await writeFile(join(out,'.nojekyll'),'','utf8');
  console.log(`${preview?'Draft preview only; not published':'Public-site files ready; not deployed'}: ${out}`);
}
