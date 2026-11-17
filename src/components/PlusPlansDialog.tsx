import {useCallback, useEffect, useRef, useState} from 'react';
import {StudioDialog} from './StudioDialogs';
import {useI18n} from '../i18n/context';
import {legalLabels} from '../legal/content';
import {publisher} from '../legal/publisher';
import {words} from '../progress/words';
import {NATIVE_PLUS, plusStore, type PlusPlan} from '../subscriptions/plusStore';
import './PlusPlansDialog.css';

export const APPLE_TERMS = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const previewPlans: PlusPlan[] = [
  {id: 'preview-month', period: 'month', price: 'NT$60'},
  {id: 'preview-year', period: 'year', price: 'NT$690', firstYearPrice: 'NT$390'},
];

type Operation = 'purchase' | 'restore' | 'manage' | 'redeem';
type Notice = 'pending' | 'restored' | 'not-found' | 'unavailable';

export function PlusPlansDialog({active, refresh, onClose}: {
  active: boolean;
  refresh: () => Promise<boolean>;
  onClose: () => void;
}) {
  const {locale} = useI18n();
  const w = (zh: string, en: string, ja: string) => words(locale, zh, en, ja);
  const [plans, setPlans] = useState<PlusPlan[]>(NATIVE_PLUS ? [] : previewPlans);
  const [loading, setLoading] = useState(NATIVE_PLUS);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const requestInProgress = useRef(false);

  const load = useCallback(async () => {
    try {
      const {plans} = await plusStore.products();
      setPlans(plans.slice().sort((a, b) => Number(a.period === 'year') - Number(b.period === 'year')));
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (NATIVE_PLUS) void load();
  }, [load]);

  async function perform(action: Operation, plan?: PlusPlan) {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setOperation(action);
    setNotice(null);
    try {
      switch (action) {
        case 'purchase': {
          if (!plan) return;
          const result = await plusStore.purchase({id: plan.id});
          if (result.status === 'pending') setNotice('pending');
          if (result.status === 'purchased') await refresh();
          break;
        }
        case 'restore': {
          const result = await plusStore.restore();
          await refresh();
          setNotice(result.active ? 'restored' : 'not-found');
          break;
        }
        case 'manage':
          await plusStore.manageSubscriptions();
          await refresh();
          break;
        case 'redeem':
          await plusStore.redeemCode();
          await refresh();
          break;
      }
      if (action !== 'manage') void load();
    } catch {
      setNotice('unavailable');
    } finally {
      requestInProgress.current = false;
      setOperation(null);
    }
  }

  const status = notice === 'pending'
    ? w('Apple 正在處理，完成後會自動啟用 Plus。', 'Apple is processing your purchase. Plus will activate automatically.', 'Apple が処理中です。完了後に Plus が有効になります。')
    : notice === 'restored'
      ? w('已恢復 Plus。', 'Your Plus access was restored.', 'Plus を復元しました。')
      : notice === 'not-found'
        ? w('這個 Apple 帳號目前沒有有效的 Plus 訂閱。', 'This Apple Account has no active Plus subscription.', 'この Apple Account に有効な Plus はありません。')
        : notice === 'unavailable'
          ? w('暫時無法完成，請稍後再試。', 'Unable to complete the request. Please try again.', '処理できませんでした。もう一度お試しください。')
          : '';

  return <StudioDialog title={w('琢音 Plus', 'Tonecraft Plus', 'TONECRAFT Plus')} onClose={onClose}>
    <div className="plus-plans">
      <p className="plus-benefit">{active
        ? w('Plus 使用中 · 不限新譜生成', 'Plus active · unlimited new studies', 'Plus 利用中 · 新しい譜例を無制限に作成')
        : w('不限新譜生成。依自己的樂器、音域和難度繼續練習。', 'Generate unlimited studies for your instrument, range and difficulty.', '楽器・音域・難易度に合わせた譜例を無制限に作成できます。')}</p>
      {!NATIVE_PLUS && <p className="price-note">{w('台灣方案預覽', 'Taiwan plan preview', '台湾向けプランのプレビュー')}</p>}
      {loading && <p role="status">{w('正在讀取 App Store 價格…', 'Loading App Store prices…', 'App Store の価格を取得中…')}</p>}
      {!loading && plans.length === 0 && <div className="plus-unavailable">
        <p role="status">{w('目前無法取得訂閱方案。', 'Subscription plans are currently unavailable.', '現在、プランを取得できません。')}</p>
        <button type="button" className="secondary-button" onClick={() => {setLoading(true); void load();}}>{w('重新載入', 'Retry', '再読み込み')}</button>
      </div>}
      {!active && plans.length > 0 && <div className="plus-plan-grid">{plans.map(plan => {
        const annual = plan.period === 'year';
        const intro = !active && plan.firstYearPrice;
        const billing = annual
          ? w('{price}／年', '{price} / year', '{price}／年').replace('{price}', plan.price)
          : w('{price}／月', '{price} / month', '{price}／月').replace('{price}', plan.price);
        return <article className="plus-plan" key={plan.id}>
          <h3>{annual ? w('年繳', 'Annual', '年額') : w('月繳', 'Monthly', '月額')}</h3>
          <p className="plus-plan-price">{intro ? w('首年 {price}', '{price} for the first year', '初年度 {price}').replace('{price}', intro) : billing}</p>
          <p className="price-note">{intro
            ? w('第二年起 {price}', 'Then {price}', '2年目から {price}').replace('{price}', billing)
            : w('自動續訂', 'Auto-renews', '自動更新')}</p>
          <button type="button" className="secondary-button" disabled={!NATIVE_PLUS || loading || !!operation}
            onClick={() => { void perform('purchase', plan); }}>
            {annual ? w('訂閱年繳', 'Subscribe annually', '年額で登録') : w('訂閱月繳', 'Subscribe monthly', '月額で登録')}
          </button>
        </article>;
      })}</div>}
      {status && <p role="status">{status}</p>}
      {NATIVE_PLUS && <>
        <p className="price-note">{!active && w('訂閱由 Apple 帳號付款。除非取消，訂閱會自動續訂。可在 App Store 管理或取消。', 'Your Apple Account is charged for the subscription. It renews automatically unless cancelled in the App Store.', 'お支払いは Apple Account に請求され、解約するまで自動更新されます。App Store で管理・解約できます。')}</p>
        <div className="plus-utility">
          <button type="button" disabled={!!operation} onClick={() => void perform('restore')}>{w('恢復購買', 'Restore purchases', '購入を復元')}</button>
          <button type="button" disabled={!!operation} onClick={() => void perform('redeem')}>{w('兌換優惠碼', 'Redeem offer code', 'コードを引き換え')}</button>
          <button type="button" disabled={!!operation} onClick={() => void perform('manage')}>{w('管理訂閱', 'Manage subscription', 'サブスクリプションを管理')}</button>
        </div>
        <div className="plus-utility">
          <a href={APPLE_TERMS} target="_blank" rel="noreferrer">{w('使用條款', 'Terms of Use', '利用規約')}</a>
          <a href={publisher.privacyUrl} target="_blank" rel="noreferrer">{legalLabels[locale].privacy}</a>
        </div>
      </>}
    </div>
  </StudioDialog>;
}
