/** Fill these only with publisher-confirmed public contact details.
 * No private Apple account email or guessed website is used as a substitute. */
export const publisher = {
  name: 'YenHsiang Sun（琢音 TONECRAFT）',
  supportEmail: 'tonecraft.zhuoyin@gmail.com',
  privacyUrl: 'https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/privacy',
  supportUrl: 'https://tonecraft-zhuoyin.smt2640630223.chatgpt.site/zh-TW/support',
  effectiveDate: '2026-10-15',
};

export const legalUpdated = '2026-10-15';

export function validPolicyDate(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export function publicContactReady() {
  return Boolean(publisher.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publisher.supportEmail)
    && validPolicyDate(publisher.effectiveDate));
}
