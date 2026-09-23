import {useId, type ReactNode} from 'react';

/** An original twilight hatchling: warm amber eyes, ivory horns and moon markings. */
export function BabyDragonPortrait({children}: {children: ReactNode}) {
  const id = `hatchling-${useId().replace(/:/g, '')}`;
  return <g strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <radialGradient id={`${id}-skin`} cx="35%" cy="20%" r="85%">
        <stop stopColor="#f08072"/><stop offset=".5" stopColor="#d94849"/><stop offset="1" stopColor="#9f303f"/>
      </radialGradient>
      <linearGradient id={`${id}-body`} x2=".8" y2="1">
        <stop stopColor="#e6655b"/><stop offset="1" stopColor="#9c2c3a"/>
      </linearGradient>
      <linearGradient id={`${id}-wing`} x2=".3" y2="1">
        <stop stopColor="#ffd0af"/><stop offset="1" stopColor="#e98072"/>
      </linearGradient>
      <linearGradient id={`${id}-belly`} x2=".3" y2="1">
        <stop stopColor="#fff0d8"/><stop offset="1" stopColor="#efba99"/>
      </linearGradient>
      <linearGradient id={`${id}-iris`} x2="0" y2="1">
        <stop stopColor="#ad744b"/><stop offset=".6" stopColor="#e8b86b"/><stop offset="1" stopColor="#ffe4a5"/>
      </linearGradient>
    </defs>

    <g className="companion-tail">
      <path d="M195 162C218 163 244 175 248 155Q252 144 244 136C266 146 266 173 247 181Q218 195 194 178Z" fill={`url(#${id}-body)`} stroke="#8d2e39" strokeWidth="2"/>
      <path d="M245 139C231 137 234 123 242 125C242 114 255 118 255 128Q256 137 245 139Z" fill="#f4ac93" stroke="#bc635b" strokeWidth="1.5"/>
      <path d="M220 175q16 5 23-3" fill="none" stroke="#f7a18c" strokeWidth="3" opacity=".65"/>
    </g>

    <g className="companion-dragon-wing companion-dragon-wing--left">
      <path d="M114 107C99 78 83 67 75 72Q71 74 74 83C58 87 65 111 75 126Q78 111 90 123Q95 115 110 132Z" fill={`url(#${id}-wing)`} stroke="#b55552" strokeWidth="2.5"/>
      <path d="M77 80q20 17 29 40M82 91q-8 10-7 24m7-24q3 14 8 23" fill="none" stroke="#ffdfc5" strokeWidth="2"/>
    </g>
    <g className="companion-dragon-wing companion-dragon-wing--right">
      <path d="M206 107C221 78 237 67 245 72Q249 74 246 83C262 87 255 111 245 126Q242 111 230 123Q225 115 210 132Z" fill={`url(#${id}-wing)`} stroke="#b55552" strokeWidth="2.5"/>
      <path d="M243 80q-20 17-29 40m24-29q8 10 7 24m-7-24q-3 14-8 23" fill="none" stroke="#ffdfc5" strokeWidth="2"/>
    </g>

    <path d="M124 102Q160 89 196 102C204 115 215 143 212 163Q210 185 186 185H134Q110 185 108 163C105 143 116 115 124 102Z" fill={`url(#${id}-body)`} stroke="#8d2e39" strokeWidth="2"/>
    <ellipse cx="160" cy="146" rx="35" ry="37" fill={`url(#${id}-belly)`}/>
    <path d="M145 175q15 6 30 0" fill="none" stroke="#fff0dc" strokeWidth="2" opacity=".7"/>
    <g transform="translate(22.4 22.6) scale(.86)">{children}</g>

    <g className="companion-dragon-head">
      <path d="M122 47C117 39 113 29 119 22Q122 19 125 24L141 40M180 40l15-16q3-5 6-2c6 7 2 17-3 25" fill="#f6ddbc" stroke="#bc906e" strokeWidth="1.7"/>
      <path d="M112 57Q94 37 87 45Q85 48 89 56L105 80M208 57q18-20 25-12 2 3-2 11l-16 24" fill="#d35150" stroke="#8d2e39" strokeWidth="2"/>
      <path d="M96 53l11 13m117-13-11 13" stroke="#f4b2a1" strokeWidth="4"/>
      <path d="M160 35C125 31 106 46 100 68C88 92 100 116 129 123Q160 133 191 123C220 116 232 92 220 68C214 46 195 31 160 35Z" fill={`url(#${id}-skin)`} stroke="#8d2e39" strokeWidth="2"/>
      <path d="M115 61q12-17 34-17" fill="none" stroke="#ffcfb5" strokeWidth="4" opacity=".55"/>
      <path d="M164 45c-9 0-12 13-2 16q-4-8 2-16" fill="#f9dfb8"/>
      <circle cx="172" cy="51" r="2" fill="#ead3c8"/>

      <g className="companion-eyes">
        {[132, 188].map(x => <g key={x}>
          <ellipse cx={x} cy="85" rx="18" ry="21" fill="#8d2e39" opacity=".5"/>
          <ellipse cx={x} cy="82" rx="16" ry="19" fill="#fdf1d7"/>
          <ellipse cx={x + (x < 160 ? 2 : -2)} cy="83" rx="12.5" ry="16" fill={`url(#${id}-iris)`}/>
          <ellipse cx={x + (x < 160 ? 3 : -3)} cy="81" rx="8.3" ry="12" fill="#29232d"/>
          <ellipse cx={x - 3} cy="75" rx="4.8" ry="5.2" fill="#fffdf5"/>
          <circle cx={x + 5} cy="88" r="2.2" fill="#fff6d8"/>
          <path d={`M${x - 7} 97q7 3 13-1`} fill="none" stroke="#fff0bd" strokeWidth="1.5"/>
        </g>)}
      </g>
      <ellipse cx="111" cy="103" rx="10" ry="5" fill="#ffbc9d" opacity=".62"/>
      <ellipse cx="209" cy="103" rx="10" ry="5" fill="#ffbc9d" opacity=".62"/>
      <path d="M141 98Q160 90 179 98Q188 104 179 114Q160 127 141 114Q132 104 141 98Z" fill="#f29f88"/>
      <ellipse cx="150" cy="103" rx="2" ry="1.4" fill="#9e4b4c"/>
      <ellipse cx="170" cy="103" rx="2" ry="1.4" fill="#9e4b4c"/>
      <path d="M148 111q12 10 25-1" fill="none" stroke="#863d42" strokeWidth="2"/>
      <path d="M167 114l3 5q3-1 3-8" fill="#fff3db"/>
      <circle cx="113" cy="92" r="1.4" fill="#ffcfb5"/><circle cx="207" cy="92" r="1.4" fill="#ffcfb5"/>
    </g>

    <path d="M113 126q-10 17 3 24 11 2 16-9" fill="#e2655b" stroke="#8d2e39" strokeWidth="2"/>
    <path d="M207 126q10 17-3 24-11 2-16-9" fill="#e2655b" stroke="#8d2e39" strokeWidth="2"/>
    <path d="M117 140l5 3m-8 1 5 3m79-7-5 3m8 1-5 3" stroke="#f4b6a0" strokeWidth="2"/>
    {[122, 198].map(x => <g key={x}>
      <ellipse cx={x} cy="178" rx="20" ry="13" fill="#d6534f" stroke="#8d2e39" strokeWidth="2"/>
      <ellipse cx={x} cy="181" rx="10" ry="5" fill="#f4b6a0"/>
      <path d={`M${x - 6} 171v3m6-4v3m6-2v3`} stroke="#ffe0c5" strokeWidth="2.5"/>
    </g>)}
  </g>;
}
