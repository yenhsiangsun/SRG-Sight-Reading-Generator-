import type {PetCompanion} from './progress';
import type {CompanionStage} from './companionGrowth';

export interface GrowthAtlasRegion {
  file: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Authored bounds around the painted animal, not a cropped replacement file. */
  crop: readonly [number, number, number, number];
}

type ThreeCrops = readonly [GrowthAtlasRegion['crop'], GrowthAtlasRegion['crop'], GrowthAtlasRegion['crop']];
function forms(sheet: number, sourceWidth: number, sourceHeight: number, crops: ThreeCrops): Record<CompanionStage, GrowthAtlasRegion> {
  const region = (crop: GrowthAtlasRegion['crop']): GrowthAtlasRegion => ({file: `forest-growth-${sheet}.png`, sourceWidth, sourceHeight, crop});
  return {baby: region(crops[0]), young: region(crops[1]), adult: region(crops[2])};
}

/** Independently painted adult portraits keep both animals complete and separated. */
const cleanAdultSource = {file: 'forest-growth-adult-fixes.png', sourceWidth: 1536, sourceHeight: 1024};

/** Each animal has three separately painted ages. Source sheets remain unaltered. */
export const growthAtlasRegions: Record<PetCompanion | 'original', Record<CompanionStage, GrowthAtlasRegion>> = {
  original: forms(1, 887, 1774, [[76,107,125,194],[330,52,206,250],[621,8,236,292]]),
  'pet-celeste': forms(1, 887, 1774, [[63,403,166,186],[331,336,200,256],[608,299,248,294]]),
  'pet-musicfox': forms(1, 887, 1774, [[41,674,184,213],[322,618,212,267],[612,577,249,309]]),
  'pet-lily': forms(1, 887, 1774, [[45,983,181,197],[320,928,221,253],[595,881,260,301]]),
  'pet-moonrabbit': {...forms(1, 887, 1774, [[50,1281,191,179],[335,1227,213,234],[601,1175,275,287]]), adult: {...cleanAdultSource, crop: [1057,12,359,470]}},
  'pet-nocturne': {...forms(1, 887, 1774, [[46,1534,194,219],[321,1469,223,285],[612,1447,246,310]]), adult: {...cleanAdultSource, crop: [1043,479,363,532]}},
  'pet-bamboo': forms(2, 887, 1774, [[58,98,166,206],[316,39,231,271],[599,5,279,306]]),
  'pet-penguin': forms(2, 887, 1774, [[55,398,181,189],[312,343,228,245],[608,326,243,262]]),
  'pet-dragon': forms(2, 887, 1774, [[38,691,189,207],[279,614,260,285],[549,580,327,321]]),
  'pet-snowbird': forms(2, 887, 1774, [[42,1003,172,153],[270,962,250,193],[528,918,341,235]]),
  'pet-kiwi': forms(2, 887, 1774, [[52,1246,171,184],[318,1215,225,225],[592,1165,279,273]]),
  'pet-blackbear': forms(2, 887, 1774, [[41,1513,198,232],[298,1461,241,289],[591,1425,286,328]]),
  'pet-otter': forms(3, 887, 1774, [[44,107,173,186],[314,38,228,251],[640,12,226,277]]),
  'pet-kangaroo': forms(3, 887, 1774, [[51,415,164,190],[307,309,232,300],[580,287,258,321]]),
  'pet-lion': forms(3, 887, 1774, [[36,704,192,202],[333,642,185,265],[593,614,271,291]]),
  'pet-ragdoll': forms(3, 887, 1774, [[46,993,173,199],[304,952,240,238],[588,906,283,284]]),
  'pet-mainecoon': forms(3, 887, 1774, [[56,1289,169,218],[307,1219,217,287],[615,1194,259,314]]),
  'pet-calico': forms(3, 887, 1774, [[46,1568,176,194],[307,1522,203,240],[569,1505,274,257]]),
  'pet-orange': forms(4, 971, 1619, [[63,85,186,221],[355,28,213,279],[655,8,279,301]]),
  'pet-bluecat': forms(4, 971, 1619, [[59,394,217,226],[331,331,251,291],[659,313,284,309]]),
  'pet-husky': forms(4, 971, 1619, [[56,727,214,238],[324,634,258,332],[658,621,299,344]]),
  'pet-shiba': forms(4, 971, 1619, [[68,1038,202,243],[356,974,213,311],[674,963,256,322]]),
  'pet-poodle': forms(4, 971, 1619, [[89,1365,182,230],[366,1311,235,288],[666,1289,257,314]]),
};
