// Traditional Chinese, English, Japanese, Spanish, German, French, Korean, Portuguese, Russian, Italian.
export const staffMessages = {
  mixedStaff: ['混合譜表','Mixed staff','混合譜表','Pentagrama mixto','Gemischtes Notensystem','Portée mixte','혼합 보표','Pauta mista','Смешанный нотный стан','Pentagramma misto'],
  mixedStaffDetail: ['高音＋低音・單行','Treble + bass · one staff','ト音＋ヘ音・1段','Sol + fa · un pentagrama','Violin + Bass · eine Zeile','Sol + fa · une portée','높은음 + 낮은음 · 한 보표','Sol + fá · uma pauta','Скрипичный + басовый · один стан','Violino + basso · un rigo'],
  mixedStaffHelp: [
    '使用同一行五線譜，依音域切換高、低音譜號，減少加線；較極端的音域才使用 8va／8vb。',
    'Use one staff with treble or bass clefs chosen for each register to reduce ledger lines. 8va/8vb is reserved for extreme registers.',
    '1段の五線で音域に合わせてト音・ヘ音記号を切り替え、加線を減らします。極端な音域では8va／8vbを使います。',
    'Un solo pentagrama cambia entre claves de sol y fa según el registro para reducir líneas adicionales. 8va/8vb se reserva para registros extremos.',
    'Eine Notenzeile wechselt passend zur Tonlage zwischen Violin- und Bassschlüssel und reduziert Hilfslinien. 8va/8vb gilt nur für extreme Lagen.',
    'Une seule portée alterne les clés de sol et de fa selon le registre pour limiter les lignes supplémentaires. 8va/8vb est réservé aux registres extrêmes.',
    '한 보표에서 음역에 맞춰 높은음자리표와 낮은음자리표를 전환해 덧줄을 줄입니다. 극단적인 음역에만 8va/8vb를 사용합니다.',
    'Uma pauta alterna entre as claves de sol e fá conforme o registro para reduzir linhas suplementares. 8va/8vb é reservado a registros extremos.',
    'Один нотный стан переключается между скрипичным и басовым ключами по регистру, сокращая добавочные линейки. 8va/8vb используется в крайних регистрах.',
    'Un solo pentagramma alterna chiave di violino e di basso in base al registro, riducendo i tagli addizionali. 8va/8vb è riservato ai registri estremi.',
  ],
} as const;
