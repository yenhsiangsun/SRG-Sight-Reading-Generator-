import {useId, type ReactNode} from 'react';
import {BabyDragonPortrait} from './BabyDragonPortrait';

export type WorldAnimal = 'dragon'|'snowbird'|'kiwi'|'blackbear'|'otter'|'kangaroo'|'lion';
function Face({y=83,nose=true}:{y?:number;nose?:boolean}) {
  return <g>
    <g className="companion-eyes">{[137,183].map(x=><g key={x}>
      <ellipse cx={x} cy={y+1} rx="9.2" ry="10.5" fill="#fff4e4" opacity=".65"/>
      <ellipse cx={x} cy={y} rx="8" ry="9.5" fill="#302b32"/>
      <path d={`M${x-5} ${y+4}q5 7 10 0q-2 11-10 0`} fill="#a2836e"/>
      <ellipse cx={x-2.5} cy={y-3} rx="2.8" ry="3.2" fill="#fffdf7"/>
      <circle cx={x+3} cy={y+3} r="1.3" fill="#fff1d7"/>
    </g>)}</g>
    <ellipse cx="120" cy={y+13} rx="10" ry="5" fill="#edacaa" opacity=".53"/><ellipse cx="200" cy={y+13} rx="10" ry="5" fill="#edacaa" opacity=".53"/>
    {nose&&<><path d={`M155 ${y+14}q5-3 10 0q1 3-5 6-6-3-5-6Z`} fill="#453732"/>
      <ellipse cx="158" cy={y+14} rx="2" ry=".8" fill="#ab8d83"/>
      <path d={`M160 ${y+20}v2m-7 0q3 6 7 1 4 5 7-1`} stroke="#604a40" strokeWidth="1.7" fill="none"/></>}
  </g>;
}
function Feet({fill}:{fill:string}) {return <g fill={fill}>{[126,194].map(x=><g key={x}>
  <ellipse cx={x} cy="181" rx="19" ry="10"/>
  <path d={`M${x-6} 178v3m6-4v3m6-2v3`} stroke="#fff0d6" strokeWidth="1.8" opacity=".35"/>
</g>)}</g>;}

const FUR: Record<WorldAnimal, [string, string, string]> = {
  dragon: ['#f08072','#d94849','#9f303f'],
  snowbird: ['#ffffff','#fcfcf7','#dce4eb'],
  kiwi: ['#ddbb8b','#b38a61','#8c684b'],
  blackbear: ['#74848e','#465864','#2d3b48'],
  otter: ['#e6c49e','#c2966e','#95684e'],
  kangaroo: ['#f5d3a9','#dfb183','#b78058'],
  lion: ['#ffe3a1','#ecc270','#cc944b'],
};

