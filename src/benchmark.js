'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const util = require('./util.js')

function cartesianProduct(arr) {
  return arr.reduce(function (a, b) {
    return a.map(function (x) {
      return b.map(function (y) {
        return x.concat([y]);
      })
    }).reduce(function (a, b) { return a.concat(b) }, [])
  }, [[]])
}

function getDuration(start, end) {
  let diff = Math.abs(start - end);
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
}

function intersect(a, b) {
  return a.filter(v => b.includes(v));
}

async function startContext() {
  if (!util.dryrun) {
    let context = await chromium.launchPersistentContext(util.userDataDir, {
      headless: false,
      executablePath: util['browserPath'],
      viewport: null,
      ignoreHTTPSErrors: true,
      args: util['browserArgs'],
    });
    let page = await context.newPage();
    return [context, page];
  } else {
    return [undefined, undefined];
  }
}

async function closeContext(context) {
  if (!util.dryrun) {
    await context.close();
  }
}

async function runBenchmark(target) {
  let startTime = new Date();

  // get benchmarks
  let benchmarks = [];
  let benchmarkJson = path.join(path.resolve(__dirname), 'benchmark.json');
  let targetBenchmarks = JSON.parse(fs.readFileSync(benchmarkJson));
  let validBenchmarkNames = [];
  if ('benchmark' in util.args) {
    validBenchmarkNames = util.args['benchmark'].split(',');
  } else {
    for (let benchmark of targetBenchmarks) {
      validBenchmarkNames.push(benchmark['benchmark']);
    }
  }
  for (let benchmark of targetBenchmarks) {
    let benchmarkName = benchmark['benchmark'];
    if (!validBenchmarkNames.includes(benchmarkName)) {
      continue;
    }
    if ('backend' in util.args) {
      benchmark['backend'] = intersect(benchmark['backend'], util.args['backend'].split(','));
    }
    if (target == 'conformance') {
      benchmark['backend'] = intersect(benchmark['backend'], 'webgpu');
    }
    let seqArray = [];
    for (let p of util.parameters) {
      seqArray.push(p in benchmark ? (Array.isArray(benchmark[p]) ? benchmark[p] : [benchmark[p]]) : ['']);
    }
    benchmarks = benchmarks.concat(cartesianProduct(seqArray));
  }

  // run benchmarks
  let benchmarksLen = benchmarks.length;
  let previousBenchmarkName = '';
  let results = []; // format: testName, warmup_webgpu, average_webgpu, best_webgpu, warmup_webgl, average_webgl, best_webgl, warmup_wasm, average_wasm, best_wasm
  let defaultValue;
  if (target == 'conformance') {
    defaultValue = 'false';
  } else if (target == 'performance') {
    defaultValue = -1;
  }
  let metrics = util.targetMetrics[target];
  let metricsLength = metrics.length;
  let context;
  let page;
  if (!('new-context' in util.args)) {
    [context, page] = await startContext();
  }

  let task = '';
  if (target == 'conformance') {
    task = 'correctness';
  } else if (target == 'performance') {
    task = 'performance';
  }
  let warmupTimes;
  if ('warmup-times' in util.args) {
    warmupTimes = parseInt(util.args['warmup-times']);
  } else {
    warmupTimes = 50;
  }
  let runTimes;
  if ('run-times' in util.args) {
    runTimes = parseInt(util.args['run-times']);
  } else {
    runTimes = 50;
  }
  let needWasmStatus = true;
  for (let i = 0; i < benchmarksLen; i++) {
    if ('new-context' in util.args) {
      [context, page] = await startContext();
    }
    // prepare result placeholder
    let benchmark = benchmarks[i];
    let benchmarkName = benchmark.slice(0, -1).join('-');
    if (benchmarkName != previousBenchmarkName) {
      results.push([benchmarkName].concat(Array(util.targetBackends[target].length * metricsLength).fill(defaultValue)));
      previousBenchmarkName = benchmarkName;
    }

    if (util.dryrun) {
      for (let i = 1; i < results[results.length - 1].length; i++) {
        if (target == 'conformance') {
          results[results.length - 1][i] = 'true';
        } else if (target == 'performance') {
          results[results.length - 1][i] = i;
        }
      }
    } else {
      // get url
      let url = `${util.url}?task=${task}&warmup=${warmupTimes}&run=${runTimes}`;
      for (let index = 0; index < util.parameters.length; index++) {
        if (benchmarks[i][index]) {
          url += `&${util.parameters[index]}=${benchmarks[i][index]}`;
        }
      }

      // get result
      await page.goto(url);
      let metricIndex = 0;
      let typeIndex = 1;
      let backend = benchmark[benchmark.length - 1];
      while (metricIndex < metricsLength) {
        let selector = '#timings > tbody > tr:nth-child(' + typeIndex + ')';
        try {
          await page.waitForSelector(selector, { timeout: util.timeout });
        } catch (err) {
          break;
        }
        const type = await page.$eval(selector + ' > td:nth-child(1)', el => el.textContent);
        if (type.includes(metrics[metricIndex])) {
          let result = await page.$eval(selector + ' > td:nth-child(2)', el => el.textContent);
          if (target == 'performance') {
            result = parseFloat(result.replace(' ms', ''));
          }
          results[results.length - 1][util.targetBackends[target].indexOf(backend) * metricsLength + metricIndex + 1] = result;
          metricIndex += 1;
        }
        typeIndex += 1;
      }

      if (needWasmStatus && target == 'performance' && backend == 'wasm') {
        let status = await page.$eval('#env', el => el.textContent);
        let match = status.match('WASM_HAS_MULTITHREAD_SUPPORT: (.*)  WASM_HAS_SIMD_SUPPORT: (.*)  WEBGL_CPU_FORWARD');
        util.wasmMultithread = match[1];
        util.wasmSIMD = match[2];
        needWasmStatus = false;
      }
    }
    console.log(`[${i + 1}/${benchmarksLen}] ${benchmark}: ${results[results.length - 1]}`);

    if ('new-context' in util.args) {
      await closeContext(context);
    }
  }

  if (!('new-context' in util.args)) {
    await closeContext(context);
  }

  results.push(getDuration(startTime, new Date()))
  return Promise.resolve(results);
}

module.exports = runBenchmark;
