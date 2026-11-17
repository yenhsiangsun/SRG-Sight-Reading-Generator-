import type {Locale} from '../i18n/messages';
import {studyRecipeLabel} from '../practice/studyRecipe';
import './StudyRecipeBadge.css';

export default function StudyRecipeBadge({recipe,locale}:{recipe?:unknown;locale:Locale}){
  const label=studyRecipeLabel(recipe,locale);
  return label?<span className="study-recipe-badge">{label}</span>:null;
}
