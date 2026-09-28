import {useEffect,useLayoutEffect,useRef} from 'react';
import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {App as NativeApp} from '@capacitor/app';

interface NativeBackState {
  dialogOpen:boolean;
  examActive:boolean;
  page:'home'|'setup'|'practice';
  closeDialog:()=>void;
  goHome:()=>void;
}

export async function handleNativeBack(state:NativeBackState,minimize:()=>Promise<void>) {
  if(state.dialogOpen){state.closeDialog();return;}
  // Keep an active question intact. Its existing Cancel button is the explicit
  // route out; a hardware gesture must not silently discard the performance.
  if(state.examActive)return;
  if(state.page!=='home'){state.goHome();return;}
  await minimize();
}

export function useNativeBack(state:NativeBackState) {
  const latest=useRef(state);
  useLayoutEffect(()=>{latest.current=state;},[state]);
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('App'))return;
    let disposed=false,listener:PluginListenerHandle|undefined;
    const remove=(handle:PluginListenerHandle)=>{void handle.remove().catch(error=>console.warn('Unable to remove Android back listener',error));};
    void NativeApp.addListener('backButton',()=>{
      if(!disposed)void handleNativeBack(latest.current,()=>NativeApp.minimizeApp()).catch(error=>console.warn('Unable to handle Android back',error));
    }).then(handle=>{
      if(disposed)remove(handle);
      else listener=handle;
    }).catch(error=>console.warn('Unable to register Android back listener',error));
    return()=>{
      disposed=true;
      if(listener)remove(listener);
    };
  },[]);
}
