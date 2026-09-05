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
  BarlineType,
} from "vexflow";
import * as Tone from "tone";
import "./App.css";

import {
  generateExercise,
  INSTRUMENT_RANGES,
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
 * Custom Range
 *
 * MIDI:
 * C1 = 24
 * C4 = 60
 * C8 = 108
 * ======================================================= */

const RANGE_MIN_MIDI = 24;
const RANGE_MAX_MIDI = 108;

const RANGE_OPTIONS = Array.from(
  {
    length:
      RANGE_MAX_MIDI -
      RANGE_MIN_MIDI +
      1,
  },
  (_, index) =>
    RANGE_MIN_MIDI + index
);

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function midiToNoteLabel(
  midi: number
): string {
  const pitchClass =
    ((midi % 12) + 12) % 12;

  const octave =
    Math.floor(midi / 12) - 1;

  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/* =========================================================
 * UI → Engine
 * ======================================================= */

function mapDifficulty(
  value: Difficulty
): EngineDifficulty {
  if (value === "Beginner") {
    return "beginner";
  }

  if (value === "Intermediate") {
    return "intermediate";
  }

  return "advanced";
}

function mapRhythmLevel(
  value: RhythmLevel
): EngineRhythmLevel {
  if (value === "Simple") {
    return "simple";
  }

  if (value === "Moderate") {
    return "medium";
  }

  return "complex";
}

function mapInstrument(
  value: Instrument
): EngineInstrument {
  return INSTRUMENTS[value].engineInstrument;
}

function mapClef(
  value: Clef
): EngineClef {
  return value;
}

function mapKeySignature(
  value: string
): EngineKeySignature {
  return value as EngineKeySignature;
}

function mapTimeSignature(
  value: string
): EngineTimeSignature {
  return value as EngineTimeSignature;
}

/* =========================================================
 * VexFlow Helpers
 * ======================================================= */

function parseTimeSignature(
  timeSignature: string
): {
  numBeats: number;
  beatValue: number;
} {
  const [numBeats, beatValue] =
    timeSignature
      .split("/")
      .map(Number);

  return {
    numBeats,
    beatValue,
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

function toVexDuration(
  duration:
    | "w"
    | "h"
    | "q"
    | "8"
    | "16",
  rest: boolean
): string {
  return rest
    ? `${duration}r`
    : duration;
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

    const scoreContainer =
      container;

    function drawScore() {
      scoreContainer.innerHTML =
        "";

      const measuresPerRow = 2;

      const rowHeight = 165;

      const horizontalPadding = 10;

      const measureCount =
        exercise.measures.length;

      const rows = Math.ceil(
        measureCount /
          measuresPerRow
      );

      const width = Math.max(
        scoreContainer.clientWidth,
        760
      );

      const height =
        rows * rowHeight + 40;

      const renderer =
        new Renderer(
          scoreContainer,
          Renderer.Backends.SVG
        );

      renderer.resize(
        width,
        height
      );

      const context =
        renderer.getContext();

      const systemWidth =
        width -
        horizontalPadding * 2;

      const measureWidth =
        systemWidth / 2;

      const {
        numBeats,
        beatValue,
      } =
        parseTimeSignature(
          exercise.timeSignature
        );

      for (
        let row = 0;
        row < rows;
        row++
      ) {
        const rowStart =
          row *
          measuresPerRow;

        const rowEnd =
          Math.min(
            rowStart +
              measuresPerRow,
            measureCount
          );

        const rowMeasures =
          exercise.measures.slice(
            rowStart,
            rowEnd
          );

        if (
          rowMeasures.length === 0
        ) {
          continue;
        }

        const y =
          row * rowHeight + 20;

        rowMeasures.forEach(
          (
            measure,
            localIndex
          ) => {
            const globalIndex =
              rowStart +
              localIndex;

            const x =
              horizontalPadding +
              localIndex *
                measureWidth;

            const stave =
              new Stave(
                x,
                y,
                measureWidth
              );

            const isFirstOfRow =
              localIndex === 0;

            const isFirstMeasure =
              globalIndex === 0;

            const isLastMeasure =
              globalIndex ===
              measureCount - 1;

            const isSecondOfRow =
              localIndex === 1;

            /*
             * 每一行第一小節都有譜號。
             */
            if (
              isFirstOfRow
            ) {
              stave.addClef(
                exercise.clef
              );
            }

            /*
             * 每一行第一小節都有調號。
             */
            if (
              isFirstOfRow
            ) {
              stave.addKeySignature(
                exercise.keySignature
              );
            }

            /*
             * 只有第一行有拍號。
             */
            if (
              isFirstMeasure
            ) {
              stave.addTimeSignature(
                exercise.timeSignature
              );
            }

            /*
             * 第一小節不需要開始線。
             */
            if (
              isFirstMeasure
            ) {
              stave.setBegBarType(
                BarlineType.NONE
              );
            } else if (
              isFirstOfRow
            ) {
              stave.setBegBarType(
                BarlineType.SINGLE
              );
            } else {
              stave.setBegBarType(
                BarlineType.NONE
              );
            }

            /*
             * 第二小節不畫自己的左線。
             *
             * 前一小節右邊的線就是
             * 兩個小節之間的 barline。
             */
            if (
              isSecondOfRow
            ) {
              stave.setBegBarType(
                BarlineType.NONE
              );
            }

            /*
             * 最後小節使用雙終止線。
             */
            if (
              isLastMeasure
            ) {
              stave.setEndBarType(
                BarlineType.DOUBLE
              );
            } else {
              stave.setEndBarType(
                BarlineType.SINGLE
              );
            }

            stave.setContext(
              context
            );

            stave.draw();

            /*
             * 第一顆音符與譜號、
             * 調號、拍號之間保留空間。
             */
            const originalNoteStartX =
              stave.getNoteStartX();

            const originalNoteEndX =
              stave.getNoteEndX();

            const leftEngravingSpace =
              isFirstOfRow
                ? 18
                : 10;

            stave.setNoteStartX(
              originalNoteStartX +
                leftEngravingSpace
            );

            /*
             * 建立音符。
             */
            const notes: StaveNote[] =
              measure.events.map(
                (note) => {
                  const staveNote =
                    new StaveNote({
                      clef:
                        exercise.clef,

                      keys: note.rest
                        ? ["b/4"]
                        : [note.key],

                      duration:
                        toVexDuration(
                          note.duration,
                          note.rest
                        ),
                    });

                  if (
                    note.dots > 0
                  ) {
                    for (
                      let i = 0;
                      i < note.dots;
                      i++
                    ) {
                      Dot.buildAndAttach(
                        [staveNote]
                      );
                    }
                  }

                  return staveNote;
                }
              );

            if (
              notes.length === 0
            ) {
              return;
            }

            /*
             * Voice。
             */
            const voice =
              new Voice({
                numBeats,
                beatValue,
              });

            voice.setStrict(false);

            voice.addTickables(
              notes
            );

            /*
             * Beam。
             */
            let beams: Beam[] = [];

            try {
              const groups =
                measure.beamGroups.map(
                  (units) =>
                    unitsToFraction(
                      units
                    )
                );

              beams =
                Beam.applyAndGetBeams(
                  voice,
                  undefined,
                  groups
                );
            } catch {
              beams = [];
            }

            /*
             * Formatter。
             */
            const formatter =
              new Formatter();

            formatter.joinVoices([
              voice,
            ]);

            const noteStartX =
              stave.getNoteStartX();

            const noteEndX =
              originalNoteEndX;

            const rightSafetySpace =
              12;

            const availableWidth =
              noteEndX -
              noteStartX -
              rightSafetySpace;

            const justifyWidth =
              Math.max(
                60,
                availableWidth
              );

            formatter.format(
              [voice],
              justifyWidth
            );

            /*
             * Draw notes。
             */
            voice.draw(
              context,
              stave
            );

            /*
             * Draw beams。
             */
            beams.forEach(
              (beam) => {
                beam
                  .setContext(context)
                  .draw();
              }
            );
          }
        );
      }
    }

    drawScore();

    let resizeObserver:
      ResizeObserver | null =
      null;

    if (
      typeof ResizeObserver !==
      "undefined"
    ) {
      resizeObserver =
        new ResizeObserver(() => {
          drawScore();
        });

      resizeObserver.observe(
        scoreContainer
      );
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
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
  const [
    instrument,
    setInstrument,
  ] =
    useState<Instrument>(
      "Sheng"
    );

  const [
    clef,
    setClef,
  ] =
    useState<Clef>("treble");

  const [
    difficulty,
    setDifficulty,
  ] =
    useState<Difficulty>(
      "Beginner"
    );

  const [
    keySignature,
    setKeySignature,
  ] =
    useState("C");

  const [
    timeSignature,
    setTimeSignature,
  ] =
    useState("4/4");

  const [
    rhythmLevel,
    setRhythmLevel,
  ] =
    useState<RhythmLevel>(
      "Simple"
    );

  const [
    measureCount,
    setMeasureCount,
  ] =
    useState(8);

  const [
    bpm,
    setBpm,
  ] =
    useState(72);

  /* =========================================================
   * ★ 自訂音域
   *
   * 預設仍然使用目前 Sheng 的範圍：
   *
   * C3 = MIDI 48
   * C6 = MIDI 84
   *
   * 但之後完全由使用者控制。
   * ======================================================= */

  const [
    rangeMinMidi,
    setRangeMinMidi,
  ] =
    useState(
      INSTRUMENT_RANGES.Sheng.min
    );

  const [
    rangeMaxMidi,
    setRangeMaxMidi,
  ] =
    useState(
      INSTRUMENT_RANGES.Sheng.max
    );

  /*
   * music.ts 的正確參數順序：
   *
   * instrument
   * clef
   * difficulty
   * keySignature
   * timeSignature
   * rhythmLevel
   * measures
   * tempo
   */
  const [
    exercise,
    setExercise,
  ] =
    useState<ExerciseData>(
      () =>
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

  const [
    isPlaying,
    setIsPlaying,
  ] =
    useState(false);

  const [
    isPaused,
    setIsPaused,
  ] =
    useState(false);

  const synthRef =
    useRef<
      Tone.PolySynth<Tone.Synth> | null
    >(null);

  const scheduledEventsRef =
    useRef<number[]>([]);

  const playbackTimerRef =
    useRef<number | null>(null);

  /* =========================================================
   * Playback Cleanup
   * ======================================================= */

  function disposeSynth() {
    if (
      synthRef.current
    ) {
      synthRef.current.dispose();

      synthRef.current =
        null;
    }
  }

  function clearPlaybackEvents() {
    scheduledEventsRef.current.forEach(
      (id) => {
        try {
          Tone.Transport.clear(
            id
          );
        } catch {
          // ignore
        }
      }
    );

    scheduledEventsRef.current =
      [];
  }

  function stopPlayback() {
    try {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    } catch {
      // ignore
    }

    clearPlaybackEvents();

    if (
      playbackTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        playbackTimerRef.current
      );

      playbackTimerRef.current =
        null;
    }

    disposeSynth();

    setIsPlaying(false);
    setIsPaused(false);
  }

  /* =========================================================
   * Instrument
   * ======================================================= */

  function changeInstrument(
    value: Instrument
  ) {
    setInstrument(value);

    setClef(
      INSTRUMENTS[value].clef
    );

    /*
     * 注意：
     *
     * 這裡故意不自動改變使用者音域。
     *
     * 音域是使用者自己的設定，
     * 不再由樂器名稱決定。
     */
  }

  /* =========================================================
   * Generate New Score
   * ======================================================= */

  function generateNewScore() {
    stopPlayback();

    /*
     * 安全檢查：
     * 最低音必須低於最高音。
     */
    if (
      rangeMinMidi >=
      rangeMaxMidi
    ) {
      return;
    }

    const engineInstrument =
      mapInstrument(
        instrument
      );

    /*
     * ★ 核心：
     *
     * 在產生題目前，把使用者指定的
     * 音域套進目前音樂引擎。
     *
     * 這樣 generateExercise()
     * 產生出來的每個音符都會從
     * 這個範圍裡挑選。
     */
    INSTRUMENT_RANGES[
      engineInstrument
    ] = {
      min: rangeMinMidi,
      max: rangeMaxMidi,
    };

    const newExercise =
      generateExercise(
        engineInstrument,

        mapClef(
          clef
        ),

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

    setIsPaused(false);
  }

  /* =========================================================
   * Play / Resume
   * ======================================================= */

  async function playScore() {
    /*
     * Pause → Resume
     */
    if (
      isPaused &&
      isPlaying
    ) {
      try {
        Tone.Transport.start();
      } catch {
        // ignore
      }

      setIsPaused(false);

      return;
    }

    if (isPlaying) {
      return;
    }

    await Tone.start();

    stopPlayback();

    const synth =
      new Tone.PolySynth(
        Tone.Synth
      ).toDestination();

    synth.volume.value =
      -6;

    synthRef.current =
      synth;

    const beatDuration =
      60 / bpm;

    let time = 0;

    exercise.measures.forEach(
      (measure) => {
        measure.events.forEach(
          (note) => {
            const duration =
              (note.durationUnits /
                4) *
              beatDuration;

            if (
              !note.rest &&
              note.key
            ) {
              const eventId =
                Tone.Transport.schedule(
                  (
                    scheduledTime
                  ) => {
                    if (
                      synthRef.current
                    ) {
                      synthRef.current.triggerAttackRelease(
                        note.key.replace(
                          "/",
                          ""
                        ),
                        duration,
                        scheduledTime
                      );
                    }
                  },
                  time
                );

              scheduledEventsRef.current.push(
                eventId
              );
            }

            time += duration;
          }
        );
      }
    );

    Tone.Transport.bpm.value =
      bpm;

    Tone.Transport.position =
      0;

    Tone.Transport.start();

    setIsPlaying(true);
    setIsPaused(false);

    playbackTimerRef.current =
      window.setTimeout(
        () => {
          stopPlayback();
        },
        time * 1000 + 300
      );
  }

  /* =========================================================
   * Pause
   * ======================================================= */

  function pauseScore() {
    if (!isPlaying) {
      return;
    }

    try {
      Tone.Transport.pause();
    } catch {
      // ignore
    }

    setIsPaused(true);
  }

  /* =========================================================
   * Replay
   * ======================================================= */

  async function replayScore() {
    stopPlayback();

    window.setTimeout(() => {
      void playScore();
    }, 30);
  }

  /* =========================================================
   * Cleanup
   * ======================================================= */

  useEffect(() => {
    return () => {
      try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      } catch {
        // ignore
      }

      disposeSynth();
    };
  }, []);

  /* =========================================================
   * Render
   * ======================================================= */

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            🎼
          </div>

          <div>
            <h1>
              Sight Reading
              Generator
            </h1>

            <p>
              Practice sight
              reading. Anytime.
              Anywhere.
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h2>
            Randomized Sight
            Reading
          </h2>

          <p>
            Generate exercises
            with customizable
            instrument, clef,
            key, meter, rhythm,
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
              ).map((name) => (
                <option
                  key={name}
                  value={name}
                >
                  {name}
                </option>
              ))}
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

          {/* =================================================
           * Lowest Note
           * ================================================= */}

          <div className="control-group">
            <label>
              Lowest Note
            </label>

            <select
              value={rangeMinMidi}
              onChange={(e) => {
                const value =
                  Number(
                    e.target.value
                  );

                if (
                  value <
                  rangeMaxMidi
                ) {
                  setRangeMinMidi(
                    value
                  );
                }
              }}
            >
              {RANGE_OPTIONS.filter(
                (midi) =>
                  midi <
                  rangeMaxMidi
              ).map((midi) => (
                <option
                  key={midi}
                  value={midi}
                >
                  {midiToNoteLabel(
                    midi
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* =================================================
           * Highest Note
           * ================================================= */}

          <div className="control-group">
            <label>
              Highest Note
            </label>

            <select
              value={rangeMaxMidi}
              onChange={(e) => {
                const value =
                  Number(
                    e.target.value
                  );

                if (
                  value >
                  rangeMinMidi
                ) {
                  setRangeMaxMidi(
                    value
                  );
                }
              }}
            >
              {RANGE_OPTIONS.filter(
                (midi) =>
                  midi >
                  rangeMinMidi
              ).map((midi) => (
                <option
                  key={midi}
                  value={midi}
                >
                  {midiToNoteLabel(
                    midi
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* =================================================
           * Range Display
           * ================================================= */}

          <div className="control-group">
            <label>
              Practice Range
            </label>

            <div
              style={{
                minHeight: "44px",
                display: "flex",
                alignItems:
                  "center",
                padding:
                  "0 14px",
                borderRadius:
                  "10px",
                background:
                  "#f3f3f3",
                fontWeight: 700,
                color: "#171717",
                letterSpacing:
                  "0.02em",
              }}
            >
              {midiToNoteLabel(
                rangeMinMidi
              )}{" "}
              —{" "}
              {midiToNoteLabel(
                rangeMaxMidi
              )}
            </div>
          </div>

          <button
            className="generate-button"
            onClick={
              generateNewScore
            }
            disabled={
              rangeMinMidi >=
              rangeMaxMidi
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

              <span>
                {midiToNoteLabel(
                  rangeMinMidi
                )}
                –
                {midiToNoteLabel(
                  rangeMaxMidi
                )}
              </span>
            </div>

            <span>
              {exercise.measures.length}{" "}
              Measures
            </span>
          </div>

          <div className="score-scroll">
            <ScoreDisplay
              exercise={
                exercise
              }
            />
          </div>

          <div className="buttons">
            <button
              className="play-button"
              onClick={
                replayScore
              }
            >
              ↶ Replay
            </button>

            <button
              className="play-button"
              onClick={
                playScore
              }
            >
              {isPlaying &&
              !isPaused
                ? "🔊 Playing..."
                : isPaused
                  ? "▶ Resume"
                  : "▶ Play"}
            </button>

            <button
              className="next-button"
              onClick={
                pauseScore
              }
              disabled={
                !isPlaying ||
                isPaused
              }
            >
              ■ Pause
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
              <span>1</span>

              <div>
                <strong>
                  Look Ahead
                </strong>

                <p>
                  Read the music
                  before you begin
                  playing.
                </p>
              </div>
            </div>

            <div>
              <span>2</span>

              <div>
                <strong>
                  Keep the Tempo
                </strong>

                <p>
                  Try to keep
                  moving without
                  stopping.
                </p>
              </div>
            </div>

            <div>
              <span>3</span>

              <div>
                <strong>
                  Practice Regularly
                </strong>

                <p>
                  A few minutes
                  every day can
                  make a big
                  difference.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        Sight Reading
        Generator
      </footer>
    </div>
  );
}

export default App;