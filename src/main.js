'use strict';

const { exit } = require('yargs');
const benchmark = require('./benchmark.js');
const config = require('./config.js');
const util = require('./util.js');

util.args = require('yargs')
  .usage('node $0 [args]')
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

function parseArgs() {
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
    await benchmark.runBenchmarks();
  }
}

main();
