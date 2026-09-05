import { useEffect, useRef, useState } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Beam,
  Dot,
  Fraction,
  BarNote,
  BarlineType,
} from "vexflow";
import * as Tone from "tone";
import "./App.css";

import {
  generateExercise,
  type Difficulty as EngineDifficulty,
  type RhythmLevel as EngineRhythmLevel,
  type Instrument as EngineInstrument,
  type Clef as EngineClef,
  type KeySignature as EngineKeySignature,
  type TimeSignature as EngineTimeSignature,
  type ExerciseData,
} from "./music";

/* =========================================================
 * UI Types
 * ======================================================= */

type Difficulty =
  | "Beginner"
  | "Intermediate"
  | "Advanced";

type Instrument =
  | "Piano"
  | "Violin"
  | "Viola"
  | "Cello"
  | "Double Bass"
  | "Flute"
  | "Clarinet"
  | "Oboe"
  | "Bassoon"
  | "Trumpet"
  | "French Horn"
  | "Trombone"
  | "Tuba"
  | "Alto Saxophone"
  | "Tenor Saxophone"
  | "Guitar"
  | "Bass Guitar"
  | "Sheng"
  | "Voice";

type Clef =
  | "treble"
  | "alto"
  | "tenor"
  | "bass";

type RhythmLevel =
  | "Simple"
  | "Moderate"
  | "Complex";

/* =========================================================
 * Instrument Settings
 * ======================================================= */

const INSTRUMENTS: Record<
  Instrument,
  {
    clef: Clef;
    engineInstrument: EngineInstrument;
  }
> = {
  Piano: {
    clef: "treble",
    engineInstrument: "Piano",
  },
  Violin: {
    clef: "treble",
    engineInstrument: "Violin",
  },
  Viola: {
    clef: "alto",
    engineInstrument: "Violin",
  },
  Cello: {
    clef: "bass",
    engineInstrument: "Cello",
  },
  "Double Bass": {
    clef: "bass",
    engineInstrument: "Cello",
  },
  Flute: {
    clef: "treble",
    engineInstrument: "Flute",
  },
  Clarinet: {
    clef: "treble",
    engineInstrument: "Clarinet",
  },
  Oboe: {
    clef: "treble",
    engineInstrument: "Flute",
  },
  Bassoon: {
    clef: "bass",
    engineInstrument: "Cello",
  },
  Trumpet: {
    clef: "treble",
    engineInstrument: "Trumpet",
  },
  "French Horn": {
    clef: "treble",
    engineInstrument: "Trumpet",
  },
  Trombone: {
    clef: "bass",
    engineInstrument: "Trombone",
  },
  Tuba: {
    clef: "bass",
    engineInstrument: "Trombone",
  },
  "Alto Saxophone": {
    clef: "treble",
    engineInstrument: "Clarinet",
  },
  "Tenor Saxophone": {
    clef: "treble",
    engineInstrument: "Clarinet",
  },
  Guitar: {
    clef: "treble",
    engineInstrument: "Piano",
  },
  "Bass Guitar": {
    clef: "bass",
    engineInstrument: "Cello",
  },
  Sheng: {
    clef: "treble",
    engineInstrument: "Sheng",
  },
  Voice: {
    clef: "treble",
    engineInstrument: "Sheng",
  },
};

const CLEFS: Clef[] = [
  "treble",
  "alto",
  "tenor",
  "bass",
];

const KEY_SIGNATURES = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
] as const;

const TIME_SIGNATURES = [
  "2/4",
  "3/4",
  "4/4",
  "5/4",
  "6/8",
  "7/8",
  "9/8",
  "12/8",
] as const;

/* =========================================================
 * Mapping UI → Music Engine
 * ======================================================= */

function mapDifficulty(
  difficulty: Difficulty
): EngineDifficulty {
  if (difficulty === "Beginner") {
    return "beginner";
  }

  if (difficulty === "Intermediate") {
    return "intermediate";
  }

  return "advanced";
}

function mapRhythmLevel(
  rhythm: RhythmLevel
): EngineRhythmLevel {
  if (rhythm === "Simple") {
    return "simple";
  }

  if (rhythm === "Moderate") {
    return "medium";
  }

  return "complex";
}

function mapInstrument(
  instrument: Instrument
): EngineInstrument {
  return INSTRUMENTS[instrument]
    .engineInstrument;
}

function mapClef(
  clef: Clef
): EngineClef {
  return clef;
}

function mapKeySignature(
  key: string
): EngineKeySignature {
  return key as EngineKeySignature;
}

function mapTimeSignature(
  time: string
): EngineTimeSignature {
  return time as EngineTimeSignature;
}

/* =========================================================
 * Time Signature Helpers
 * ======================================================= */

