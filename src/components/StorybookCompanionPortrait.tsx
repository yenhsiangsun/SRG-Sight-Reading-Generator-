import type {PetCompanion} from '../progress/progress';
import {storybookRegions} from '../progress/storybookAtlas';

/** Real painted sprites, clipped in SVG without altering the original transparent image. */
export function StorybookCompanionPortrait({pet, id}: {pet: PetCompanion | null; id: string}) {
  const [x, y, width, height] = storybookRegions[pet ?? 'original'];
  const scale = Math.min(202 / width, 180 / height);
  return <g className="storybook-companion" data-storybook-pet={pet ?? 'original'}>
    <defs><clipPath id={`${id}-storybook-crop`}><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
    <g transform={`translate(${160 - width * scale / 2} ${190 - height * scale}) scale(${scale}) translate(${-x} ${-y})`}>
      <image href={`${import.meta.env.BASE_URL}companions/forest-storybook-v2.png`} width="1254" height="1254" clipPath={`url(#${id}-storybook-crop)`}/>
    </g>
  </g>;
}
