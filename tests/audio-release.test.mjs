import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'vite';
import {ARCHIVED_SAMPLE_DIRECTORIES, copyReleasePublicAssets, releasePublicAssets} from '../build/releasePublicAssets.ts';

function fixture(t) {
  // macOS exposes /var as an alias of /private/var. Create and compare using
  // the canonical parent so the cleanup guard remains strict on both paths.
  const tempRoot = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempRoot, 'srg-audio-release-'));
  t.after(() => {
    assert.equal(fs.realpathSync(path.dirname(root)), tempRoot);
    assert.ok(path.basename(root).startsWith('srg-audio-release-'));
    fs.rmSync(root, {recursive:true, force:true});
  });
  const write = (name, data) => {
    const file=path.join(root,name); fs.mkdirSync(path.dirname(file), {recursive:true});fs.writeFileSync(file,data);
  };
  const manifest = {
    Pipa:{folder:'pipa',urls:{A3:'A3-recital.wav'}},
    Guitar:{folder:'guitar-acoustic',urls:{A3:'A3.mp3'}},
    Violin:{folder:'violin',urls:{A3:'A3.mp3',D7:'../western-completion/violin/D7.wav'}},
  };
  write('index.html','<!doctype html><html><body><main>Release fixture</main></body></html>');
  write('src/audio/sampleManifest.json', JSON.stringify(manifest));
  for (const directory of ARCHIVED_SAMPLE_DIRECTORIES) write(`public/${directory}/archived.wav`, 'archive-preserved');
  write('public/samples/pipa/A3-recital.wav', 'old-recital');
  write('public/samples/guitar-acoustic/A3.mp3','current-guitar');
  write('public/samples/violin/A3.mp3','current-violin');
  write('public/samples/western-completion/violin/D7.wav','extended-range-violin');
  write('public/samples/CREDITS.txt','Source authors, licenses and processing');
  write('public/companions/forest.png','current-companion');
  write('public/capture-worklet.js','current-microphone-worklet');
  return {root,write,manifest,publicDir:path.join(root,'public'),outDir:path.join(root,'dist'),manifestPath:path.join(root,'src/audio/sampleManifest.json')};
}

test('a real Vite build excludes archived audio while preserving active samples, credits and source previews', async t => {
  const f=fixture(t);
  await build({root:f.root,configFile:false,logLevel:'silent',plugins:[releasePublicAssets()]});
  for(const directory of ARCHIVED_SAMPLE_DIRECTORIES) {
    assert.equal(fs.existsSync(path.join(f.outDir,directory)),false,directory);
    assert.equal(fs.readFileSync(path.join(f.publicDir,directory,'archived.wav'),'utf8'),'archive-preserved');
  }
  for(const file of ['samples/guitar-acoustic/A3.mp3','samples/violin/A3.mp3','samples/western-completion/violin/D7.wav','samples/CREDITS.txt','companions/forest.png','capture-worklet.js']) {
    assert.deepEqual(fs.readFileSync(path.join(f.outDir,file)),fs.readFileSync(path.join(f.publicDir,file)),file);
  }
});

test('a future active mapping to archived recordings fails the build instead of producing broken playback', t => {
  const f=fixture(t);
  f.manifest.Guitar={folder:'erhu-bisa',urls:{A3:'archived.wav'}};
  f.write('src/audio/sampleManifest.json',JSON.stringify(f.manifest));
  assert.throws(()=>copyReleasePublicAssets(f.publicDir,f.outDir,f.manifestPath),/Active playback uses an excluded release sample/);
  assert.equal(fs.existsSync(f.outDir),false,'fail before copying an incomplete release');
});

test('stale archived output is rejected and source directories cannot be used as the release destination',t=>{
  const f=fixture(t);
  f.write('dist/samples/pipa/stale.wav','stale');
  assert.throws(()=>copyReleasePublicAssets(f.publicDir,f.outDir,f.manifestPath),/Archived sample remains in release output/);
  assert.throws(()=>copyReleasePublicAssets(f.publicDir,f.publicDir,f.manifestPath),/separate source and output/);
});