function parseTimeSignature(
  timeSignature: string
) {
  const [top, bottom] =
    timeSignature
      .split("/")
      .map(Number);

  return {
    numBeats: top,
    beatValue: bottom,
  };
}

function unitsToFraction(
  units: number
): Fraction {
  return new Fraction(
    units,
    16
  );
}

/* =========================================================
 * Score Display
 * ======================================================= */

function ScoreDisplay({
  exercise,
}: {
  exercise: ExerciseData;
}) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const width = Math.max(
      container.clientWidth,
      760
    );

    /*
     * 一行兩小節。
     */
    const measuresPerRow = 2;

    const actualMeasures =
      exercise.measures.length;

    const rows = Math.ceil(
      actualMeasures /
        measuresPerRow
    );

    /*
     * 增加行距，
     * 讓音符與下一行之間更舒服。
     */
    const rowHeight = 165;

    const height =
      rows * rowHeight + 50;

    const renderer =
      new Renderer(
        container,
        Renderer.Backends.SVG
      );

    renderer.resize(
      width,
      height
    );

    const context =
      renderer.getContext();

    /*
     * 每一行使用完整寬度。
     */
    const staveWidth =
      width - 20;

    /*
     * =====================================================
     * 排版微調
     * =====================================================
     *
     * NOTE_START_OFFSET：
     *
     * 每一行前面都有 Clef / Key / Time，
     * 音符不能緊貼這些符號。
     *
     * 把實際音符起點往右推一些，
     * 讓第一拍看起來比較自然。
     *
     * NOTE_END_EXTRA：
     *
     * Formatter 預設會保留一些右側空間。
     * 這裡略微增加有效排版寬度，
     * 讓最後一個音符更靠近行尾。
     */
    const NOTE_START_OFFSET = 18;
    const NOTE_END_EXTRA = 10;

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      const startMeasureIndex =
        row *
        measuresPerRow;

      const endMeasureIndex =
        Math.min(
          startMeasureIndex +
            measuresPerRow,
          actualMeasures
        );

      const y =
        row *
          rowHeight +
        20;

      /*
       * 建立整行 Stave。
       */
      const stave =
        new Stave(
          10,
          y,
          staveWidth
        );

      /*
       * 每一行重新顯示：
       * Clef / Key / Time
       */
      stave.addClef(
        exercise.clef
      );

      stave.addKeySignature(
        exercise.keySignature
      );

      stave.addTimeSignature(
        exercise.timeSignature
      );

      stave.setContext(
        context
      );

      stave.draw();

      /*
       * =====================================================
       * 調整音符真正的開始位置
       * =====================================================
       *
       * VexFlow 在處理 Clef / Key / Time 後，
       * 會自動產生 noteStartX。
       *
       * 我們再額外往右留一點呼吸空間。
       */
      const originalNoteStartX =
        stave.getNoteStartX();

      stave.setNoteStartX(
        originalNoteStartX +
          NOTE_START_OFFSET
      );

      /*
       * 取得拍號資訊。
       */
      const {
        numBeats,
        beatValue,
      } =
        parseTimeSignature(
          exercise.timeSignature
        );

      /*
       * 一行最多兩小節。
       *
       * 兩個小節共用同一個 Voice，
       * 讓 Formatter 可以把整行一起排版。
       */
      const measuresInThisRow =
        endMeasureIndex -
        startMeasureIndex;

      const voice =
        new Voice({
          numBeats:
            numBeats *
            measuresInThisRow,
          beatValue,
        });

      voice.setStrict(false);

      /*
       * 整行所有音符與小節線。
       */
      const rowTickables:
        Array<StaveNote | BarNote> =
        [];

      /*
       * Beam groups。
       */
      const beamGroups: Fraction[] =
        [];

      /*
       * =====================================================
       * 把這一行的小節加入 Voice
       * =====================================================
       */
      for (
        let measureIndex =
          startMeasureIndex;
        measureIndex <
          endMeasureIndex;
        measureIndex++
      ) {
        const measure =
          exercise.measures[
            measureIndex
          ];

        /*
         * 建立這個小節的音符。
         */
        const measureNotes =
          measure.events.map(
            (note) => {
              const duration =
                note.rest
                  ? `${note.duration}r`
                  : note.duration;

              const staveNote =
                new StaveNote({
                  clef:
                    exercise.clef,

                  keys: note.rest
                    ? ["b/4"]
                    : [note.key],

                  duration,
                });

              /*
               * 附點。
               */
              if (
                note.dots > 0
              ) {
                for (
                  let i = 0;
                  i < note.dots;
                  i++
                ) {
                  Dot.buildAndAttach([
                    staveNote,
                  ]);
                }
              }

              return staveNote;
            }
          );

        /*
         * 加入整行。
         */
        rowTickables.push(
          ...measureNotes
        );

        /*
         * 保留每個小節自己的 Beam grouping。
         */
        measure.groups.forEach(
          (units) => {
            beamGroups.push(
              unitsToFraction(
                units
              )
            );
          }
        );

        /*
         * 小節與小節之間加入小節線。
         */
        if (
          measureIndex <
          endMeasureIndex - 1
        ) {
          rowTickables.push(
            new BarNote(
              BarlineType.SINGLE
            )
          );
        }
      }

      /*
       * 加入 Voice。
       */
      voice.addTickables(
        rowTickables
      );

      /*
       * =====================================================
       * Beam
       * =====================================================
       */
      let beams: Beam[] = [];

      try {
        beams =
          Beam.applyAndGetBeams(
            voice,
            undefined,
            beamGroups
          );
      } catch {
        beams = [];
      }

      /*
       * =====================================================
       * Formatter
       * =====================================================
       *
       * 這裡不直接使用 formatToStave()，
       * 而是自己指定 justifyWidth。
       *
       * 原因：
       *
       * 1. 前面 noteStartX 已經往右調整。
       * 2. 再額外增加 NOTE_END_EXTRA，
       *    讓最後的音符更接近右側。
       */
      const formatter =
        new Formatter();

      formatter.joinVoices([
        voice,
      ]);

      const noteStartX =
        stave.getNoteStartX();

      const noteEndX =
        stave.getNoteEndX();

      const justifyWidth =
        noteEndX -
        noteStartX +
        NOTE_END_EXTRA;

      formatter.format(
        [voice],
        justifyWidth,
        {
          context,
          stave,
        }
      );

      /*
       * 畫整行音符。
       */
      voice.draw(
        context,
        stave
      );

      /*
       * 最後畫 Beam。
       */
      beams.forEach(
        (beam) => {
          beam
            .setContext(
              context
            )
            .draw();
        }
      );
    }
  }, [exercise]);

  return (
    <div
      ref={containerRef}
      className="score-container"
    />
  );
}

