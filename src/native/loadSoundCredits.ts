/** WKWebView can expose a bundled custom-scheme response with status zero.
 * Keep that exception limited to this app's local, non-opaque credits file. */
export async function loadSoundCredits(pageUrl:string,baseUrl:string,signal?:AbortSignal) {
  const page=new URL(pageUrl),url=new URL(`${baseUrl}samples/CREDITS.txt`,page);
  const response=await fetch(url.href,{signal});
  const nativeLocal=response.status===0&&page.protocol==='capacitor:'&&page.hostname==='localhost'
    &&url.protocol===page.protocol&&url.hostname===page.hostname&&url.port===page.port
    &&response.type!=='opaque'&&response.type!=='opaqueredirect';
  if(!response.ok&&!nativeLocal)throw new Error('Credits unavailable');
  const text=await response.text();
  // A missing bundled asset may be rewritten to the app's successful HTML entry.
  if(!text.trim()||/^\s*(?:<!doctype\s+html\b|<html(?:\s|>))/i.test(text))throw new Error('Credits unavailable');
  return text;
}
