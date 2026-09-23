/** Original Mimo artwork, recovered from the initial companion implementation. */
export function OriginalCompanion({id}: {id: string}) {
  return <>
          <g className="note-companion__left-arm" fill="none" stroke="#58775a" strokeWidth="8" strokeLinecap="round"><path d="M113 131q-22 3-25-12"/></g>
          <g className="note-companion__right-arm" fill="none" stroke="#58775a" strokeWidth="8" strokeLinecap="round"><path d="M205 131q21 3 25-12"/></g>
          <ellipse cx="134" cy="179" rx="13" ry="6" fill="#405b47"/><ellipse cx="186" cy="179" rx="13" ry="6" fill="#405b47"/>
          <path d="M149 30q11-6 22 0l44 139q3 11-9 11h-92q-12 0-9-11Z" fill={`url(#${id}-body)`} stroke="#658365" strokeWidth="1.4"/>
          <path d="M149 31 110 168q-2 5 4 6" fill="none" stroke="#d3dfba" strokeOpacity=".7" strokeWidth="2"/>
          <path d="M171 31 210 169q2 6-5 6" fill="none" stroke="#354f42" strokeOpacity=".32" strokeWidth="2"/>
          <path d="M151 45q9-4 18 0l31 108q2 7-5 7h-70q-7 0-5-7Z" fill={`url(#${id}-face)`} stroke="#e6d3a3" strokeWidth="1.3"/>
          <path d="M160 53v70" stroke="#9f9677" strokeWidth="1.8"/>
          <g stroke="#b7aa83" strokeWidth="1.1" strokeLinecap="round">
            <path d="M154 62h12m-14 11h16m-18 11h20m-22 11h24m-26 11h28"/>
          </g>
          <g className="note-companion__pendulum">
            <path d="M160 138V39" stroke="#816a42" strokeWidth="3.6" strokeLinecap="round"/>
            <path d="M160 138V39" stroke="#ead396" strokeWidth="1.3" strokeLinecap="round"/>
            <rect x="153" y="66" width="14" height="13" rx="3" fill={`url(#${id}-brass)`} stroke="#a9894e" strokeWidth=".8"/>
            <path d="M157 69h6" stroke="#fff0bf" strokeWidth="1.1" strokeLinecap="round"/>
          </g>
          <circle cx="160" cy="138" r="8" fill={`url(#${id}-brass)`}/><circle cx="160" cy="138" r="3" fill="#e6cf91"/>
          <g className="note-companion__face">
            <ellipse cx="140" cy="123" rx="3.5" ry="5" fill="#304937"/><ellipse cx="180" cy="123" rx="3.5" ry="5" fill="#304937"/>
            <circle cx="141" cy="121.7" r="1" fill="#fffbed"/><circle cx="181" cy="121.7" r="1" fill="#fffbed"/>
            <ellipse cx="132" cy="132" rx="6" ry="3" fill="#d6a084" opacity=".55"/><ellipse cx="188" cy="132" rx="6" ry="3" fill="#d6a084" opacity=".55"/>
            <path d="M150 146q10 9 20 0" fill="none" stroke="#54704e" strokeWidth="2" strokeLinecap="round"/>
          </g>
          <path d="M119 169h82" stroke="#bed0a0" strokeOpacity=".65" strokeWidth="1"/>
          <rect x="149" y="164" width="22" height="7" rx="3.5" fill={`url(#${id}-brass)`}/>
  </>;
}
