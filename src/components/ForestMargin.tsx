/** Original vector linework, kept at the page margin rather than over notation. */
export function ForestMargin(){
  return <svg className="forest-margin" viewBox="0 0 160 240" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M43 230C72 176 73 103 125 18M68 161C49 139 39 126 28 101M86 116C111 112 127 98 143 79M104 65C88 54 81 38 80 23"/>
      <path d="M73 166C42 170 36 148 36 148C57 144 70 153 73 166ZM80 139C103 122 121 126 121 126C117 146 99 151 80 139ZM87 112C64 101 63 82 63 82C85 86 92 99 87 112ZM107 64C114 40 132 36 132 36C135 55 125 67 107 64ZM44 133C22 136 15 121 15 121C32 115 44 121 44 133ZM122 102C122 84 139 75 139 75C146 95 137 103 122 102ZM88 49C70 46 65 31 65 31C84 29 92 36 88 49Z"/>
      <path d="M33 224H139M38 229H132M43 234H125" opacity=".4"/>
    </g>
  </svg>;
}

/** A small engraved frontispiece. Decorative artwork, not a generated exercise. */
export function StudioFrontispiece(){
  return <div className="studio-frontispiece" aria-hidden="true"><ForestMargin/>
    <svg className="studio-frontispiece-score" viewBox="0 0 560 180" fill="none">
      <g stroke="currentColor" strokeWidth=".9">{[70,82,94,106,118].map(y=><path key={y} d={`M20 ${y}H540`}/>)}<path d="M20 70V118M540 70V118M283 70V118"/></g>
      <text x="30" y="116" fill="currentColor" fontSize="74" fontFamily="serif">𝄞</text>
      <g fill="currentColor">{[[117,106],[157,94],[197,82],[237,94],[317,94],[357,82],[397,70],[457,82]].map(([x,y])=><g key={x}><ellipse cx={x} cy={y} rx="7" ry="4.6" transform={`rotate(-18 ${x} ${y})`}/><path d={`M${x+6} ${y}V${y-36}`} stroke="currentColor" strokeWidth="1.5"/></g>)}</g>
      <path d="M116 57Q177 10 241 47M316 48Q390 4 460 39" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  </div>;
}
