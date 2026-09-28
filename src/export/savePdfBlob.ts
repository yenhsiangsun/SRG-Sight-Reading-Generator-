import {Capacitor} from '@capacitor/core';
import {Directory,Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';

let exportNumber=0;

function binaryBase64(blob:Blob):Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error??new Error('Unable to read PDF'));
    reader.onabort=()=>reject(new Error('PDF reading was canceled'));
    reader.onload=()=>{
      const data=reader.result;
      if(typeof data!=='string'||!/^data:[^,]*;base64,/.test(data)){
        reject(new Error('Invalid PDF data'));return;
      }
      resolve(data.slice(data.indexOf(',')+1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Browser downloads and native share sheets need different file delivery paths. */
export async function savePdfBlob(blob:Blob,filename:string,title:string) {
  if(Capacitor.isNativePlatform()){
    if(!Capacitor.isPluginAvailable('Filesystem')||!Capacitor.isPluginAvailable('Share')){
      throw new Error('Native PDF sharing is unavailable');
    }
    if(!(await Share.canShare()).value)throw new Error('PDF sharing is unavailable');
    const data=await binaryBase64(blob);
    // A unique cache folder keeps a second export from overwriting a file that
    // another app is still reading. Cache needs no shared-storage permission.
    const path=`score-exports/${Date.now()}-${++exportNumber}/${filename}`;
    const {uri}=await Filesystem.writeFile({path,data,directory:Directory.Cache,recursive:true});
    if(!uri?.startsWith('file://'))throw new Error('PDF file URI is unavailable');
    // Keep the cache file: Android may return from its chooser before the
    // receiving app has read it. The OS can reclaim this temporary cache.
    try{await Share.share({title,dialogTitle:title,files:[uri]});}
    catch(error){
      // Both native Share implementations use this exact cancellation message.
      // Cancel is distinct from a completed share; all genuine failures reject.
      if(error&&typeof error==='object'&&'message' in error&&error.message==='Share canceled')return 'canceled' as const;
      throw error;
    }
    return 'shared' as const;
  }

  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;
  try{
    document.body.append(link);link.click();
    // Give Safari time to finish opening/saving the generated document.
    setTimeout(()=>URL.revokeObjectURL(url),60_000);
  }catch(error){URL.revokeObjectURL(url);throw error;}
  finally{link.remove();}
  return 'download-started' as const;
}
