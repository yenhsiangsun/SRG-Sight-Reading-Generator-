import {useId} from 'react';
import type {PetCompanion} from '../progress/progress';
import {OriginalCompanion} from './OriginalCompanion';
import {WorldAnimalPortrait} from './WorldAnimalPortrait';
import './NoteCompanion.css';

function Eyes({y = 82, spacing = 23}: {y?: number; spacing?: number}) {
  return <g className="companion-eyes">
    {[160 - spacing, 160 + spacing].map(x => <g key={x}>
      <ellipse cx={x} cy={y + 1} rx="8.6" ry="10" fill="#fff0de" opacity=".65"/>
      <ellipse cx={x} cy={y} rx="7.4" ry="9" fill="#302e37"/>
      <path d={`M${x - 5} ${y + 3}q5 7 10 0q-3 11-10 0`} fill="#9f8071"/>
      <ellipse cx={x - 2.4} cy={y - 3} rx="2.6" ry="3" fill="#fffdf5"/>
      <circle cx={x + 3} cy={y + 3} r="1.3" fill="#fff0d1"/>
    </g>)}
  </g>;
}

/** The weight swings about the bottom pivot, clear of the animal's face. */
function Clockwork({id, dark = '#524335'}: {id: string; dark?: string}) {
  return <g>
    <path d="M149 119Q160 114 171 119L186 164Q188 171 180 172H140Q132 171 134 164Z" fill={dark}/>
    <path d="M146 133h28m-31 10h34m-37 10h40" stroke="#ead7b0" strokeWidth="1.3" opacity=".42"/>
    <path d="M160 124v39" stroke="#ead7b0" strokeWidth="1" opacity=".3"/>
    <g className="companion-clockwork">
      <path d="M160 165v-47" stroke="#efd5a0" strokeWidth="3" strokeLinecap="round"/>
      <rect x="154" y="130" width="12" height="10" rx="2.8" fill={`url(#${id}-brass)`} stroke="#fff0c5" strokeWidth=".7"/>
    </g>
    <circle cx="160" cy="165" r="5.5" fill={`url(#${id}-brass)`}/>
    <circle cx="160" cy="165" r="1.7" fill="#fff3cb"/>
  </g>;
}

