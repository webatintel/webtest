'use strict';

const { exit } = require('yargs');
const config = require('./config.js');
const fs = require('fs');
const path = require('path');
const util = require('./util.js');
const style = require('./style.js');
const { runAllTests } = require('./test.js');

util.args = require('yargs')
  .usage('node $0 [args]')
  .option('backend', {
    type: 'string',
    describe: 'backend to run, splitted by comma',
  })
  .option('benchmark', {
    type: 'string',
    describe: 'benchmark to run, splitted by comma',
  })
  .option('benchmark-file', {
    type: 'string',
    describe: 'benchmark file, default to benchmark.json',
  })
  .option('dryrun', {
    type: 'boolean',
    describe: 'dryrun the test',
  })
  .option('email', {
    alias: 'e',
    type: 'string',
    describe: 'email to',
  })
  .option('list', {
    type: 'boolean',
    describe: 'list benchmarks',
  })
  .option('repeat', {
    type: 'number',
    describe: 'repeat times',
    default: 1,
  })
  .option('target', {
    type: 'string',
    describe: 'index of benchmarks to run, e.g., 1-2,5,6',
  })
  .option('run-times', {
    type: 'integer',
    describe: 'run times',
  })
  .option('url', {
    type: 'string',
    describe: 'url to test against',
  })
  .option('warmup-times', {
    type: 'integer',
    describe: 'warmup times',
  })
  .example([
    ['node $0 --email <email>', 'send report to <email>'],
  ])
  .help()
  .argv;

function cartesianProduct(arr) {
  return arr.reduce(function (a, b) {
    return a.map(function (x) {
      return b.map(function (y) {
        return x.concat([y]);
      })
    }).reduce(function (a, b) { return a.concat(b) }, [])
  }, [[]])
}

function intersect(a, b) {
  return a.filter(v => b.includes(v));
}

function parseArgs() {
  let benchmarkFile = '';
  if ('benchmark-file' in util.args) {
    benchmarkFile = util.args['benchmark-file'];
  } else {
    benchmarkFile = path.join(path.resolve(__dirname), 'benchmark.json');
  }
  let rawBenchmarks = JSON.parse(fs.readFileSync(benchmarkFile));
  let validBenchmarkNames = [];
  if ('benchmark' in util.args) {
    validBenchmarkNames = util.args['benchmark'].split(',');
  } else {
    for (let benchmark of rawBenchmarks) {
      validBenchmarkNames.push(benchmark['benchmark']);
    }
  }

  let benchmarks = [];
  for (let benchmark of rawBenchmarks) {
    let benchmarkName = benchmark['benchmark'];
    if (!validBenchmarkNames.includes(benchmarkName)) {
      continue;
    }
    if ('backend' in util.args) {
      benchmark['backend'] = intersect(benchmark['backend'], util.args['backend'].split(','));
    }
    let seqArray = [];
    for (let p of util.parameters) {
      seqArray.push(p in benchmark ? (Array.isArray(benchmark[p]) ? benchmark[p] : [benchmark[p]]) : ['']);
    }
    benchmarks = benchmarks.concat(cartesianProduct(seqArray));
  }
  util.benchmarks = benchmarks;

  if ('list' in util.args) {
    for (let index in util.benchmarks) {
      console.log(`${index}: ${util.benchmarks[index]}`);
    }
    exit(0);
  }

  if ('dryrun' in util.args) {
    util.dryrun = true;
  } else {
    util.dryrun = false;
  }

  if ('run-times' in util.args) {
    util.runTimes = parseInt(util.args['run-times']);
  } else {
    util.runTimes = 50;
  }

  if ('warmup-times' in util.args) {
    util.warmupTimes = parseInt(util.args['warmup-times']);
  } else {
    util.warmupTimes = 50;
  }

  if ('tfjsdir' in util.args) {
    util.tfjsdir = util.args['tfjsdir'];
  } else {
    util.tfjsdir = 'C:/workspace/tfjsdaily/tfjs/tfjs-backend-webgpu';
  }

  if ('url' in util.args) {
    util.url = util.args['url'];
  } else {
    util.url = 'http://wp-27.sh.intel.com/workspace/project/tfjswebgpu/tfjs/e2e/benchmarks/local-benchmark/';
  }
}

async function main() {
  parseArgs();
  await config();
  for (let i = 0; i < util.args['repeat']; i++) {
    if (util.args['repeat'] > 1) {
        console.log(`== Test round ${i + 1}/${util.args['repeat']} ==`);
    }
    await runAllTests();
  }
}

main();
