#!/usr/bin/env node
'use strict';

const PARSING_TIMEOUT = 1000;
const EXECUTION_TIMEOUT = 5000;

const vm = require('vm');
const fs = require('fs').promises;
const concolor = require('concolor');

const curDir = process.cwd();
const dir = curDir + (curDir.includes('/Exercises') ? '' : '/Exercises');

const prepareSandbox = () => {
  const context = { module: {}, console };
  context.global = context;
  const sandbox = vm.createContext(context);
  return sandbox;
};

const loadFile = async file => {
  const fileName = dir + '/' + file;
  const data = await fs.readFile(fileName, 'utf8');
  const isTest = file.includes('.test');
  const src = isTest ? `() => ( ${data} );` : `() => { ${data} };`;
  let script;
  try {
    const options = { timeout: PARSING_TIMEOUT };
    script = new vm.Script(src, options);
  } catch (e) {
    console.dir(e);
    console.log('Parsing error');
    process.exit(1);
  }
  const sandbox = prepareSandbox();
  let exported, result;
  try {
    const options = { timeout: EXECUTION_TIMEOUT };
    const f = script.runInNewContext(sandbox, options);
    result = f();
    exported = sandbox.module.exports;
  } catch (e) {
    console.dir(e);
    console.log('Execution timeout');
    process.exit(1);
  }
  return exported ? exported : result;
};

const countLines = s => {
  let count = 1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\n') count++;
  }
  return count;
};

const executeTest = async file => {
  const jsFile = `./${file}.js`;
  const js = await loadFile(jsFile);
  const testFile = `./${file}.test`;
  const test = await loadFile(testFile);
  const target = js[test.name];
  if (!target) throw new Error('No implementation detected');
  if (typeof target === 'function') {
    if (target.name !== test.name) {
      throw new Error(`Function ${test.name} is not found`);
    }
  }
  const targetLength = target.toString().length;
  const lines = countLines(target.toString());
  const msgLength = concolor`  Length: ${targetLength}(b,white), `;
  const msgLines = concolor`lines: ${lines}(b,white)`;
  console.log(msgLength + msgLines);
  const [minLength, maxLength] = test.length;
  if (targetLength > maxLength) throw new Error('Solution is too long');
  if (targetLength < minLength) throw new Error('Solution is too short');
  let casesResult = 'No test cases';
  if (test.cases) {
    for (const callCase of test.cases) {
      const expected = JSON.stringify(callCase.pop());
      const result = JSON.stringify(target(...callCase));
      if (result !== expected) {
        throw new Error(`Case failed: expected ${expected}, result: ${result}`);
      }
    }
    casesResult = concolor`Passed cases: ${test.cases.length}(b,white)`;
  }
  if (test.test) {
    test.test(target);
  }
  console.log(concolor`  Status: ${'Passed'}(b,white), ${casesResult}(green)`);
};

(async () => {
  console.log(concolor.white('How Programming Works'));
  console.log(concolor.info('Labs Auto Checker\n'));
  const files = await fs.readdir(dir);
  const tests = files
    .filter(file => file.endsWith('.test'))
    .map(file => file.substring(0, file.length - '.test'.length));
  for (const test of tests) {
    console.log(concolor`\nTest ${test}(b,white)`);
    try {
      await executeTest(test);
    } catch (e) {
      console.log(concolor`  Error: ${e.message}(b,red)`);
    }
  }
})();
