// Columns: es, de, fr, ko, pt-BR, ru, it. Kept locally for offline use.
export const additionalMessages: Record<string, readonly string[]> = Object.fromEntries(`
language|Idioma|Sprache|Langue|언어|Idioma|Язык|Lingua
setup|Ajustes de práctica|Übungseinstellungen|Réglages de pratique|연습 설정|Configuração da prática|Настройки занятия|Impostazioni di pratica
practice|Práctica libre|Freies Üben|Pratique libre|자유 연습|Prática livre|Свободная практика|Pratica libera
test|Evaluación|Leistungstest|Évaluation|평가 모드|Avaliação|Проверка навыков|Valutazione
instruments|Instrumento|Instrument|Instrument|악기|Instrumento|Инструмент|Strumento
rangeStaff|Registro y pentagrama|Tonumfang und Notensystem|Tessiture et portée|음역 및 보표|Extensão e pauta|Диапазон и нотный стан|Estensione e pentagramma
challenge|Dificultad y reglas|Schwierigkeit und Regeln|Difficulté et règles|난이도 및 규칙|Dificuldade e regras|Сложность и правила|Difficoltà e regole
chooseInstrument|Elige tu instrumento|Wähle dein Instrument|Choisissez votre instrument|악기를 선택하세요|Escolha seu instrumento|Выберите инструмент|Scegli il tuo strumento
chooseRange|Encuentra un registro cómodo|Finde deinen bequemen Tonumfang|Trouvez une tessiture confortable|편안한 음역을 찾아보세요|Encontre uma extensão confortável|Выберите удобный диапазон|Trova un’estensione comoda
chooseChallenge|Prepara tu práctica de hoy|Gestalte deine heutige Übung|Préparez votre pratique du jour|오늘의 연습을 설정하세요|Prepare a prática de hoje|Настройте сегодняшнее занятие|Prepara la pratica di oggi
intro|Un poco de práctica. Lectura más fluida.|Ein wenig Übung. Flüssiger lesen.|Un peu de pratique. Une lecture plus fluide.|조금씩 연습하고 더 유창하게 읽어요.|Um pouco de prática. Leitura mais fluente.|Немного практики — и чтение становится свободнее.|Un po’ di pratica. Una lettura più fluida.
setupHelp|Elige instrumento, registro, pentagrama y ritmo.|Wähle Instrument, Tonumfang, Notensystem und Rhythmus.|Choisissez instrument, tessiture, portée et rythme.|악기, 음역, 보표와 리듬을 선택하세요.|Escolha instrumento, extensão, pauta e ritmo.|Выберите инструмент, диапазон, нотный стан и ритм.|Scegli strumento, estensione, pentagramma e ritmo.
all|Todos|Alle|Tous|전체|Todos|Все|Tutti
keyboard|Teclados|Tasteninstrumente|Claviers|건반악기|Teclas|Клавишные|Tastiere
strings|Cuerdas|Saiteninstrumente|Cordes|현악기|Cordas|Струнные|Corde
woodwinds|Viento madera|Holzbläser|Bois|목관악기|Madeiras|Деревянные духовые|Legni
brass|Viento metal|Blechbläser|Cuivres|금관악기|Metais|Медные духовые|Ottoni
other|Otros|Andere|Autres|기타|Outros|Другие|Altri
cnWind|Vientos chinos|Chinesische Blasinstrumente|Vents chinois|중국 관악기|Sopros chineses|Китайские духовые|Fiati cinesi
cnPlucked|Cuerdas pulsadas chinas|Chinesische Zupfinstrumente|Cordes pincées chinoises|중국 발현악기|Cordas dedilhadas chinesas|Китайские щипковые|Corde pizzicate cinesi
cnBowed|Cuerdas frotadas chinas|Chinesische Streichinstrumente|Cordes frottées chinoises|중국 찰현악기|Cordas friccionadas chinesas|Китайские смычковые|Archi cinesi
cnPercussion|Percusión china|Chinesisches Schlagwerk|Percussions chinoises|중국 타악기|Percussão chinesa|Китайские ударные|Percussioni cinesi
search|Buscar instrumentos o modelos|Instrumente oder Modelle suchen|Rechercher un instrument ou un modèle|악기 또는 모델 검색|Buscar instrumentos ou modelos|Поиск инструмента или модели|Cerca strumenti o modelli
noResults|No se encontraron instrumentos.|Keine passenden Instrumente.|Aucun instrument correspondant.|일치하는 악기가 없습니다.|Nenhum instrumento encontrado.|Инструменты не найдены.|Nessuno strumento trovato.
sample|♫ Escuchar sonido|♫ Klang anhören|♫ Écouter le timbre|♫ 음색 미리 듣기|♫ Ouvir timbre|♫ Прослушать тембр|♫ Ascolta il timbro
stopSample|■ Detener escucha|■ Vorschau stoppen|■ Arrêter l’écoute|■ 미리 듣기 중지|■ Parar prévia|■ Остановить прослушивание|■ Interrompi l’ascolto
synthetic|Sonido sintetizado|Synthetischer Klang|Son synthétisé|합성 음색|Som sintetizado|Синтезированный звук|Suono sintetizzato
recorded|Muestras de instrumentos grabados|Aufgenommene Instrumentenklänge|Échantillons d’instruments enregistrés|실제 악기 녹음 샘플|Amostras de instrumentos gravados|Записи настоящих инструментов|Campioni di strumenti registrati
soundCredits|Fuentes y licencias de sonido|Klangquellen und Lizenzen|Sources et licences sonores|음원 출처 및 라이선스|Fontes e licenças dos sons|Источники звуков и лицензии|Fonti e licenze dei suoni
written|Registro escrito|Notierter Tonumfang|Tessiture écrite|기보 음역|Extensão escrita|Записанный диапазон|Estensione scritta
sounding|Registro real|Klingender Tonumfang|Tessiture réelle|실음 음역|Extensão real|Звучащий диапазон|Estensione reale
rangeHelp|Límites incluidos; do central = C4.|Grenztöne eingeschlossen; mittleres C = C4.|Bornes incluses ; do central = C4.|양 끝 음 포함, 가온 도 = C4.|Limites incluídos; dó central = C4.|Границы включены; среднее до = C4.|Estremi inclusi; do centrale = C4.
minimum|Nota más grave|Tiefster Ton|Note la plus grave|최저음|Nota mais grave|Нижняя нота|Nota più grave
maximum|Nota más aguda|Höchster Ton|Note la plus aiguë|최고음|Nota mais aguda|Верхняя нота|Nota più acuta
reference|Registro de referencia|Referenztonumfang|Tessiture de référence|기준 음역|Extensão de referência|Справочный диапазон|Estensione di riferimento
source|Fuente del registro ↗|Quelle zum Tonumfang ↗|Source de la tessiture ↗|음역 출처 ↗|Fonte da extensão ↗|Источник диапазона ↗|Fonte dell’estensione ↗
transpose|Transposición al reproducir (semitonos)|Wiedergabetransposition (Halbtöne)|Transposition à la lecture (demi-tons)|재생 이조 (반음)|Transposição na reprodução (semitons)|Транспозиция воспроизведения (полутоны)|Trasposizione in riproduzione (semitoni)
applyRange|Usar registro de referencia|Referenztonumfang verwenden|Utiliser la tessiture de référence|기준 음역 사용|Usar extensão de referência|Использовать справочный диапазон|Usa l’estensione di riferimento
pianoRange|Piano inicial C3–C6|Klaviereinstieg C3–C6|Piano débutant C3–C6|피아노 입문 C3–C6|Piano iniciante C3–C6|Пианино для начинающих C3–C6|Pianoforte iniziale C3–C6
outside|El registro supera la referencia de este modelo.|Der Tonumfang überschreitet die Referenz dieses Modells.|La tessiture dépasse la référence de ce modèle.|설정 음역이 이 모델의 기준 음역을 벗어납니다.|A extensão ultrapassa a referência deste modelo.|Диапазон выходит за справочные пределы модели.|L’estensione supera quella di riferimento del modello.
treble|Clave de sol|Violinschlüssel|Clé de sol|높은음자리표|Clave de sol|Скрипичный ключ|Chiave di violino
bass|Clave de fa|Bassschlüssel|Clé de fa|낮은음자리표|Clave de fá|Басовый ключ|Chiave di basso
alto|Clave de do en tercera|Altschlüssel|Clé d’ut troisième|알토 음자리표|Clave de dó na terceira|Альтовый ключ|Chiave di contralto
tenor|Clave de do en cuarta|Tenorschlüssel|Clé d’ut quatrième|테너 음자리표|Clave de dó na quarta|Теноровый ключ|Chiave di tenore
grand|Gran pentagrama|Klaviersystem|Grande portée|큰보표|Pauta dupla|Двойной нотный стан|Doppio pentagramma
length|Compases|Takte|Mesures|마디 수|Compassos|Такты|Battute
beginner|Principiante|Anfänger|Débutant|초급|Iniciante|Начальный|Principiante
intermediate|Intermedio|Mittelstufe|Intermédiaire|중급|Intermediário|Средний|Intermedio
advanced|Avanzado|Fortgeschritten|Avancé|고급|Avançado|Продвинутый|Avanzato
difficulty|Dificultad de lectura|Leseschwierigkeit|Difficulté de lecture|독보 난이도|Dificuldade de leitura|Сложность чтения|Difficoltà di lettura
rhythm|Complejidad rítmica|Rhythmische Komplexität|Complexité rythmique|리듬 복잡도|Complexidade rítmica|Сложность ритма|Complessità ritmica
simple|Simple|Einfach|Simple|단순|Simples|Простой|Semplice
moderate|Moderada|Mittel|Modérée|보통|Moderada|Умеренный|Moderata
complex|Compleja|Komplex|Complexe|복잡|Complexa|Сложный|Complessa
meter|Compás|Taktart|Mesure|박자표|Fórmula de compasso|Размер|Indicazione di tempo
mixed|Compases mixtos|Taktwechsel|Mesures mixtes|혼합 박자|Compassos mistos|Переменный размер|Metri misti
mixedHelp|Cambia cada dos compases. Elige al menos dos.|Wechsel alle zwei Takte. Wähle mindestens zwei Taktarten.|Change toutes les deux mesures. Choisissez au moins deux mesures.|두 마디마다 박자가 바뀝니다. 두 가지 이상 선택하세요.|Muda a cada dois compassos. Selecione ao menos dois.|Меняется каждые два такта. Выберите хотя бы два размера.|Cambia ogni due battute. Scegli almeno due metri.
chromatic|Añadir variedad cromática|Chromatische Vielfalt|Ajouter des notes chromatiques|반음계 변화 추가|Adicionar variedade cromática|Добавить хроматические ноты|Aggiungi varietà cromatica
previous|← Atrás|← Zurück|← Retour|← 이전|← Voltar|← Назад|← Indietro
next|Continuar →|Weiter →|Continuer →|다음 →|Continuar →|Далее →|Continua →
start|Empezar a leer →|Blattspiel starten →|Commencer la lecture →|독보 시작 →|Começar a leitura →|Начать чтение →|Inizia la lettura →
scale|Escala / modo|Tonleiter / Modus|Gamme / mode|음계 / 선법|Escala / modo|Гамма / лад|Scala / modo
tonic|Tónica|Grundton|Tonique|으뜸음|Tônica|Тоника|Tonica
noTonic|Atonal · sin tónica|Atonal · ohne Grundton|Atonal · sans tonique|무조성 · 으뜸음 없음|Atonal · sem tônica|Атональность · без тоники|Atonale · senza tonica
keySignature|Armadura|Vorzeichen|Armure|조표|Armadura de clave|Ключевые знаки|Armatura di chiave
noSignature|Sin armadura; alteraciones explícitas|Ohne Vorzeichen; explizite Versetzungszeichen|Sans armure ; altérations explicites|조표 없음, 임시표 표시|Sem armadura; acidentes explícitos|Без ключевых знаков; явные альтерации|Senza armatura; alterazioni esplicite
intervals|Semitonos sobre la tónica|Halbtöne über dem Grundton|Demi-tons au-dessus de la tonique|으뜸음 위 반음 간격|Semitons acima da tônica|Полутоны над тоникой|Semitoni sopra la tonica
modeFamily|Modos tonales y eclesiásticos|Tonale und Kirchentonarten|Modes tonals et ecclésiastiques|조성 및 교회 선법|Modos tonais e eclesiásticos|Тональные и церковные лады|Modi tonali ed ecclesiastici
pentatonic|Escalas pentatónicas|Pentatonische Tonleitern|Gammes pentatoniques|5음 음계|Escalas pentatônicas|Пентатоники|Scale pentatoniche
japanese|Escalas japonesas|Japanische Tonleitern|Gammes japonaises|일본 음계|Escalas japonesas|Японские гаммы|Scale giapponesi
otherScales|Blues y otras escalas|Blues und andere Tonleitern|Blues et autres gammes|블루스 및 기타 음계|Blues e outras escalas|Блюзовые и другие гаммы|Blues e altre scale
atonalFamily|Atonal|Atonal|Atonal|무조성|Atonal|Атональность|Atonale
major|Mayor / jónico|Dur / Ionisch|Majeur / ionien|장음계 / 이오니안|Maior / jônio|Мажор / ионийский|Maggiore / ionico
naturalMinor|Menor natural / eólico|Natürliches Moll / Äolisch|Mineur naturel / éolien|자연단음계 / 에올리안|Menor natural / eólio|Натуральный минор / эолийский|Minore naturale / eolio
harmonicMinor|Menor armónica|Harmonisches Moll|Mineur harmonique|화성단음계|Menor harmônica|Гармонический минор|Minore armonica
melodicMinor|Menor melódica (jazz)|Melodisches Moll (Jazz)|Mineur mélodique (jazz)|가락단음계 (재즈)|Menor melódica (jazz)|Мелодический минор (джаз)|Minore melodica (jazz)
backSetup|← Ajustes|← Einstellungen|← Réglages|← 설정|← Configurações|← Настройки|← Impostazioni
newExercise|↻ Nuevo ejercicio|↻ Neue Übung|↻ Nouvel exercice|↻ 새 연습|↻ Novo exercício|↻ Новое упражнение|↻ Nuovo esercizio
practiceTitle|Encuentra tu ritmo de lectura.|Finde deinen Leserhythmus.|Trouvez votre rythme de lecture.|나만의 독보 리듬을 찾아보세요.|Encontre seu ritmo de leitura.|Найдите свой ритм чтения.|Trova il tuo ritmo di lettura.
play|Reproducir partitura|Partitur abspielen|Lire la partition|악보 재생|Reproduzir partitura|Воспроизвести партитуру|Riproduci spartito
resume|Reanudar|Fortsetzen|Reprendre|계속 재생|Retomar|Продолжить|Riprendi
pause|Pausar|Pausieren|Mettre en pause|일시 정지|Pausar|Пауза|Pausa
stop|Detener|Stoppen|Arrêter|정지|Parar|Стоп|Ferma
replay|Repetir|Erneut abspielen|Rejouer|처음부터 재생|Repetir|С начала|Riproduci dall’inizio
tempo|Tempo|Tempo|Tempo|빠르기|Andamento|Темп|Tempo
metronome|Metrónomo|Metronom|Métronome|메트로놈|Metrônomo|Метроном|Metronomo
downbeat|Acentuar el primer pulso de cada compás|Ersten Schlag jedes Takts betonen|Accentuer le premier temps de chaque mesure|각 마디의 첫 박 강조|Acentuar o primeiro tempo de cada compasso|Выделять первую долю каждого такта|Accenta il primo movimento di ogni battuta
ready|Listo|Bereit|Prêt|준비됨|Pronto|Готово|Pronto
loadingAudio|Iniciando audio|Audio wird gestartet|Démarrage audio|오디오 시작 중|Iniciando áudio|Запуск звука|Avvio dell’audio
playing|Reproduciendo partitura|Partitur läuft|Lecture de la partition|악보 재생 중|Reproduzindo partitura|Воспроизведение партитуры|Riproduzione dello spartito
clicking|Metrónomo activo|Metronom läuft|Métronome actif|메트로놈 작동 중|Metrônomo ativo|Метроном включён|Metronomo attivo
paused|En pausa|Pausiert|En pause|일시 정지됨|Pausado|На паузе|In pausa
sound|Sonido|Klang|Timbre|음색|Timbre|Тембр|Timbro
score|Partitura|Partitur|Partition|악보|Partitura|Партитура|Spartito
readingTime|Tiempo de lectura|Lesezeit|Temps de lecture|악보 읽기 시간|Tempo de leitura|Время на чтение|Tempo di lettura
seconds|segundos|Sekunden|secondes|초|segundos|секунд|secondi
questions|Preguntas|Aufgaben|Questions|문항 수|Questões|Задания|Domande
oneQuestion|Una pregunta|Eine Aufgabe|Une question|한 문항|Uma questão|Одно задание|Una domanda
tenQuestions|Evaluación de 10 preguntas|Test mit 10 Aufgaben|Évaluation de 10 questions|10문항 평가|Avaliação de 10 questões|Проверка из 10 заданий|Valutazione di 10 domande
latency|Compensación de latencia (ms)|Eingangsverzögerung (ms)|Compensation de latence (ms)|입력 지연 보정 (ms)|Compensação de latência (ms)|Компенсация задержки (мс)|Compensazione della latenza (ms)
startExam|Activar micrófono y empezar|Mikrofon aktivieren und starten|Activer le micro et commencer|마이크 켜고 시작|Ativar microfone e começar|Включить микрофон и начать|Attiva il microfono e inizia
cancelExam|Cancelar pregunta|Aufgabe abbrechen|Annuler la question|문항 취소|Cancelar questão|Отменить задание|Annulla domanda
nextQuestion|Siguiente pregunta →|Nächste Aufgabe →|Question suivante →|다음 문항 →|Próxima questão →|Следующее задание →|Domanda successiva →
restartExam|Nueva evaluación|Neuer Test|Nouvelle évaluation|새 평가|Nova avaliação|Новая проверка|Nuova valutazione
permission|Esperando permiso del micrófono|Warten auf Mikrofonfreigabe|En attente de l’autorisation du micro|마이크 권한 대기 중|Aguardando permissão do microfone|Ожидание доступа к микрофону|In attesa del permesso del microfono
reading|Lee la partitura|Partitur lesen|Lisez la partition|악보를 읽으세요|Leia a partitura|Читайте партитуру|Leggi lo spartito
countin|Cuenta de cuatro pulsos|Vier Schläge einzählen|Décompte de quatre temps|4박 예비박|Contagem de quatro tempos|Отсчёт четырёх долей|Conteggio di quattro movimenti
performing|Toca ahora|Jetzt spielen|Jouez maintenant|지금 연주하세요|Toque agora|Начинайте играть|Suona ora
result|Resultado de la pregunta|Aufgabenergebnis|Résultat de la question|문항 결과|Resultado da questão|Результат задания|Risultato della domanda
summary|Evaluación general|Gesamtauswertung|Évaluation globale|종합 평가|Avaliação geral|Общая оценка|Valutazione complessiva
pitchScore|Altura|Tonhöhe|Hauteur|음높이|Altura|Высота звука|Altezza
rhythmScore|Ritmo|Rhythmus|Rythme|리듬|Ritmo|Ритм|Ritmo
completion|Cobertura|Vollständigkeit|Couverture|완성도|Cobertura|Полнота|Completezza
confidence|Confianza de detección|Erkennungssicherheit|Fiabilité de détection|감지 신뢰도|Confiança da detecção|Надёжность распознавания|Affidabilità del rilevamento
noteDetails|Detalle de notas|Notendetails|Détail des notes|음표별 결과|Detalhes das notas|Результаты по нотам|Dettagli delle note
expected|Esperada|Erwartet|Attendu|예상 음|Esperada|Ожидается|Attesa
onset|Desfase de inicio (ms)|Einsatzabweichung (ms)|Décalage d’attaque (ms)|시작 시점 오차 (ms)|Desvio do ataque (ms)|Отклонение начала (мс)|Scarto dell’attacco (ms)
heard|Detectada|Erkannt|Détecté|감지됨|Detectada|Обнаружено|Rilevata
notHeard|No detectada|Nicht erkannt|Non détecté|감지되지 않음|Não detectada|Не обнаружено|Non rilevata
calibrationTitle|Calibración temporal del micrófono|Mikrofon-Zeitkalibrierung|Calibrage temporel du micro|마이크 타이밍 보정|Calibração temporal do microfone|Калибровка времени микрофона|Calibrazione temporale del microfono
calibrationPattern|Cuatro pulsos, dos corcheas por pulso|Vier Schläge, je zwei Achtel|Quatre temps, deux croches par temps|4박, 매 박에 8분음표 두 개|Quatro tempos, duas colcheias por tempo|Четыре доли, по две восьмые на долю|Quattro movimenti, due crome per movimento
calibrationRequired|Calibra antes de la primera evaluación.|Vor dem ersten Test kalibrieren.|Calibrez avant la première évaluation.|첫 평가 전에 보정하세요.|Calibre antes da primeira avaliação.|Выполните калибровку перед первой проверкой.|Calibra prima della prima valutazione.
calibrationValue|Compensación temporal aplicada|Angewandte Zeitkorrektur|Correction temporelle appliquée|적용된 시간 보정|Compensação temporal aplicada|Применённая поправка времени|Correzione temporale applicata
calibrate|Calibrar|Kalibrieren|Calibrer|보정 시작|Calibrar|Калибровать|Calibra
recalibrate|Recalibrar|Neu kalibrieren|Recalibrer|다시 측정|Recalibrar|Повторить калибровку|Ricalibra
calibrationSaved|Guardado en este navegador para futuras evaluaciones.|Für künftige Tests in diesem Browser gespeichert.|Enregistré dans ce navigateur pour les prochaines évaluations.|다음 평가를 위해 이 브라우저에 저장되었습니다.|Salvo neste navegador para avaliações futuras.|Сохранено в браузере для следующих проверок.|Salvato in questo browser per le prossime valutazioni.
calibrationTemporary|Aplicado a esta sesión; no se puede guardar en el navegador.|Für diese Sitzung angewandt; Browserspeicher nicht verfügbar.|Appliqué à cette session ; stockage du navigateur indisponible.|이번 세션에 적용되었습니다. 브라우저에 저장할 수 없습니다.|Aplicado nesta sessão; armazenamento indisponível.|Применено для этого сеанса; сохранение недоступно.|Applicato a questa sessione; salvataggio nel browser non disponibile.
`.trim().split('\n').map(row => { const [key, ...values] = row.split('|'); return [key, values]; }));
