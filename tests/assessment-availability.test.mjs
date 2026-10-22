import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadModule} from './helpers.mjs';

test('the bundled release policy rejects assessment and stale or URL-like mode requests', () => {
  const flags=loadModule('src/featureFlags.ts');
  assert.equal(flags.ASSESSMENT_MODE_ENABLED,false);
  const {availablePracticeMode}=loadModule('src/practice/practiceMode.ts');
  for(const request of ['practice','test','?mode=test','#test',null,undefined,{mode:'test'}]) {
    assert.equal(availablePracticeMode(request),'practice');
  }
});

test('assessment can return only through a changed bundled policy', () => {
  const {availablePracticeMode}=loadModule('src/practice/practiceMode.ts',90210,undefined,{
    '../featureFlags':{ASSESSMENT_MODE_ENABLED:true},
  });
  assert.equal(availablePracticeMode('test'),'test');
  assert.equal(availablePracticeMode('practice'),'practice');
  assert.equal(availablePracticeMode('unknown'),'practice');
});

test('the App guards the only mode selector and normalizes both requested and rendered modes', () => {
  const source=fs.readFileSync('src/App.tsx','utf8');
  const tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let selectorCount=0;
  const visit=node=>{
    if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(attribute=>
      ts.isJsxAttribute(attribute)&&attribute.name.getText(tree)==='className'&&attribute.initializer?.text==='practice-modes')) {
      selectorCount++;
      assert.ok(ts.isBinaryExpression(node.parent));
      assert.equal(node.parent.left.getText(tree),'ASSESSMENT_MODE_ENABLED');
      assert.equal(node.parent.operatorToken.kind,ts.SyntaxKind.AmpersandAmpersandToken);
    }
    ts.forEachChild(node,visit);
  };
  visit(tree);
  assert.equal(selectorCount,1);
  assert.match(source,/const mode=availablePracticeMode\(requestedMode\)/);
  assert.match(source,/setRequestedMode\(availablePracticeMode\(value\)\)/);
  assert.equal((source.match(/setRequestedMode\(/g)??[]).length,1);
  assert.match(source,/<TuningFork /,'independent tuning fork stays available');
  assert.match(source,/<PracticeTools /,'normal practice tools remain');
});
