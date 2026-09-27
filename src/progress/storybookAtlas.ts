import type {PetCompanion} from './progress';

/** Authored atlas regions, independent of reward ordering. Coordinates are in source pixels. */
export const storybookRegions: Record<PetCompanion | 'original', readonly [number, number, number, number]> = {
  original: [65, 65, 195, 240],
  'pet-celeste': [361, 65, 200, 242],
  'pet-musicfox': [679, 65, 240, 244],
  'pet-lily': [1014, 72, 195, 237],
  'pet-moonrabbit': [57, 373, 205, 234],
  'pet-nocturne': [376, 358, 181, 252],
  'pet-bamboo': [681, 367, 215, 244],
  'pet-penguin': [1003, 374, 207, 234],
  'pet-dragon': [39, 642, 230, 243],
  'pet-snowbird': [342, 683, 231, 200],
  'pet-kiwi': [680, 683, 233, 201],
  'pet-blackbear': [1004, 650, 210, 239],
  'pet-otter': [63, 934, 221, 250],
  'pet-kangaroo': [358, 923, 234, 267],
  'pet-lion': [680, 930, 230, 256],
  'pet-ragdoll': [984, 930, 235, 255],
};
