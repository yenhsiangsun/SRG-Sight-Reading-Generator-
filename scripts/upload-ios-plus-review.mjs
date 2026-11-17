import {createHash, createPrivateKey, sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {basename, join} from 'node:path';

const [attachmentsDirectory] = process.argv.slice(2);
const appId = '6815293617';
const bundleId = 'com.yenhsiang.sightreadinggenerator';
const groupId = '22584777';

const group = new Map([
  ['6835491440', bundleId + '.plus.monthly'],
  ['6835491716', bundleId + '.plus.annual'],
]);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const keyId = process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
const pem = process.env.APP_STORE_CONNECT_PRIVATE_KEY;
if (!keyId || !issuerId || !pem) throw new Error('The Codemagic App Store Connect integration is unavailable to this build.');
const key = createPrivateKey(pem.replaceAll('\\n', '\n'));

function token() {
  const now = Math.floor(Date.now() / 1000);
  const body = encode({alg: 'ES256', kid: keyId, typ: 'JWT'}) + '.' +
    encode({iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1'});
  return body + '.' + sign('sha256', Buffer.from(body), {key, dsaEncoding: 'ieee-p1363'}).toString('base64url');
}

async function asc(path, method = 'GET', data) {
  const response = await fetch('https://api.appstoreconnect.apple.com/v1/' + path, {
    method,
    headers: {Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json'},
    body: data ? JSON.stringify({data}) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 204) return undefined;
  const result = await response.json();
  if (!response.ok) {
    const details = result.errors?.map(({code, title}) => code + ' ' + title).join(', ');
    throw Object.assign(new Error(method + ' ' + path + ': ' + response.status + ' ' + (details ?? '')), {status: response.status});
  }
  return result.data;
}

const app = await asc('apps/' + appId);
if (app.attributes.bundleId !== bundleId) throw new Error('Unexpected application');
const plans = await asc('subscriptionGroups/' + groupId + '/subscriptions');
if ([...group].some(([id, sku]) => !plans.some(plan => plan.id === id && plan.attributes.productId === sku))) {
  throw new Error('Unexpected subscription identifiers');
}

const manifest = JSON.parse(await readFile(join(attachmentsDirectory, 'manifest.json'), 'utf8'));
const screenshots = manifest.flatMap(test => test.attachments)
  .filter(file => file.suggestedHumanReadableName?.startsWith('plus-paywall-zh-TW') && !file.isAssociatedWithFailure);
if (screenshots.length !== 1) throw new Error('Expected a single native paywall screenshot from the passing XCTest run');
const name = basename(screenshots[0].exportedFileName);
const png = await readFile(join(attachmentsDirectory, name));
if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('The native capture is not PNG');
const target = 'subscriptionAppStoreReviewScreenshots';
for (const id of group.keys()) {
  let asset;
  try {
    asset = await asc('subscriptions/' + id + '/appStoreReviewScreenshot');
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  if (asset?.attributes.assetDeliveryState?.state === 'COMPLETE') {
    console.log(id, 'already has a completed review screenshot');
    continue;
  }
  if (asset) throw new Error('Review screenshot already reserved on ' + id + ': verify that upload before retrying');

  asset = await asc(target, 'POST', {
    type: target,
    attributes: {fileName: 'tonecraft-plus-ios.png', fileSize: png.length},
    relationships: {subscription: {data: {type: 'subscriptions', id}}},
  });

  for (const operation of asset.attributes.uploadOperations) {
    const url = new URL(operation.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.apple.com')) {
      throw new Error('Unexpected Apple asset upload host');
    }
    const response = await fetch(url, {
      method: operation.method,
      headers: Object.fromEntries(operation.requestHeaders.map(header => [header.name, header.value])),
      body: png.subarray(operation.offset, operation.offset + operation.length),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('Apple media transfer returned status ' + response.status);
  }

  const assetPath = target + '/' + asset.id;
  await asc(assetPath, 'PATCH', {
    type: target, id: asset.id,
    attributes: {uploaded: true, sourceFileChecksum: createHash('md5').update(png).digest('hex')},
  });
  for (let attempt = 0; attempt < 16; attempt++) {
    asset = await asc(assetPath);
    const state = asset.attributes.assetDeliveryState.state;
    if (state === 'COMPLETE') {
      console.log(id, 'review screenshot complete', asset.id);
      break;
    }
    if (state === 'FAILED' || attempt === 15) throw new Error(id + ' Apple asset state: ' + state);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}
