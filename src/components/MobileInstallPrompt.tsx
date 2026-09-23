import {useEffect, useState} from 'react';
import {useI18n} from '../i18n/context';
import {words} from '../progress/words';

type InstallPromptEvent = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>};

type InstallText = {
  title: string;
  description: string;
  cta: string;
  secondary?: string;
  dismiss: string;
};

const installText: Record<string, InstallText> = {
  zh: {
    title: '在手機直接使用',
    description: '將本頁加入主畫面：iOS Safari 請點分享→加入主畫面；Android Chrome 會顯示安裝提示。',
    cta: '我已加入主畫面',
    secondary: '開始今日練習',
    dismiss: '我先關閉',
  },
  en: {
    title: 'Use it like an app',
    description: 'Add this page to your home screen for a smoother full-screen app experience.',
    cta: 'I added to home screen',
    secondary: 'Start today',
    dismiss: 'Not now',
  },
  ja: {
    title: 'スマホでアプリとして使う',
    description: 'このページをホーム画面に追加すると、より快適に使えるアプリのような体験ができます。',
    cta: 'ホーム画面に追加済みです',
    secondary: '今日の練習を開始',
    dismiss: 'あとで',
  },
};


export default function MobileInstallPrompt() {
  const {locale} = useI18n();
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hide, setHide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const hasStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;
    setIsStandalone(hasStandalone);

    const dismissed = window.localStorage.getItem('sight-reading-pwa-dismissed') === '1';
    if (dismissed) setHide(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as unknown as InstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  if (!compact || isStandalone || installed || hide) return null;
  const copy = Object.fromEntries(Object.keys(installText.en).map(key => {
    const field = key as keyof InstallText;
    return [key, words(locale, installText.zh[field] ?? '', installText.en[field] ?? '', installText.ja[field] ?? '')];
  })) as InstallText;

  const onInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      const {outcome} = await deferred.userChoice;
      if (outcome === 'dismissed') {
        localStorage.setItem('sight-reading-pwa-dismissed', '1');
        setHide(true);
      } else {
        setInstalled(true);
        localStorage.setItem('sight-reading-pwa-dismissed', '1');
      }
    } catch {
      localStorage.setItem('sight-reading-pwa-dismissed', '1');
      setHide(true);
    }
  };

  const onHide = () => {
    localStorage.setItem('sight-reading-pwa-dismissed', '1');
    setHide(true);
  };

  return (
    <aside className="mobile-install-prompt" role="status" aria-live="polite">
      <div>
        <p className="mobile-install-title">{copy.title}</p>
        <p className="mobile-install-description">{copy.description}</p>
        {copy.secondary && <small>{copy.secondary}</small>}
      </div>
      <div className="mobile-install-actions">
        {deferred && <button onClick={onInstall}>{copy.cta}</button>}
        <button className="mobile-install-secondary" onClick={onHide}>{copy.dismiss}</button>
      </div>
    </aside>
  );
}
