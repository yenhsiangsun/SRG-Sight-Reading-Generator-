import type {PetCompanion} from '../progress/progress';
import type {CompanionStage} from '../progress/companionGrowth';
import {growthAtlasRegions} from '../progress/growthAtlas';

/** Real painted sprites, clipped in SVG without altering the original transparent image. */
export function StorybookCompanionPortrait({pet, id, stage = 'baby'}: {pet: PetCompanion | null; id: string; stage?: CompanionStage}) {
  const region = growthAtlasRegions[pet ?? 'original'][stage];
  const [x, y, width, height] = region.crop;
  const portraitHeight = stage === 'baby' ? 166 : stage === 'young' ? 175 : 184;
  const scale = Math.min(202 / width, portraitHeight / height);
  const cropId = `${id}-storybook-${stage}-crop`;
  return <g className="storybook-companion" data-storybook-pet={pet ?? 'original'} data-storybook-stage={stage}>
    <defs><clipPath id={cropId}><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
    <g transform={`translate(${160 - width * scale / 2} ${190 - height * scale}) scale(${scale}) translate(${-x} ${-y})`}>
      <image href={`${import.meta.env.BASE_URL}companions/${region.file}`} width={region.sourceWidth} height={region.sourceHeight} clipPath={`url(#${cropId})`}/>
    </g>
  </g>;
}
