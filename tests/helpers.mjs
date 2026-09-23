import fs from 'node:fs';
import vm from 'node:vm';
import pathUtil from 'node:path';
import ts from 'typescript';

export function loadModule(path, seed = 90210, source = fs.readFileSync(path, 'utf8'), modules = {}, globals = {}) {
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cache = new Map();
  function evaluate(filename, text) {
    const absolute=pathUtil.resolve(filename);
    if(cache.has(absolute)) return cache.get(absolute).exports;
    const module={exports:{}};cache.set(absolute,module);
    const context=vm.createContext({...globals,exports:module.exports,module,Math:math,require:(name)=>{
      if(name in modules) return modules[name];
      if(!name.startsWith('.')) throw Error('Unexpected import: '+name);
      const target=pathUtil.resolve(pathUtil.dirname(absolute),name)+'.ts';
      return evaluate(target,fs.readFileSync(target,'utf8'));
    }});
    const {outputText}=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}});
    vm.runInContext(outputText,context,{filename});return module.exports;
  }
  return evaluate(path,source);
}

export function baselineExercises(engine) {
  const results = [];
  for (const key of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db']) {
    // This fixture freezes the original eight meters, independently of additions
    // to the current app catalog (new meters have their own regression coverage).
    for (const meter of ['2/4','3/4','4/4','5/4','6/8','7/8','9/8','12/8']) {
      for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
        for (const rhythm of ['simple', 'medium', 'complex']) {
          results.push(engine.generateExercise('Sheng', 'treble', difficulty, key, meter, rhythm, 4, 72));
        }
      }
    }
  }
  return results;
}
