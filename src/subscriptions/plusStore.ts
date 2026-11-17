import {App} from '@capacitor/app';
import {Capacitor, registerPlugin, type PluginListenerHandle} from '@capacitor/core';
import {useCallback, useEffect, useState} from 'react';

export const NATIVE_PLUS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

export interface PlusPlan {
  id: string;
  period: 'month' | 'year';
  price: string;
  firstYearPrice?: string;
}

interface PlusStorePlugin {
  products(): Promise<{plans: PlusPlan[]}>;
  entitlement(): Promise<{active: boolean}>;
  purchase(options: {id: string}): Promise<{status: 'purchased' | 'pending' | 'cancelled'; active?: boolean}>;
  restore(): Promise<{active: boolean}>;
  manageSubscriptions(): Promise<void>;
  redeemCode(): Promise<void>;
  addListener(event: 'subscriptionChanged', listener: () => void): Promise<PluginListenerHandle>;
}

export const plusStore = registerPlugin<PlusStorePlugin>('TonecraftPlus');

export function usePlusEntitlement() {
  const [active, setActive] = useState(false);
  const refresh = useCallback(async () => {
    if (!NATIVE_PLUS) return false;
    const result = await plusStore.entitlement();
    setActive(result.active);
    return result.active;
  }, []);
  useEffect(() => {
    if (!NATIVE_PLUS) return;
    const reload = () => { void refresh().catch(() => undefined); };
    const transactionListener = plusStore.addListener('subscriptionChanged', reload);
    const foregroundListener = App.addListener('appStateChange', state => {
      if (state.isActive) reload();
    });
    reload();
    return () => {
      void transactionListener.then(listener => listener.remove()).catch(() => undefined);
      void foregroundListener.then(listener => listener.remove()).catch(() => undefined);
    };
  }, [refresh]);
  return {active, refresh};
}
