import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadModule} from './helpers.mjs';

/** Read the original atlas pixels for coverage checks; never transform its artwork. */
function rgbaPng(filename) {
  const png = fs.readFileSync(filename);
  assert.equal(png.readUInt32BE(0), 0x89504e47);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(png[24], 8, 'painted atlas retains eight-bit colour');
  assert.equal(png[25], 6, 'painted atlas retains RGBA transparency');
  assert.equal(png[28], 0, 'painted atlas uses ordinary scanlines');
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scan = inflateSync(Buffer.concat(chunks));
  const stride = width * 4, pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const row = y * stride, input = y * (stride + 1), filter = scan[input];
    assert.ok(filter >= 0 && filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[row + x - 4] : 0;
      const b = y ? pixels[row - stride + x] : 0;
      const c = y && x >= 4 ? pixels[row - stride + x - 4] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      pixels[row + x] = (scan[input + x + 1] + prediction) & 255;
    }
  }
  return {width, height, pixels};
}

test('all twenty-three companions have three distinct, nonempty painted forms inside their original atlas', () => {
  const {PET_IDS} = loadModule('src/progress/progress.ts');
  const {growthAtlasRegions} = loadModule('src/progress/growthAtlas.ts');
  const companions = ['original', ...PET_IDS];
  assert.equal(companions.length, 23);
  assert.deepEqual(Object.keys(growthAtlasRegions).sort(), [...companions].sort());
  const atlases = new Map(), addresses = new Set();
  for (const pet of companions) {
    const forms = growthAtlasRegions[pet];
    assert.deepEqual(Object.keys(forms).sort(), ['adult', 'baby', 'young']);
    const fingerprints = new Set();
    for (const stage of ['baby', 'young', 'adult']) {
      const {file, sourceWidth, sourceHeight, crop} = forms[stage];
      if (!atlases.has(file)) atlases.set(file, rgbaPng(`public/companions/${file}`));
      const atlas = atlases.get(file);
      assert.equal(sourceWidth, atlas.width, `${pet}/${stage}: source width`);
      assert.equal(sourceHeight, atlas.height, `${pet}/${stage}: source height`);
      const [x, y, width, height] = crop;
      assert.ok(crop.every(Number.isInteger));
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= atlas.width && y + height <= atlas.height, `${pet}/${stage}: crop stays inside source`);
      const address = `${file}:${crop.join(',')}`;
      assert.ok(!addresses.has(address), `${pet}/${stage}: a growth stage must use its own painted form`);
      addresses.add(address);
      const hash = createHash('sha256');
      let painted = 0, transparent = 0;
      for (let row = y; row < y + height; row++) {
        const pixels = atlas.pixels.subarray((row * atlas.width + x) * 4, (row * atlas.width + x + width) * 4);
        hash.update(pixels);
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] > 24) painted++;
          else transparent++;
        }
      }
      assert.ok(painted > 500, `${pet}/${stage}: a visible painted portrait exists`);
      assert.ok(transparent > 50, `${pet}/${stage}: surroundings remain transparent`);
      fingerprints.add(hash.digest('hex'));
    }
    assert.equal(fingerprints.size, 3, `${pet}: age changes the artwork, not just its displayed size`);
  }
  assert.equal(addresses.size, 69);
  assert.equal(atlases.size, 5, 'four family sheets and two independently isolated adult portraits');
});