/** Each silhouette is drawn independently; the visible pendulum is shared. */
export function WorldAnimalPortrait({kind,children}:{kind:WorldAnimal;children:ReactNode}) {
  const id = `animal-${useId().replace(/:/g, '')}`;
  const fur = `url(#${id}-fur)`;
  return <g strokeLinecap="round" strokeLinejoin="round" data-animal={kind}>
    <defs><radialGradient id={`${id}-fur`} cx="35%" cy="18%" r="86%">
      <stop stopColor={FUR[kind][0]}/><stop offset=".6" stopColor={FUR[kind][1]}/><stop offset="1" stopColor={FUR[kind][2]}/>
    </radialGradient></defs>
    {kind==='dragon'&&<BabyDragonPortrait>{children}</BabyDragonPortrait>}
    {kind==='snowbird'&&<>
      <path className="companion-tail" d="M203 165l55 20-38-43Z" fill="#696b79" stroke="#454d60" strokeWidth="2"/>
      <Feet fill="#737385"/>
      <path d="M160 36C122 30 91 64 97 106Q80 117 94 132Q84 144 98 157Q99 184 160 186Q221 184 222 157Q236 144 226 132Q240 117 223 106C229 64 198 30 160 36Z" fill={fur} stroke="#b5c1cc" strokeWidth="1.7"/>
      <path d="M104 113q-21 17-9 39 14-3 23-25M216 113q21 17 9 39-14-3-23-25" fill="#dbd9d5" stroke="#a8a9b2" strokeWidth="1.7"/>
      <path d="M99 125l12 17m110-17-12 17" stroke="#696b79" strokeWidth="6"/>
      <path d="M145 43q-9-12 3-17m8 15q0-12 9-15" fill="none" stroke="#d9e1e5" strokeWidth="3"/>
      <path d="M119 62q8-9 17-10m49 0q10 2 16 10" fill="none" stroke="white" strokeWidth="5"/>
      <Face y={84} nose={false}/><path d="M155 99q5-5 10 0l-5 6Z" fill="#424753"/>
      <ellipse cx="160" cy="150" rx="37" ry="33" fill="#f1f3f3"/>{children}
    </>}
    {kind==='kiwi'&&<>
      <path d="M126 174v13l-12 4m12-4 9 4m59-17v13l12 4m-12-4-9 4" fill="none" stroke="#826147" strokeWidth="5"/>
      <path d="M159 40C116 31 98 67 102 96Q84 114 91 151Q98 185 158 184Q222 185 229 147Q230 106 210 96C216 61 191 35 159 40Z" fill={fur} stroke="#826348" strokeWidth="1.8"/>
      <path d="M105 117q6-18 16-17m85 17q-6-18-16-17" stroke="#d3b68d" fill="none" strokeWidth="5"/>
      {[111,123,197,209].map((x,i)=><path key={x} d={`M${x} ${132+i%2*12}l3 11m-1 7 3 9`} stroke="#795d43" strokeWidth="2"/>)}
      <ellipse cx="160" cy="85" rx="47" ry="35" fill="#ddbc90" opacity=".65"/>
      <path d="M141 48q-5-11 4-15m5 13q0-8 7-10" fill="none" stroke="#e1c394" strokeWidth="3"/>
      <Face y={79} nose={false}/>
      <path d="M156 91Q178 86 219 103L247 116Q207 111 163 102Z" fill="#ead1a3" stroke="#aa865d" strokeWidth="1.5"/>
      <ellipse cx="160" cy="148" rx="37" ry="33" fill="#dcc49e"/>{children}
    </>}
    {kind==='blackbear'&&<>
      <Feet fill="#29343d"/><circle cx="118" cy="49" r="23" fill="#33414b"/><circle cx="202" cy="49" r="23" fill="#33414b"/>
      <circle cx="118" cy="49" r="12" fill="#7d7778"/><circle cx="202" cy="49" r="12" fill="#7d7778"/>
      <path d="M119 99Q160 78 201 99C215 119 227 149 220 169Q216 186 196 184H124Q104 186 100 169C93 149 105 119 119 99Z" fill={fur} stroke="#24313b" strokeWidth="2"/>
      <ellipse cx="160" cy="79" rx="61" ry="44" fill={fur} stroke="#263843" strokeWidth="2"/>
      <path d="M115 62q7-11 20-14" fill="none" stroke="#a1adb2" strokeWidth="3" opacity=".5"/>
      <ellipse cx="160" cy="101" rx="27" ry="19" fill="#e4ceb0"/><Face y={79}/>
      <path d="M122 112l38 14 38-14-14 22-24 10-24-10Z" fill="#fff4da"/>
      <g transform="translate(0 10) scale(1 .95)">{children}</g>
      <path d="M106 138l-5 22m113-22 5 22" stroke="#64747b" strokeWidth="10"/>
    </>}
    {kind==='otter'&&<>
      <path className="companion-tail" d="M203 169q45-5 56 16-36 13-60-2Z" fill="#9e7354" stroke="#725039" strokeWidth="2"/>
      <Feet fill="#8c6249"/><path d="M125 102Q160 87 195 102C207 117 219 148 215 164Q212 186 191 184H129Q108 186 105 164C101 148 113 117 125 102Z" fill={fur} stroke="#805c43" strokeWidth="2"/>
      <circle cx="114" cy="66" r="16" fill="#b98960" stroke="#805c43" strokeWidth="2"/><circle cx="206" cy="66" r="16" fill="#b98960" stroke="#805c43" strokeWidth="2"/>
      <circle cx="114" cy="66" r="8" fill="#e2b3a0"/><circle cx="206" cy="66" r="8" fill="#e2b3a0"/>
      <ellipse cx="160" cy="79" rx="60" ry="42" fill={fur} stroke="#805c43" strokeWidth="1.8"/>
      <path d="M125 58q10-11 25-12" fill="none" stroke="#f8deba" strokeWidth="4" opacity=".6"/>
      <path d="M129 92Q143 85 160 97Q177 85 191 92C201 115 176 120 160 119C144 120 119 115 129 92Z" fill="#f9e8cb"/><Face y={80}/>
      <path d="M112 97l19 4m-21 3 21 2m57-5 20-4m-20 9 22-2" stroke="#765b45" strokeWidth="1.5"/>
      <ellipse cx="160" cy="147" rx="38" ry="33" fill="#efdbb7"/>{children}
      <ellipse cx="126" cy="141" rx="12" ry="16" fill="#d7ab81" transform="rotate(-32 126 141)"/><ellipse cx="194" cy="141" rx="12" ry="16" fill="#d7ab81" transform="rotate(32 194 141)"/>
      <path d="M121 142l7-2m-5 6 7-2m69-2-7-2m5 6-7-2" stroke="#9e775a" strokeWidth="1.5"/>
    </>}
    {kind==='kangaroo'&&<>
      <path className="companion-tail" d="M198 149Q230 171 265 178Q256 194 200 183Z" fill="#c79266" stroke="#966442" strokeWidth="2"/>
      <path d="M126 64Q98 13 115 9Q138 19 142 59M178 59Q182 19 205 9Q222 13 194 64" fill="#d6a275" stroke="#966442" strokeWidth="2"/>
      <path d="M124 27l10 26m62-26-10 26" stroke="#eec6b4" strokeWidth="7"/>
      <path d="M126 101Q160 79 194 101L210 144Q230 173 207 182H113Q90 173 110 144Z" fill={fur} stroke="#966442" strokeWidth="2"/>
      <ellipse cx="160" cy="83" rx="53" ry="39" fill={fur} stroke="#966442" strokeWidth="1.8"/><ellipse cx="160" cy="106" rx="28" ry="18" fill="#fce8cb"/><Face y={79}/>
      <path d="M125 126Q160 141 195 126L201 164Q160 192 119 164Z" fill="#f1d4ab" stroke="#b98860" strokeWidth="2"/>{children}
      <path d="M115 125q-4 16 10 19m80-19q4 16-10 19" fill="none" stroke="#d49e73" strokeWidth="13"/>
      <ellipse cx="114" cy="182" rx="24" ry="9" fill="#b68158"/><ellipse cx="206" cy="182" rx="24" ry="9" fill="#b68158"/>
    </>}
    {kind==='lion'&&<>
      <path className="companion-tail" d="M210 168q38 10 34-35" fill="none" stroke="#cc964f" strokeWidth="8"/><path d="M243 143q-18-17 4-24 15 14-4 24" fill="#9f593a"/>
      <Feet fill="#b88042"/>
      <path d="M122 100Q160 82 198 100C211 121 224 155 215 174Q211 185 194 184H126Q109 185 105 174C96 155 109 121 122 100Z" fill={fur} stroke="#ab743d" strokeWidth="2"/>
      <path d="M160 28Q181 22 193 40Q218 38 221 61Q242 76 225 96Q228 119 205 123Q189 140 170 128Q150 143 133 128Q105 133 102 110Q79 103 93 80Q85 55 108 49Q112 25 136 35Q150 22 160 28Z" fill="#b87742" stroke="#8d5537" strokeWidth="2"/>
      <circle cx="125" cy="58" r="16" fill="#e8bc70"/><circle cx="195" cy="58" r="16" fill="#e8bc70"/>
      <circle cx="125" cy="58" r="8" fill="#d69978"/><circle cx="195" cy="58" r="8" fill="#d69978"/>
      <ellipse cx="160" cy="82" rx="50" ry="40" fill={fur}/>
      <path d="M145 48q0-8 5-12m2 9q5-7 10-7" fill="none" stroke="#f9d794" strokeWidth="5"/>
      <ellipse cx="148" cy="103" rx="18" ry="14" fill="#fff2d7"/><ellipse cx="172" cy="103" rx="18" ry="14" fill="#fff2d7"/><Face y={80}/>
      <path d="M126 127Q160 137 194 127L203 173H117Z" fill="#f4dba5"/>{children}
      <ellipse cx="112" cy="156" rx="13" ry="17" fill="#eabe73"/><ellipse cx="208" cy="156" rx="13" ry="17" fill="#eabe73"/>
    </>}
  </g>;
}
