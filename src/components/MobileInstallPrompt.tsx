import {useEffect, useRef, useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {useI18n} from '../i18n/context';
import {words} from '../progress/words';

type InstallPromptEvent = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>};

type InstallText = {
  title: string;
  description: string;
  cta: string;
  dismiss: string;
};

const installText: Record<string, InstallText> = {
  zh: {
    title: '在手機直接使用',
    description: '將本頁加入主畫面：iOS Safari 請點分享→加入主畫面；Android Chrome 會顯示安裝提示。',
    cta: '我已加入主畫面',
    dismiss: '我先關閉',
  },
  en: {
    title: 'Use it like an app',
    description: 'Add this page to your home screen for a smoother full-screen app experience.',
    cta: 'I added to home screen',
    dismiss: 'Not now',
  },
  ja: {
    title: 'スマホでアプリとして使う',
    description: 'このページをホーム画面に追加すると、より快適に使えるアプリのような体験ができます。',
    cta: 'ホーム画面に追加済みです',
    dismiss: 'あとで',
  },
};

const DISMISSED_KEY='sight-reading-pwa-dismissed';

function iosStandalone() {
  return typeof navigator!=='undefined'&&(navigator as Navigator & {standalone?: boolean}).standalone===true;
}

function matchesMedia(query:string) {
  try { return window.matchMedia(query).matches; }
  catch { return false; }
}

function watchMedia(query:string,onChange:(matches:boolean)=>void) {
  try {
    const media=window.matchMedia(query),change=()=>onChange(media.matches);
    media.addEventListener('change',change);
    return ()=>media.removeEventListener('change',change);
  } catch { return ()=>{}; }
}

function saveDismissal() {
  try { window.localStorage.setItem(DISMISSED_KEY,'1'); }
  catch { /* Closing remains effective for this visit when storage is blocked. */ }
}

export default function MobileInstallPrompt() {
  const {locale} = useI18n();
  const native=Capacitor.isNativePlatform();
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hide, setHide] = useState(() => {
    if(native)return false;
    try { return window.localStorage.getItem(DISMISSED_KEY)==='1'; }
    catch { return false; }
  });
  const [compact,setCompact]=useState(()=>!native&&matchesMedia('(max-width: 900px)'));
  const [isStandalone, setIsStandalone] = useState(()=>!native&&(iosStandalone()||matchesMedia('(display-mode: standalone)')));
  const [installing,setInstalling]=useState(false);
  const pending=useRef(false);

  useEffect(() => {
    if(native)return;
    const unwatchCompact=watchMedia('(max-width: 900px)',setCompact);
    const unwatchStandalone=watchMedia('(display-mode: standalone)',matches=>setIsStandalone(matches||iosStandalone()));
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as unknown as InstallPromptEvent);
    };
    const onInstalled=()=>{
      setInstalled(true);setDeferred(null);saveDismissal();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled',onInstalled);
    return () => {
      unwatchCompact();unwatchStandalone();
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled',onInstalled);
    };
  }, [native]);

  if (native || !compact || isStandalone || installed || hide) return null;
  const copy = Object.fromEntries(Object.keys(installText.en).map(key => {
    const field = key as keyof InstallText;
    return [key, words(locale, installText.zh[field] ?? '', installText.en[field] ?? '', installText.ja[field] ?? '')];
  })) as InstallText;

  const onInstall = async () => {
    if(!deferred||pending.current)return;
    const prompt=deferred;
    pending.current=true;setInstalling(true);
    try {
      const [, {outcome}]=await Promise.all([prompt.prompt(),prompt.userChoice]);
      if(outcome==='accepted'||outcome==='dismissed'){
        setHide(true);saveDismissal();
      }
    } catch {
      // A failed browser prompt is consumed. Keep the manual instructions and
      // close control available, and allow a fresh browser prompt later.
    } finally {
      pending.current=false;setInstalling(false);setDeferred(current=>current===prompt?null:current);
    }
  };

  const onHide = () => {
    setHide(true);saveDismissal();
  };

  return (
    <aside className="mobile-install-prompt" role="status" aria-live="polite">
      <details>
        <summary className="mobile-install-title">{copy.title}</summary>
        <p className="mobile-install-description">{copy.description}</p>
      </details>
      <div className="mobile-install-actions">
        {deferred && <button disabled={installing} aria-busy={installing} onClick={onInstall}>{copy.cta}</button>}
        <button className="mobile-install-secondary" onClick={onHide}>{copy.dismiss}</button>
      </div>
    </aside>
  );
}
