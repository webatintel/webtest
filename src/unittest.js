'use strict';

const fs = require('fs');
const { chromium } = require('playwright');
const util = require('./util.js')

async function run() {
  if (!fs.existsSync(util.resultsDir)) {
    fs.mkdirSync(util.resultsDir, { recursive: true });
  }

  const { spawnSync } = require('child_process');
  let startTime = new Date();
  let timestamp = util.getTimestamp(startTime);
  const logFile = timestamp + '.txt';
  process.chdir(util.tfjsdir);

  process.env['CHROME_BIN'] = util.browserPath;
  let cmd = spawnSync('cmd', ['/c', `yarn test > ${logFile}`],
    { env: process.env, stdio: [process.stdin, process.stdout, process.stderr] });

  let results = [];
  let failIndex = 0;
  var lines = require('fs').readFileSync(logFile, 'utf-8')
    .split('\n')
    .filter(Boolean);

  lines.forEach(function (line) {
    console.log(line);
    const executed = line.includes(': Executed');
    if (line.includes('FAILED') && executed === false) {
      if (failIndex < 20) {
        results[failIndex] = line;
      }
      failIndex++;
    } else if (executed) {
      results[results.length] = line;
    }
  })
  return results;
}
module.exports = {
  run: run
}
