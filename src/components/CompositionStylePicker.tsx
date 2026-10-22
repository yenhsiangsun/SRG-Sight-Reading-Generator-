import {useI18n} from '../i18n/context';
import {words} from '../progress/words';
import type {CompositionStyle} from '../music/musicalIntent';
import type {ExerciseData} from '../music';

const styles=[
  {id:'auto',number:'✦',zh:'交給音樂',en:'A little surprise',ja:'音楽にまかせる',detail:['依調式選擇合適的樂曲性格','A character suited to the chosen mode','調に合う音楽の表情を']},
  {id:'classical',number:'I',zh:'古典問答',en:'Question & answer',ja:'問いと答え',detail:['清楚的動機，前句提問、後句回應','A motif, an open question, a closing answer','動機から、問い、そして答えへ']},
  {id:'lyrical',number:'II',zh:'歌唱抒情',en:'A singing line',ja:'歌う旋律',detail:['舒展長線，在呼吸之間走向高潮','A longer breath, a gentle rise and release','長い息づかいと、やさしい高まり']},
  {id:'pentatonic',number:'III',zh:'五聲敘事',en:'Five-tone story',ja:'五つの音の物語',detail:['核心音型、留白與不同的節奏能量','A small cell, space, and changing energy','小さな音型と余白、リズムの変化']},
] as const;
export function CompositionStylePicker({value,onChange,disabled=false}:{value?:CompositionStyle;onChange:(value:CompositionStyle)=>void;disabled?:boolean}){
  const {locale}=useI18n(),w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);
  return <fieldset className="composition-picker" disabled={disabled}>
    <legend>{w('樂曲性格','Musical character','曲の表情')}</legend>
    <p>{w('選一種今天想遇見的音樂。難度與節奏仍由你決定。','Choose the music you want to meet. Pitch and rhythm difficulty remain yours to set.','今日出会いたい音楽を選ぶ。音高とリズムの難度は別々に設定できます。')}</p>
    <div className="composition-choices">{styles.map(style=><button type="button" key={style.id} aria-pressed={value===style.id} onClick={()=>onChange(style.id)}>
      <span className="composition-roman" aria-hidden="true">{style.number}</span>
      <strong>{w(style.zh,style.en,style.ja)}</strong><small>{w(style.detail[0],style.detail[1],style.detail[2])}</small>
    </button>)}</div>
    <label className="composition-legacy"><input type="checkbox" checked={!value||value==='legacy'} onChange={e=>onChange(e.target.checked?'legacy':'auto')}/>{w('使用原有生成方式','Use the previous composer','これまでの生成方式を使う')}</label>
    <p className="composition-footnote">{w('混合拍號、變化音與專項練習沿用原有規則。','Mixed meters, chromatic and focused drills keep their established rules.','混合拍子・臨時記号・特別練習は従来の方式を使います。')}</p>
  </fieldset>;
}
export function MusicalIntentCaption({exercise}:{exercise:ExerciseData}){
  const {locale}=useI18n(),w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);
  const intent=exercise.musicalIntent;
  if(!intent)return null;
  const style=styles.find(s=>s.id===intent.grammar)!;
  return <aside className="musical-intent-caption" aria-label={w('這首樂曲的走向','The shape of this study','この曲の流れ')}>
    <div><span className="folio-eyebrow">{w('這一首的故事','A STORY IN NOTES','音でつづる物語')}</span><strong>{w(style.zh,style.en,style.ja)}</strong></div>
    <ol>{intent.phrases.map((phrase,index)=><li key={phrase.startBar}><span>{String(index+1).padStart(2,'0')}</span><b>{phrase.role==='opening'?w('起筆','Opening','はじまり'):phrase.role==='closing'?w('歸來','Homecoming','帰り道'):phrase.role==='answer'?w('回應','Response','こたえ'):w('展開','Development','ひろがり')}</b><small>{phrase.startBar+1}–{phrase.endBar+1}</small></li>)}</ol>
  </aside>;
}