/* =========================================================
 * App
 * ======================================================= */

function App() {
  const [instrument, setInstrument] =
    useState<Instrument>("Sheng");

  const [clef, setClef] =
    useState<Clef>("treble");

  const [difficulty, setDifficulty] =
    useState<Difficulty>(
      "Beginner"
    );

  const [keySignature, setKeySignature] =
    useState("C");

  const [timeSignature, setTimeSignature] =
    useState("4/4");

  const [rhythmLevel, setRhythmLevel] =
    useState<RhythmLevel>("Simple");

  const [measureCount, setMeasureCount] =
    useState(8);

  const [bpm, setBpm] =
    useState(72);

  const [exercise, setExercise] =
    useState<ExerciseData>(() =>
      generateExercise(
        "Sheng",
        "treble",
        "beginner",
        "C",
        "4/4",
        "simple",
        8,
        72
      )
    );

  const [isPlaying, setIsPlaying] =
    useState(false);

  /* =======================================================
   * Generate
   * ===================================================== */

  function generateNewScore() {
    const newExercise =
      generateExercise(
        mapInstrument(
          instrument
        ),
        mapClef(clef),
        mapDifficulty(
          difficulty
        ),
        mapKeySignature(
          keySignature
        ),
        mapTimeSignature(
          timeSignature
        ),
        mapRhythmLevel(
          rhythmLevel
        ),
        measureCount,
        bpm
      );

    setExercise(
      newExercise
    );
  }

  /* =======================================================
   * Instrument
   * ===================================================== */

  function changeInstrument(
    value: Instrument
  ) {
    setInstrument(value);

    setClef(
      INSTRUMENTS[value].clef
    );
  }

  /* =======================================================
   * Playback
   * ===================================================== */

  async function playScore() {
    if (isPlaying) {
      return;
    }

    setIsPlaying(true);

    await Tone.start();

    const synth =
      new Tone.PolySynth(
        Tone.Synth
      ).toDestination();

    const beatDuration =
      60 / bpm;

    let time = 0;

    const now =
      Tone.now();

    exercise.measures.forEach(
      (measure) => {
        measure.events.forEach(
          (note) => {
            const seconds =
              (note.durationUnits /
                4) *
              beatDuration;

            if (
              !note.rest &&
              note.key
            ) {
              synth.triggerAttackRelease(
                note.key.replace(
                  "/",
                  ""
                ),
                seconds,
                now + time
              );
            }

            time += seconds;
          }
        );
      }
    );

    window.setTimeout(
      () => {
        synth.dispose();

        setIsPlaying(false);
      },
      time * 1000 + 500
    );
  }

  /* =======================================================
   * Render
   * ===================================================== */

  return (
    <div className="app">

      <header className="header">
        <div className="header-content">

          <div className="logo">
            🎼
          </div>

          <div>
            <h1>
              Sight Reading Generator
            </h1>

            <p>
              Practice sight reading.
              Anytime. Anywhere.
            </p>
          </div>

        </div>
      </header>

      <main className="main">

        <section className="hero">

          <h2>
            Randomized Sight Reading
          </h2>

          <p>
            Generate exercises with
            customizable instrument,
            clef, key, meter, rhythm,
            range and tempo.
          </p>

        </section>

        <section className="controls">

          <div className="control-group">
            <label>
              Instrument
            </label>

            <select
              value={instrument}
              onChange={(e) =>
                changeInstrument(
                  e.target.value as Instrument
                )
              }
            >
              {Object.keys(
                INSTRUMENTS
              ).map(
                (name) => (
                  <option
                    key={name}
                    value={name}
                  >
                    {name}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="control-group">
            <label>
              Staff / Clef
            </label>

            <select
              value={clef}
              onChange={(e) =>
                setClef(
                  e.target.value as Clef
                )
              }
            >
              {CLEFS.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="control-group">
            <label>
              Difficulty
            </label>

            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(
                  e.target.value as Difficulty
                )
              }
            >
              <option value="Beginner">
                Beginner
              </option>

              <option value="Intermediate">
                Intermediate
              </option>

              <option value="Advanced">
                Advanced
              </option>
            </select>
          </div>

          <div className="control-group">
            <label>
              Key Signature
            </label>

            <select
              value={keySignature}
              onChange={(e) =>
                setKeySignature(
                  e.target.value
                )
              }
            >
              {KEY_SIGNATURES.map(
                (key) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {key}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="control-group">
            <label>
              Time Signature
            </label>

            <select
              value={timeSignature}
              onChange={(e) =>
                setTimeSignature(
                  e.target.value
                )
              }
            >
              {TIME_SIGNATURES.map(
                (meter) => (
                  <option
                    key={meter}
                    value={meter}
                  >
                    {meter}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="control-group">
            <label>
              Rhythm
            </label>

            <select
              value={rhythmLevel}
              onChange={(e) =>
                setRhythmLevel(
                  e.target.value as RhythmLevel
                )
              }
            >
              <option value="Simple">
                Simple
              </option>

              <option value="Moderate">
                Moderate
              </option>

              <option value="Complex">
                Complex
              </option>
            </select>
          </div>

          <div className="control-group">
            <label>
              Measures
            </label>

            <select
              value={measureCount}
              onChange={(e) =>
                setMeasureCount(
                  Number(
                    e.target.value
                  )
                )
              }
            >
              {[4, 8, 12, 16].map(
                (count) => (
                  <option
                    key={count}
                    value={count}
                  >
                    {count}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="control-group">
            <label>
              Tempo
            </label>

            <div className="tempo">
              <input
                type="range"
                min="40"
                max="180"
                value={bpm}
                onChange={(e) =>
                  setBpm(
                    Number(
                      e.target.value
                    )
                  )
                }
              />

              <strong>
                ♩ = {bpm}
              </strong>
            </div>
          </div>

          <button
            className="generate-button"
            onClick={
              generateNewScore
            }
          >
            🎵 Generate Score
          </button>

        </section>

        <section className="score-card">

          <div className="score-top">

            <div>

              <strong>
                {instrument}
              </strong>

              <span>
                {clef}
              </span>

              <span>
                {keySignature}
              </span>

              <span>
                {timeSignature}
              </span>

              <span>
                ♩ = {bpm}
              </span>

            </div>

            <span>
              {measureCount} Measures
            </span>

          </div>

          <div className="score-scroll">

            <ScoreDisplay
              exercise={exercise}
            />

          </div>

          <div className="buttons">

            <button
              className="play-button"
              onClick={
                playScore
              }
              disabled={
                isPlaying
              }
            >
              {isPlaying
                ? "🔊 Playing..."
                : "▶ Play"}
            </button>

            <button
              className="next-button"
              onClick={
                generateNewScore
              }
            >
              ⏭ New Exercise
            </button>

          </div>

        </section>

        <section className="practice-card">

          <h2>
            How to Practice
          </h2>

          <div className="practice-grid">

            <div>

              <span>
                1
              </span>

              <div>

                <strong>
                  Look Ahead
                </strong>

                <p>
                  Read the music before
                  you begin playing.
                </p>

              </div>

            </div>

            <div>

              <span>
                2
              </span>

              <div>

                <strong>
                  Keep the Tempo
                </strong>

                <p>
                  Try to keep moving
                  without stopping.
                </p>

              </div>

            </div>

            <div>

              <span>
                3
              </span>

              <div>

                <strong>
                  Practice Regularly
                </strong>

                <p>
                  A few minutes every day
                  can make a big difference.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>

      <footer>
        Sight Reading Generator
      </footer>

    </div>
  );
}

export default App;