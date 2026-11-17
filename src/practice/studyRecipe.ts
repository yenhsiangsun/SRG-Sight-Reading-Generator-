import type {PluckedRecipe} from '../music/automaticPlucked';
import type {Locale} from '../i18n/messages';

const kinds={'A':2,'B-melody':0,'B-rhythm':1,'B-combined':2} as const;
export function readStudyRecipe(value:unknown):PluckedRecipe|undefined{
  return typeof value==='string'&&Object.hasOwn(kinds,value)?value as PluckedRecipe:undefined;
}
const names:Record<Locale,readonly [string,string,string]>={
  'zh-TW':['旋律題','節奏題','綜合題'],'zh-CN':['旋律题','节奏题','综合题'],
  en:['Melody','Rhythm','Combined'],ja:['旋律課題','リズム課題','総合課題'],
  es:['Melodía','Ritmo','Mixto'],de:['Melodie','Rhythmus','Kombiniert'],
  fr:['Mélodie','Rythme','Combiné'],ko:['선율','리듬','종합'],
  th:['ทำนอง','จังหวะ','ผสม'],'pt-BR':['Melodia','Ritmo','Combinado'],
  ru:['Мелодия','Ритм','Комплекс'],it:['Melodia','Ritmo','Combinato'],
};
/** A keeps its original balanced melody/rhythm approach. B names its actual
 * pre-composition priority; a missing legacy tag is never inferred from notes. */
export function studyRecipeLabel(value:unknown,locale:Locale):string|undefined{
  const recipe=readStudyRecipe(value);if(!recipe)return undefined;
  return `${recipe==='A'?'A':'B'} · ${names[locale][kinds[recipe]]}`;
}
