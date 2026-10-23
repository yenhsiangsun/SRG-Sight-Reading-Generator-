import type {RhythmLevel} from '../music';

// Each figure occupies one actual pulse (a quarter or a dotted quarter).
// Indexing by the phrase's motive position recalls a figure on its return;
// the continuation adds motion without replacing the form with random bars.
const MEDIUM:Record<number,readonly (readonly number[])[]>={
  4:[[2,2],[3,1],[1,1,2],[4],[2,2],[2,1,1],[3,1],[2,2]],
  6:[[2,2,2],[4,2],[1,1,2,2],[2,1,1,2],[2,2,1,1],[3,1,2],[2,3,1],[2,4]],
};
const COMPLEX:Record<number,readonly (readonly number[])[]>={
  4:[[1,1,1,1],[3,1],[1,1,2],[1,2,1],[2,1,1],[1,3],[1,1,1,1],[1,1,2]],
  6:[[1,1,2,1,1],[3,1,1,1],[2,1,1,1,1],[1,1,1,1,2],[1,3,1,1],[1,1,1,3],[1,1,2,1,1],[1,1,3,1]],
};
const DEVELOPMENT:Record<number,readonly (readonly number[])[]>={
  4:[[1,1,1,1],[1,2,1],[1,1,1,1],[1,1,2],[1,3],[1,1,1,1],[2,1,1],[1,1,1,1]],
  6:[[1,1,1,1,1,1],[1,1,2,1,1],[2,1,1,1,1],[1,1,1,1,2],[1,3,1,1],[1,1,1,3],[1,1,1,1,1,1],[1,1,2,1,1]],
};

/** The rhythm grade supplies the ordinary vocabulary throughout the song,
 * not only at its climax. Cadences and beginner long tones are planned outside
 * this function; pitch grade and instrument never enter its choices. */
export function intentRhythmCell(pulse:number,level:Exclude<RhythmLevel,'simple'>,figure:number,developing:boolean):number[] {
  const bank=(level==='medium'?MEDIUM:developing?DEVELOPMENT:COMPLEX)[pulse];
  return bank?[...bank[figure%bank.length]]:[pulse];
}
