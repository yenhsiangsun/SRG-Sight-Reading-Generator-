// Columns: ja, es, de, fr, ko, pt-BR, ru, it. Instrument proper names retain transliteration where customary.
export const instrumentTranslations: Record<string, readonly string[]> = Object.fromEntries(`
Piano|ピアノ · 88鍵|Piano · 88 teclas|Klavier · 88 Tasten|Piano · 88 touches|피아노 · 88건반|Piano · 88 teclas|Пианино · 88 клавиш|Pianoforte · 88 tasti
Violin|ヴァイオリン|Violín|Violine|Violon|바이올린|Violino|Скрипка|Violino
Viola|ヴィオラ|Viola|Bratsche|Alto|비올라|Viola|Альт|Viola
Cello|チェロ|Violonchelo|Violoncello|Violoncelle|첼로|Violoncelo|Виолончель|Violoncello
Double Bass|コントラバス · 4弦|Contrabajo · 4 cuerdas|Kontrabass · 4 Saiten|Contrebasse · 4 cordes|콘트라베이스 · 4현|Contrabaixo · 4 cordas|Контрабас · 4 струны|Contrabbasso · 4 corde
Flute|フルート · H足部管|Flauta · pata de si|Flöte · H-Fuß|Flûte · patte de si|플루트 · B 풋조인트|Flauta · pé em si|Флейта · нижнее си|Flauto · piede al si
Clarinet|クラリネット · B♭管|Clarinete en si♭|Klarinette in B|Clarinette en si♭|B♭ 클라리넷|Clarinete em si♭|Кларнет in B|Clarinetto in si♭
Oboe|オーボエ|Oboe|Oboe|Hautbois|오보에|Oboé|Гобой|Oboe
Bassoon|ファゴット|Fagot|Fagott|Basson|바순|Fagote|Фагот|Fagotto
Trumpet|トランペット · C管|Trompeta en do|Trompete in C|Trompette en ut|C 트럼펫|Trompete em dó|Труба in C|Tromba in do
French Horn|ホルン · F管|Trompa en fa|Horn in F|Cor en fa|F 호른|Trompa em fá|Валторна in F|Corno in fa
Trombone|トロンボーン|Trombón|Posaune|Trombone|트롬본|Trombone|Тромбон|Trombone
Tuba|バスチューバ · F管|Tuba baja en fa|Basstuba in F|Tuba basse en fa|F 베이스 튜바|Tuba baixo em fá|Басовая туба in F|Tuba bassa in fa
Alto Saxophone|アルトサックス|Saxofón alto|Altsaxofon|Saxophone alto|알토 색소폰|Saxofone alto|Альт-саксофон|Sassofono contralto
Tenor Saxophone|テナーサックス|Saxofón tenor|Tenorsaxofon|Saxophone ténor|테너 색소폰|Saxofone tenor|Тенор-саксофон|Sassofono tenore
Guitar|ギター · 6弦 / 20フレット|Guitarra · 6 cuerdas / 20 trastes|Gitarre · 6 Saiten / 20 Bünde|Guitare · 6 cordes / 20 frettes|기타 · 6현 / 20프렛|Violão · 6 cordas / 20 trastes|Гитара · 6 струн / 20 ладов|Chitarra · 6 corde / 20 tasti
Bass Guitar|ベース · 4弦 / 24フレット|Bajo eléctrico · 4 cuerdas / 24 trastes|E-Bass · 4 Saiten / 24 Bünde|Basse électrique · 4 cordes / 24 frettes|베이스 기타 · 4현 / 24프렛|Baixo elétrico · 4 cordas / 24 trastes|Бас-гитара · 4 струны / 24 лада|Basso elettrico · 4 corde / 24 tasti
Voice|声 · 音域を設定|Voz · registro personal|Stimme · eigener Tonumfang|Voix · tessiture personnelle|목소리 · 사용자 음역|Voz · extensão pessoal|Голос · свой диапазон|Voce · estensione personale
Sheng|高音鍵付き笙|Sheng soprano con llaves|Sopran-Sheng mit Klappen|Sheng soprano à clés|소프라노 키 셩|Sheng soprano com chaves|Сопрановый шэн с клапанами|Sheng soprano a chiavi
Alto Sheng|アルト笙|Sheng alto|Alt-Sheng|Sheng alto|알토 셩|Sheng alto|Альтовый шэн|Sheng contralto
Tenor Sheng|テナー笙|Sheng tenor|Tenor-Sheng|Sheng ténor|테너 셩|Sheng tenor|Теноровый шэн|Sheng tenore
Bass Sheng|バス笙|Sheng bajo|Bass-Sheng|Sheng basse|베이스 셩|Sheng baixo|Басовый шэн|Sheng basso
Bangdi G|梆笛|Bangdi|Bangdi-Flöte|Flûte bangdi|방디|Flauta bangdi|Банди|Flauto bangdi
Qudi C|曲笛|Qudi|Qudi-Flöte|Flûte qudi|취디|Flauta qudi|Цюйди|Flauto qudi
Xindi G|新笛 / 大笛|Xindi / dadi|Xindi / Dadi-Flöte|Flûte xindi / dadi|신디 / 다디|Flauta xindi / dadi|Синьди / дади|Flauto xindi / dadi
Soprano Suona|高音嗩吶|Suona soprano|Sopran-Suona|Suona soprano|소프라노 수오나|Suona soprano|Сопрановая сона|Suona soprano
Alto Suona|アルト嗩吶|Suona alto|Alt-Suona|Suona alto|알토 수오나|Suona alto|Альтовая сона|Suona contralto
Tenor Suona|テナー嗩吶|Suona tenor|Tenor-Suona|Suona ténor|테너 수오나|Suona tenor|Теноровая сона|Suona tenore
Bass Suona|バス嗩吶|Suona bajo|Bass-Suona|Suona basse|베이스 수오나|Suona baixo|Басовая сона|Suona basso
Suona C|伝統的な高音嗩吶|Suona soprano tradicional|Traditionelle Sopran-Suona|Suona soprano traditionnel|전통 소프라노 수오나|Suona soprano tradicional|Традиционная сопрановая сона|Suona soprano tradizionale
Suona G|伝統的なアルト嗩吶|Suona alto tradicional|Traditionelle Alt-Suona|Suona alto traditionnel|전통 알토 수오나|Suona alto tradicional|Традиционная альтовая сона|Suona contralto tradizionale
Guan G|高音管子|Guan soprano|Sopran-Guan|Guan soprano|소프라노 관쯔|Guan soprano|Сопрановый гуань|Guan soprano
Alto Guan|アルト管子|Guan alto|Alt-Guan|Guan alto|알토 관쯔|Guan alto|Альтовый гуань|Guan contralto
Bass Guan|バス管子|Guan bajo|Bass-Guan|Guan basse|베이스 관쯔|Guan baixo|Басовый гуань|Guan basso
Liuqin|柳琴|Liuqin|Liuqin|Liuqin|류친|Liuqin|Люцинь|Liuqin
Pipa|琵琶|Pipa|Pipa|Pipa|비파|Pipa|Пипа|Pipa
Zhongruan|中阮|Zhongruan|Zhongruan|Zhongruan|중루안|Zhongruan|Чжунжуань|Zhongruan
Daruan|大阮|Daruan|Daruan|Daruan|다루안|Daruan|Дажуань|Daruan
Sanxian|三弦|Sanxian|Sanxian|Sanxian|싼셴|Sanxian|Саньсянь|Sanxian
Guzheng|古筝 · 21弦|Guzheng · 21 cuerdas|Guzheng · 21 Saiten|Guzheng · 21 cordes|구정 · 21현|Guzheng · 21 cordas|Гучжэн · 21 струна|Guzheng · 21 corde
Yangqin|揚琴 · 管弦楽モデル|Yangqin · modelo orquestal|Yangqin · Orchestermodell|Yangqin · modèle orchestral|양금 · 관현악 모델|Yangqin · modelo orquestral|Янцинь · оркестровая модель|Yangqin · modello orchestrale
Gaohu|高胡|Gaohu|Gaohu|Gaohu|가오후|Gaohu|Гаоху|Gaohu
Erhu|二胡|Erhu|Erhu|Erhu|얼후|Erhu|Эрху|Erhu
Zhonghu|中胡|Zhonghu|Zhonghu|Zhonghu|중후|Zhonghu|Чжунху|Zhonghu
Gehu|革胡|Gehu|Gehu|Gehu|거후|Gehu|Гэху|Gehu
Bass Gehu|低音革胡|Gehu bajo|Bass-Gehu|Gehu basse|베이스 거후|Gehu baixo|Басовый гэху|Gehu basso
Yunluo|雲鑼 · 37音|Yunluo · 37 gongs|Yunluo · 37 Gongs|Yunluo · 37 gongs|윈뤄 · 공 37개|Yunluo · 37 gongos|Юньло · 37 гонгов|Yunluo · 37 gong
`.trim().split('\n').map(row => { const [key, ...values] = row.split('|'); return [key, values]; }));