function Fox({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <g className="companion-tail">
      <path d="M201 168C251 181 267 141 247 111C250 140 228 132 216 146Z" fill={`url(#${id}-fox)`} stroke="#ad5938" strokeWidth="2"/>
      <path d="M247 111C250 130 239 133 232 138L243 145C256 136 254 120 247 111Z" fill="#fff1da"/>
    </g>
    <ellipse cx="127" cy="183" rx="15" ry="6" fill="#724538"/>
    <ellipse cx="193" cy="183" rx="15" ry="6" fill="#724538"/>
    <path d="M111 78Q160 45 209 78L222 161Q226 182 203 183H117Q94 182 98 161Z" fill={`url(#${id}-fox)`} stroke="#ad5938" strokeWidth="2"/>
    <path d="M127 112Q160 97 193 112L206 167Q208 175 198 176H122Q112 175 114 167Z" fill="#fff0d7"/>
    <path d="M108 70Q93 38 106 18Q130 25 145 53M175 53Q190 25 214 18Q227 38 212 70" fill={`url(#${id}-fox)`} stroke="#ad5938" strokeWidth="2.2"/>
    <path d="M112 51Q104 34 109 29Q123 35 131 49M189 49Q197 35 211 29Q216 34 208 51" fill="#704437"/>
    <path d="M160 47C127 43 106 61 104 83L98 95L111 95C123 115 143 120 160 119C177 120 197 115 209 95L222 95L216 83C214 61 193 43 160 47Z" fill={`url(#${id}-fox)`} stroke="#ad5938" strokeWidth="2"/>
    <path d="M110 84Q132 80 160 102Q188 80 210 84C206 108 178 119 160 119C142 119 114 108 110 84Z" fill="#fff3df"/>
    <path d="M134 62l9-3M177 59l9 3" stroke="#ffe1b9" strokeWidth="3"/>
    <Eyes y={80} spacing={25}/>
    <ellipse cx="124" cy="94" rx="8" ry="4" fill="#e99a7d" opacity=".55"/>
    <ellipse cx="196" cy="94" rx="8" ry="4" fill="#e99a7d" opacity=".55"/>
    <path d="M154 99Q160 96 166 99Q167 103 160 107Q153 103 154 99Z" fill="#44322f"/>
    <path d="M160 106v3m-7 0q7 7 14 0" fill="none" stroke="#634039" strokeWidth="1.8"/>
    <Clockwork id={id}/>
    <path d="M106 126q-9 16-3 25M214 126q9 16 3 25" fill="none" stroke="#f5b477" strokeWidth="7"/>
  </g>;
}

function Lark({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d="M138 57Q130 27 150 19Q149 31 159 40Q159 16 177 19Q169 29 175 48" fill={`url(#${id}-bird)`} stroke="#55758a" strokeWidth="2"/>
    <path d="M122 167l-15 16 28-4m63-12 15 16-28-4" fill="#d2a065" stroke="#a87948" strokeWidth="2"/>
    <path d="M160 44C126 44 112 68 107 95L95 151C89 179 120 184 160 184C200 184 231 179 225 151L213 95C208 68 194 44 160 44Z" fill={`url(#${id}-bird)`} stroke="#55758a" strokeWidth="2"/>
    <path d="M126 91Q160 107 194 91L207 159Q209 177 160 178Q111 177 113 159Z" fill="#f5f0dd"/>
    <path d="M108 103C84 112 78 141 93 157C110 150 117 132 108 103Z" fill="#88b3c2" stroke="#55758a" strokeWidth="2"/>
    <path d="M212 103C236 112 242 141 227 157C210 150 203 132 212 103Z" fill="#88b3c2" stroke="#55758a" strokeWidth="2"/>
    <path d="M98 124q-4 10-3 17m7-9-2 10M222 124q4 10 3 17m-7-9 2 10" fill="none" stroke="#c8e0df" strokeWidth="2"/>
    <Eyes y={80} spacing={23}/>
    <ellipse cx="124" cy="94" rx="8" ry="4" fill="#e6b3a0" opacity=".7"/>
    <ellipse cx="196" cy="94" rx="8" ry="4" fill="#e6b3a0" opacity=".7"/>
    <path d="M148 94Q160 84 172 94L160 105Z" fill="#e6b269" stroke="#b98649" strokeWidth="1.4"/>
    <path d="M148 94h24" stroke="#b98649" strokeWidth="1.2"/>
    <Clockwork id={id} dark="#3c5e6c"/>
  </g>;
}

function Raccoon({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <defs><clipPath id={`${id}-tail-clip`}><path d="M206 167C248 176 271 144 251 122C253 145 224 135 211 149Z"/></clipPath></defs>
    <path d="M206 167C248 176 271 144 251 122C253 145 224 135 211 149Z" fill="#a6a4b7" stroke="#6c687f" strokeWidth="2"/>
    <path d="M226 141l12 23m4-29 11 16" stroke="#5f6075" strokeWidth="10" clipPath={`url(#${id}-tail-clip)`}/>
    <ellipse cx="127" cy="183" rx="15" ry="6" fill="#55566d"/>
    <ellipse cx="193" cy="183" rx="15" ry="6" fill="#55566d"/>
    <path d="M114 80Q160 55 206 80L225 158Q231 183 201 184H119Q89 183 95 158Z" fill={`url(#${id}-raccoon)`} stroke="#6c687f" strokeWidth="2"/>
    <path d="M132 111Q160 101 188 111L202 166Q205 176 192 177H128Q115 176 118 166Z" fill="#f3e9e2"/>
    <circle cx="118" cy="49" r="23" fill="#9293aa" stroke="#6c687f" strokeWidth="2"/>
    <circle cx="202" cy="49" r="23" fill="#9293aa" stroke="#6c687f" strokeWidth="2"/>
    <circle cx="118" cy="49" r="13" fill="#d7bec3"/>
    <circle cx="202" cy="49" r="13" fill="#d7bec3"/>
    <path d="M160 45C124 43 103 61 101 84L95 96L108 95C124 118 145 120 160 118C175 120 196 118 212 95L225 96L219 84C217 61 196 43 160 45Z" fill={`url(#${id}-raccoon)`} stroke="#6c687f" strokeWidth="2"/>
    <path d="M114 76Q132 62 156 82Q160 86 164 82Q188 62 206 76L201 91Q186 104 163 94Q160 92 157 94Q134 104 119 91Z" fill="#545569"/>
    <path d="M155 51h10l5 23-10 12-10-12Z" fill="#e8e2e3"/>
    <Eyes y={82} spacing={25}/>
    <path d="M137 100Q160 85 183 100Q181 115 160 118Q139 115 137 100Z" fill="#f7ece3"/>
    <path d="M154 99Q160 95 166 99Q167 103 160 106Q153 103 154 99Z" fill="#424152"/>
    <path d="M153 109q7 7 14 0" fill="none" stroke="#6c5e67" strokeWidth="1.8"/>
    <Clockwork id={id} dark="#555369"/>
    <path d="M106 128q-7 14-3 24M214 128q7 14 3 24" fill="none" stroke="#cfbfce" strokeWidth="7"/>
  </g>;
}

function Rabbit({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <circle cx="216" cy="161" r="17" fill="#fff2e8" stroke="#c6a99e" strokeWidth="2"/>
    <path d="M121 68C94 26 113 6 123 15C137 29 139 48 139 63M178 63C180 43 184 9 199 11C218 17 201 56 197 68" fill={`url(#${id}-rabbit)`} stroke="#bba296" strokeWidth="2"/>
    <path d="M123 53Q112 28 120 23Q128 33 130 52M187 51Q190 25 197 23Q201 31 193 53" fill="none" stroke="#dfb0b0" strokeWidth="8"/>
    <ellipse cx="128" cy="182" rx="17" ry="7" fill="#dbc1b8"/><ellipse cx="192" cy="182" rx="17" ry="7" fill="#dbc1b8"/>
    <path d="M119 91Q160 69 201 91L220 158Q226 183 201 183H119Q94 183 100 158Z" fill={`url(#${id}-rabbit)`} stroke="#bba296" strokeWidth="2"/>
    <path d="M132 114H188L204 167Q205 176 194 177H126Q115 176 116 167Z" fill="#f2d5d2"/>
    <path d="M160 53C124 53 104 68 106 90C107 112 129 121 160 117C191 121 213 112 214 90C216 68 196 53 160 53Z" fill={`url(#${id}-rabbit)`} stroke="#bba296" strokeWidth="2"/>
    <Eyes y={84}/><ellipse cx="124" cy="98" rx="8" ry="4" fill="#e5aeac" opacity=".65"/><ellipse cx="196" cy="98" rx="8" ry="4" fill="#e5aeac" opacity=".65"/>
    <path d="M155 99Q160 95 165 99L160 104Z" fill="#bf838c"/><path d="M160 104v3m-6 1q6 6 12 0" fill="none" stroke="#98726e" strokeWidth="1.8"/>
    <Clockwork id={id} dark="#927777"/>
    <path d="M107 132q-6 12-2 21M213 132q6 12 2 21" fill="none" stroke="#f9e7dc" strokeWidth="9"/>
  </g>;
}

function Cat({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path className="companion-tail" d="M212 168C257 178 260 141 243 141C234 141 234 151 240 153" fill="none" stroke="#424e6a" strokeWidth="15"/>
    <ellipse cx="129" cy="183" rx="15" ry="6" fill="#303a52"/><ellipse cx="191" cy="183" rx="15" ry="6" fill="#303a52"/>
    <path d="M118 91Q160 71 202 91L219 160Q224 183 202 183H118Q96 183 101 160Z" fill={`url(#${id}-cat)`} stroke="#354157" strokeWidth="2"/>
    <path d="M133 113Q160 104 187 113L202 166Q205 176 193 176H127Q115 176 118 166Z" fill="#a4aec6"/>
    <path d="M109 70Q104 42 110 27Q128 29 145 49Q160 44 175 49Q192 29 210 27Q216 42 211 70C230 113 198 119 160 117C122 119 90 113 109 70Z" fill={`url(#${id}-cat)`} stroke="#354157" strokeWidth="2"/>
    <path d="M116 54l1-16 16 15M187 53l16-15 1 16" fill="#bb9dab"/>
    <path d="M142 53l10 13 8-11 8 11 10-13M111 74l14 5m-15 6 13 5m73-11 14-5m-13 16 13-5" fill="none" stroke="#59626e" strokeWidth="4"/>
    <path d="M106 143l14 4m-13 7 15 3m77-10 14-4m-15 14 14-3" stroke="#59626e" strokeWidth="4"/>
    <path d="M130 95Q144 87 160 99Q176 87 190 95Q191 116 160 115Q129 116 130 95Z" fill="#f3f0e9"/>
    <g className="companion-eyes">{[136,184].map(x=><g key={x}>
      <ellipse cx={x} cy="83" rx="11" ry="12.5" fill="#ffebba"/>
      <ellipse cx={x} cy="83" rx="9.5" ry="11.5" fill="#d7ae69"/>
      <ellipse cx={x} cy="81.5" rx="6.5" ry="9" fill="#293044"/>
      <ellipse cx={x-3} cy="78" rx="3" ry="3.4" fill="#fffdf2"/>
      <circle cx={x+3.5} cy="86" r="1.5" fill="#fff3d4"/>
    </g>)}</g>
    <ellipse cx="118" cy="98" rx="8" ry="4" fill="#e4b9b5" opacity=".6"/><ellipse cx="202" cy="98" rx="8" ry="4" fill="#e4b9b5" opacity=".6"/>
    <path d="M155 98h10l-5 6Z" fill="#d2a9b5"/><path d="M160 104v3m-7 0q3 6 7 1q4 5 7-1M112 99l16 2m-17 5 16-1m65-4 16-2m-15 6 16 1" fill="none" stroke="#535b65" strokeWidth="1.5"/>
    <Clockwork id={id} dark="#35415a"/>
    <path d="M107 132q-6 12-2 21M213 132q6 12 2 21" fill="none" stroke="#7c8da9" strokeWidth="7"/>
  </g>;
}

function Panda({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <ellipse cx="124" cy="181" rx="20" ry="9" fill="#3e4c49"/><ellipse cx="196" cy="181" rx="20" ry="9" fill="#3e4c49"/>
    <path d="M117 94Q160 73 203 94L224 156Q233 184 201 184H119Q87 184 96 156Z" fill={`url(#${id}-panda)`} stroke="#959e91" strokeWidth="2"/>
    <path d="M130 112Q160 105 190 112L205 165Q209 177 196 178H124Q111 177 115 165Z" fill="#b9cbb0"/>
    <circle cx="117" cy="49" r="23" fill="#414e4a"/><circle cx="203" cy="49" r="23" fill="#414e4a"/>
    <ellipse cx="160" cy="82" rx="59" ry="39" fill={`url(#${id}-panda)`} stroke="#959e91" strokeWidth="2"/>
    <ellipse cx="136" cy="83" rx="14" ry="18" transform="rotate(24 136 83)" fill="#4f5b56"/><ellipse cx="184" cy="83" rx="14" ry="18" transform="rotate(-24 184 83)" fill="#4f5b56"/>
    <Eyes y={84} spacing={24}/>
    <ellipse cx="122" cy="103" rx="7" ry="3" fill="#e1b3a0"/><ellipse cx="198" cy="103" rx="7" ry="3" fill="#e1b3a0"/>
    <path d="M154 98Q160 95 166 98Q167 102 160 105Q153 102 154 98Z" fill="#3d4944"/><path d="M153 109q7 5 14 0" fill="none" stroke="#6a786b" strokeWidth="1.8"/>
    <Clockwork id={id} dark="#466457"/>
    <path d="M104 128q-9 11-2 24M216 128q9 11 2 24" fill="none" stroke="#46564d" strokeWidth="13"/>
    <path d="M209 59q-4-18 13-23q-1 13-13 23m0 0q8-10 17-5q-5 9-17 5" fill="#91ad78" stroke="#6b8a58" strokeWidth="1"/>
  </g>;
}

function Penguin({id}: {id: string}) {
  return <g strokeLinejoin="round" strokeLinecap="round">
    <path d="M120 177l-17 11q19 8 40 0l-7-13m48 0-7 13q21 8 40 0l-17-11" fill="#dba063" stroke="#ae794c" strokeWidth="1.5"/>
    <path d="M160 36C123 36 114 71 108 106L94 153C88 180 116 185 160 185C204 185 232 180 226 153L212 106C206 71 197 36 160 36Z" fill={`url(#${id}-penguin)`} stroke="#3a5363" strokeWidth="2"/>
    <path d="M160 65C143 42 121 67 124 95Q124 107 131 113L113 156Q103 179 160 179Q217 179 207 156L189 113Q196 107 196 95C199 67 177 42 160 65Z" fill="#f6f1e2"/>
    <Eyes y={84}/><path d="M149 99q11-10 22 0l-11 7Z" fill="#4e6571" stroke="#344e5e" strokeWidth="1"/>
    <ellipse cx="128" cy="100" rx="7" ry="4" fill="#ecb6b0" opacity=".7"/><ellipse cx="192" cy="100" rx="7" ry="4" fill="#ecb6b0" opacity=".7"/>
    <g transform="translate(0 8) scale(1 .955)"><Clockwork id={id} dark="#3b5e70"/></g>
    <path d="M108 110C86 119 78 143 87 153Q105 144 108 110M212 110C234 119 242 143 233 153Q215 144 212 110" fill="#527a91" stroke="#3a5363" strokeWidth="2"/>
  </g>;
}

const petArt: Record<PetCompanion, (props: {id: string}) => React.JSX.Element> = {
  'pet-celeste': Lark, 'pet-musicfox': Fox, 'pet-lily': Raccoon,
  'pet-moonrabbit': Rabbit, 'pet-nocturne': Cat, 'pet-bamboo': Panda, 'pet-penguin': Penguin,
  'pet-dragon': ({id})=><WorldAnimalPortrait kind="dragon"><Clockwork id={id} dark="#783b37"/></WorldAnimalPortrait>,
  'pet-snowbird': ({id})=><WorldAnimalPortrait kind="snowbird"><Clockwork id={id} dark="#8797a8"/></WorldAnimalPortrait>,
  'pet-kiwi': ({id})=><WorldAnimalPortrait kind="kiwi"><Clockwork id={id} dark="#76593f"/></WorldAnimalPortrait>,
  'pet-blackbear': ({id})=><WorldAnimalPortrait kind="blackbear"><Clockwork id={id} dark="#202e38"/></WorldAnimalPortrait>,
  'pet-otter': ({id})=><WorldAnimalPortrait kind="otter"><Clockwork id={id} dark="#7c5e49"/></WorldAnimalPortrait>,
  'pet-kangaroo': ({id})=><WorldAnimalPortrait kind="kangaroo"><Clockwork id={id} dark="#97704e"/></WorldAnimalPortrait>,
  'pet-lion': ({id})=><WorldAnimalPortrait kind="lion"><Clockwork id={id} dark="#985f37"/></WorldAnimalPortrait>,
};

/** One source for the equipped companion, store cards, and free previews. */
export function CompanionPortrait({pet = null, className = '', animated = false, closeUp = false}: {
  pet?: PetCompanion | null; className?: string; animated?: boolean; closeUp?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const Artwork = pet === null ? OriginalCompanion : petArt[pet];
  return <svg viewBox={closeUp ? '45 -8 240 216' : '0 0 320 208'} className={`companion-portrait ${className}${animated ? ' companion-portrait--animated' : ''}`} aria-hidden="true" focusable="false" data-pet={pet ?? 'original'}>
    <defs>
      <linearGradient id={`${id}-body`} x1=".15" y1="0" x2=".85" y2="1"><stop stopColor="#adc5a8"/><stop offset=".43" stopColor="#789777"/><stop offset="1" stopColor="#486a53"/></linearGradient>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#fff8df"/><stop offset="1" stopColor="#ede1bc"/></linearGradient>
      <linearGradient id={`${id}-brass`} x2="1" y2="1"><stop stopColor="#f5d895"/><stop offset=".5" stopColor="#c59b55"/><stop offset="1" stopColor="#9b743d"/></linearGradient>
      <linearGradient id={`${id}-fox`} x2=".6" y2="1"><stop stopColor="#f5bd80"/><stop offset=".48" stopColor="#e89256"/><stop offset="1" stopColor="#c97145"/></linearGradient>
      <linearGradient id={`${id}-bird`} x2=".7" y2="1"><stop stopColor="#b9d9de"/><stop offset=".5" stopColor="#86b3c3"/><stop offset="1" stopColor="#658d9f"/></linearGradient>
      <linearGradient id={`${id}-raccoon`} x2=".8" y2="1"><stop stopColor="#d6cfdc"/><stop offset=".5" stopColor="#ada6bf"/><stop offset="1" stopColor="#8b87a4"/></linearGradient>
      <linearGradient id={`${id}-rabbit`} x2=".7" y2="1"><stop stopColor="#fff9ef"/><stop offset="1" stopColor="#ebd5ca"/></linearGradient>
      <linearGradient id={`${id}-cat`} x2=".8" y2="1"><stop stopColor="#edf0f1"/><stop offset=".55" stopColor="#bdc5cb"/><stop offset="1" stopColor="#909da8"/></linearGradient>
      <linearGradient id={`${id}-panda`} x2=".7" y2="1"><stop stopColor="#fffcf0"/><stop offset="1" stopColor="#dedfce"/></linearGradient>
      <linearGradient id={`${id}-penguin`} x2=".8" y2="1"><stop stopColor="#82c1dc"/><stop offset=".6" stopColor="#4986af"/><stop offset="1" stopColor="#32628a"/></linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#334a33" stopOpacity=".18"/><stop offset="1" stopColor="#334a33" stopOpacity="0"/></radialGradient>
    </defs>
    <ellipse cx="160" cy="191" rx="73" ry="9" fill={`url(#${id}-shadow)`}/>
    <g className="note-companion__character">
      <Artwork id={id}/>
    </g>
  </svg>;
}
