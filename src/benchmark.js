'use strict';

const fs = require('fs');
const style = require('./style.js')
const util = require('./util.js')

function getUrl(i, task) {
  let fullUrl = `${util.url}?task=${task}&warmup=${util.warmupTimes}&run=${util.runTimes}`;
  for (let index in util.parameters) {
    if (util.benchmarks[i][index]) {
      fullUrl += `&${util.parameters[index]}=${util.benchmarks[i][index]}`;
    }
  }
  return fullUrl;
}

async function runBenchmark(i, selectorValues, task) {
  // TODO: dryrun is not tested.
  if (util.dryrun) {
    return Promise.resolve(0.1);
  }

  const [context, page] = await style.gotoURL(getUrl(i, task), util);
  if (context == -1) {
    return null;
  }

  let results = [];
  for (const selectorValue of selectorValues) {
    results[selectorValue] = await style.queryTable(page, selectorValue, util.timeout);
  }

  await context.close();
  return results;
}

async function run(selectorValues, task) {
  let startTime = new Date();
  let benchmarksLen = util.benchmarks.length;
  let target = util.args.target;
  if (target === undefined) {
    target = '0-' + (benchmarksLen - 1);
  }
  let indexes = [];
  let fields = target.split(',');

  for (let field of fields) {
    if (field.indexOf('-') > -1) {
      for (let i = parseInt(field.split('-')[0]); i <= parseInt(field.split('-')[1]); i++) {
        indexes.push(parseInt(i));
      }
    } else {
      indexes.push(parseInt(field));
    }
  }

  if (!fs.existsSync(util.resultsDir)) {
    fs.mkdirSync(util.resultsDir, { recursive: true });
  }

  let previousTestName = '';
  let results = {};
  selectorValues.forEach(function (selectorValue) {
    results[selectorValue] = [];
  });
  for (let i = 0; i < benchmarksLen; i++) {
    if (indexes.indexOf(i) < 0) {
      continue;
    }
    let benchmark = util.benchmarks[i];
    let testName = benchmark.slice(0, -1).join('-');
    let backend = benchmark[benchmark.length - 1];
    if (testName != previousTestName) {
      selectorValues.forEach(function (selectorValue) {
        results[selectorValue].push([testName].concat(Array(util.backends.length).fill(0)));
      });
      previousTestName = testName;
    }
    let result = await runBenchmark(i, selectorValues, task);
    selectorValues.forEach(function (selectorValue) {
      results[selectorValue][results[selectorValue].length - 1][util.backends.indexOf(backend) + 1] = result != null ? result[selectorValue] : -1;
    });
    console.log(`[${i + 1}/${benchmarksLen}] ${benchmark}: ${result[selectorValues[0]]}ms`);
  }
  return results;
}

module.exports = {
  run: run
}
