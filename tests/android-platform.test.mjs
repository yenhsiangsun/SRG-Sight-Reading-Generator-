import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const read=path=>fs.readFileSync(path,'utf8');
const android='android/app/src/main/';
const manifest=read(`${android}AndroidManifest.xml`);
const appGradle=read('android/app/build.gradle');
const config=loadModule('capacitor.config.ts').default;

test('Android identity and optional microphone permit preview and release installs without storage permissions',()=>{
  assert.equal(appGradle.match(/applicationId\s+"([^"]+)"/)?.[1],config.appId);
  assert.equal(appGradle.match(/namespace\s*=\s*"([^"]+)"/)?.[1],config.appId);
  const activity=read(`${android}java/${config.appId.replaceAll('.','/')}/MainActivity.java`);
  assert.ok(activity.includes(`package ${config.appId};`));
  assert.match(activity,/extends BridgeActivity/);
  assert.match(appGradle,/applicationIdSuffix\s+['"]\.preview['"]/);
  assert.match(manifest,/android:authorities="\$\{applicationId\}\.fileprovider"/);
  assert.match(manifest,/<activity\b[^>]*android:exported="true"/);
  assert.match(manifest,/android.intent.category.LAUNCHER/);
  const permissions=[...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(([,name])=>name);
  assert.deepEqual(permissions.sort(),[
    'android.permission.INTERNET','android.permission.MODIFY_AUDIO_SETTINGS','android.permission.RECORD_AUDIO',
  ]);
  assert.match(manifest,/<uses-feature\s+android:name="android.hardware.microphone"\s+android:required="false"/);
  assert.match(manifest,/<provider\b[^>]*android:exported="false"[^>]*android:grantUriPermissions="true"/);
  const paths=read(`${android}res/xml/file_paths.xml`);
  assert.match(paths,/<cache-path\b[^>]*path="\."/);
  assert.doesNotMatch(paths,/<(?:root|external)-path\b/);
});

test('Android API levels cover installed native plugins and both CI workflows supply their Java version',()=>{
  const variables=read('android/variables.gradle');
  const sdk=name=>Number(variables.match(new RegExp(`${name}\\s*=\\s*(\\d+)`))?.[1]);
  assert.ok(sdk('minSdkVersion')>=24);
  assert.ok(sdk('targetSdkVersion')>=36);
  assert.ok(sdk('compileSdkVersion')>=sdk('targetSdkVersion'));
  const workflow=read('codemagic.yaml');
  for(const plugin of ['android/capacitor','filesystem/android','share/android']) {
    const gradle=read(`node_modules/@capacitor/${plugin}/build.gradle`);
    const minimum=Number(gradle.match(/minSdkVersion[^\n]*:\s*(\d+)/)?.[1]);
    const compile=Number(gradle.match(/compileSdk[^\n]*:\s*(\d+)/)?.[1]);
    assert.ok(sdk('minSdkVersion')>=minimum,plugin);
    assert.ok(sdk('compileSdkVersion')>=compile,plugin);
    const java=gradle.match(/sourceCompatibility JavaVersion.VERSION_(\d+)/)?.[1];
    for(const name of ['android-preview','android-play-release']) {
      const job=workflow.match(new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [\\w-]+:|$(?![\\s\\S]))`,'m'))?.[1];
      assert.ok(job,`${name} exists`);
      assert.match(job,new RegExp(`java:\\s*${java}\\b`));
    }
  }
});

test('Android launcher and splash icons resolve for both API 24 and adaptive-icon devices',()=>{
  assert.match(manifest,/android:icon="@mipmap\/app_icon"/);
  assert.match(manifest,/android:roundIcon="@mipmap\/app_icon"/);
  for(const path of ['res/mipmap-nodpi/app_icon.png','res/drawable-nodpi/app_brand.png']) {
    const png=fs.readFileSync(`${android}${path}`);
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(png.readUInt32BE(16),png.readUInt32BE(20),'icon is square');
    assert.ok(png.readUInt32BE(16)>=192,'launcher asset has sufficient pixel dimensions');
  }
  const adaptive=read(`${android}res/mipmap-anydpi-v26/app_icon.xml`);
  assert.match(adaptive,/<adaptive-icon\b/);
  assert.match(adaptive,/@color\/app_icon_background/);
  assert.match(adaptive,/@drawable\/app_icon_foreground/);
  assert.match(read(`${android}res/drawable/app_icon_foreground.xml`),/@drawable\/app_brand/);
  assert.match(read(`${android}res/values/app_colors.xml`),/<color name="app_icon_background">#[\da-f]{6}<\/color>/i);
  assert.match(read(`${android}res/values/styles.xml`),/<item name="windowSplashScreenAnimatedIcon">@mipmap\/app_icon<\/item>/);
});

test('Android edge-to-edge insets reach the same CSS safe area used by Safari',()=>{
  assert.equal(config.plugins.SystemBars.insetsHandling,'css');
  assert.equal(config.plugins.SystemBars.initialViewportFitValueHint,'cover');
  assert.match(read('index.html'),/name="viewport"[^>]*viewport-fit=cover/);
  const css=read('src/safeArea.css');
  const native=read('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java');
  for(const side of ['top','right','bottom','left']) {
    assert.ok(native.includes(`"--safe-area-inset-${side}"`));
    assert.match(css,new RegExp(`--safe-${side}:\\s*var\\(--safe-area-inset-${side},\\s*env\\(safe-area-inset-${side},\\s*0px\\)\\)`));
  }
});

test('Android CI regenerates native plugins before building and requires all release signing credentials',()=>{
  const workflow=read('codemagic.yaml');
  const jobs={};
  for(const name of ['android-preview','android-play-release']) {
    const job=workflow.match(new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [\\w-]+:|$(?![\\s\\S]))`,'m'))?.[1];
    assert.ok(job,`${name} exists`);
    assert.ok(job.indexOf('npm run build')<job.indexOf('npx cap sync android'));
    assert.ok(job.indexOf('npx cap sync android')<job.indexOf('./gradlew '));
    assert.match(job,/ANDROID_VERSION_CODE="\$BUILD_NUMBER"/);
    jobs[name]=job;
  }
  assert.match(jobs['android-preview'],/assembleDebug bundleRelease lintRelease/);
  assert.match(jobs['android-preview'],/UNSIGNED\.aab/);
  assert.doesNotMatch(jobs['android-preview'],/android_signing:/);
  assert.match(jobs['android-play-release'],/android_signing:/);
  assert.doesNotMatch(jobs['android-play-release'],/^\s*triggering:/m);
  for(const variable of ['CM_KEYSTORE_PATH','CM_KEYSTORE_PASSWORD','CM_KEY_ALIAS','CM_KEY_PASSWORD']) {
    assert.ok(jobs['android-play-release'].includes(`\${${variable}:?`),`${variable} must fail when missing`);
    assert.ok(appGradle.includes(`System.getenv('${variable}')`));
  }
  assert.match(appGradle,/if \(hasReleaseSigning\) signingConfig signingConfigs\.release/);
  assert.match(appGradle,/versionCode Integer\.parseInt\(System\.getenv\('ANDROID_VERSION_CODE'\)/);
});
