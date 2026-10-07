import type { Instrument } from '../music/instruments';
type Portrait = { sheet: 'main' | 'extra' | 'reference' | 'guan' | 'keyedGuan'; cell: number };
const main = (cell: number): Portrait => ({ sheet: 'main', cell });
const extra = (cell: number): Portrait => ({ sheet: 'extra', cell });
const reference = (cell: number): Portrait => ({ sheet: 'reference', cell });
const guan: Portrait = { sheet: 'guan', cell: 0 };
const keyedGuan: Portrait = { sheet: 'keyedGuan', cell: 0 };
const artworkSources: Record<Portrait['sheet'], string> = {
  main: '/artwork/cute-instruments-main-v1.webp',
  extra: '/artwork/cute-instruments-extra-v1.webp',
  reference: '/artwork/cute-sheng-pipa-v2.webp',
  guan: '/artwork/cute-traditional-guan-v3.webp',
  keyedGuan: '/artwork/cute-keyed-guan-v3.webp',
};

type SourceRect = readonly [x: number, y: number, width: number, height: number];
// Generated illustrations are intentionally organic, rather than a strict grid.
// These source viewports preserve complete instruments without adjacent artwork.
const sourceRects: Record<Portrait['sheet'], readonly SourceRect[]> = {
  guan: [[0, 0, 1254, 1254]],
  keyedGuan: [[0, 0, 1254, 1254]],
  reference: [[0, 0, 627, 627], [627, 0, 627, 627], [0, 627, 627, 627], [627, 627, 627, 627]],
  main: [
    [8, 42, 301, 266], [377, 9, 203, 304], [690, 0, 176, 322], [1000, 0, 180, 322],
    [65, 317, 160, 304], [399, 316, 162, 312], [663, 330, 198, 294], [893, 402, 359, 222],
    [23, 646, 267, 278], [362, 630, 203, 294], [652, 625, 242, 296], [914, 661, 331, 258],
    [3, 936, 295, 283], [392, 923, 144, 307], [608, 958, 320, 285], [1006, 943, 160, 287],
  ],
  extra: [
    [114, 4, 98, 295], [400, 0, 153, 302], [634, 44, 296, 259], [994, 0, 231, 301],
    [32, 318, 226, 298], [377, 299, 198, 320], [644, 337, 253, 275], [997, 315, 195, 298],
    [127, 630, 68, 295], [380, 619, 174, 309], [671, 625, 192, 297], [959, 635, 278, 288],
    [53, 926, 225, 323], [370, 928, 203, 318], [641, 920, 280, 326], [1044, 920, 156, 327],
  ],
};

// Portrait indices read left to right, then top to bottom within each sheet.
// Keep every profile explicit so adding an instrument requires choosing its art.
const portraits = {
  Piano: main(0),
  Violin: main(1),
  Viola: extra(12),
  Cello: main(2),
  'Double Bass': extra(5),
  Flute: main(8),
  Clarinet: main(9),
  Oboe: extra(0),
  Bassoon: extra(1),
  Trumpet: main(11),
  'French Horn': main(12),
  Trombone: extra(2),
  Tuba: extra(3),
  'Alto Saxophone': main(10),
  'Tenor Saxophone': main(10),
  Guitar: main(3),
  'Bass Guitar': extra(4),
  Voice: main(15),
  Sheng: reference(0),
  'Alto Sheng': reference(1),
  'Tenor Sheng': reference(1),
  'Bass Sheng': reference(2),
  'Bangdi G': extra(6),
  'Bangdi F': extra(6),
  'Bangdi A': extra(6),
  'Bangdi C': extra(6),
  'Qudi C': extra(6),
  'Qudi Bb': extra(6),
  'Qudi D': extra(6),
  'Qudi E': extra(6),
  'Xindi G': extra(6),
  'Xindi F': extra(6),
  'Xindi A': extra(6),
  'Xindi Bb': extra(6),
  'Soprano Suona': extra(7),
  'Alto Suona': extra(7),
  'Tenor Suona': extra(7),
  'Bass Suona': extra(7),
  'Suona C': extra(7),
  'Suona D': extra(7),
  'Suona Bb': extra(7),
  'Suona G': extra(7),
  'Suona A': extra(7),
  'Suona F': extra(7),
  'Guan G': guan,
  'Guan F': guan,
  'Guan A': guan,
  'Alto Guan': keyedGuan,
  'Bass Guan': keyedGuan,
  Liuqin: extra(10),
  Pipa: reference(3),
  Zhongruan: main(6),
  Daruan: main(6),
  Sanxian: extra(9),
  Guzheng: main(7),
  Yangqin: main(14),
  Gaohu: extra(15),
  Erhu: main(5),
  Zhonghu: main(5),
} satisfies Record<Instrument, Portrait>;

/** Decorative illustrations never determine ranges, written pitches or audio. */
export function InstrumentArtwork({ instrument, className = '' }: { instrument: Instrument; className?: string }) {
  const { sheet, cell } = portraits[instrument];
  const source = sourceRects[sheet][cell];
  const scale = 184 / Math.max(source[2], source[3]);
  const width = source[2] * scale;
  const height = source[3] * scale;
  return <svg viewBox="0 0 200 200" className={`instrument-artwork ${className}`} data-instrument-art={instrument}
    aria-hidden="true" focusable="false">
    {/* Match the crop's aspect ratio so letterboxing cannot reveal its neighbours. */}
    <svg x={(200 - width) / 2} y={(200 - height) / 2} width={width} height={height}
      viewBox={source.join(' ')} overflow="hidden">
      <image href={artworkSources[sheet]}
        x="0" y="0" width="1254" height="1254" />
    </svg>
  </svg>;
}
