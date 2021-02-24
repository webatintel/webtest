'use strict';

const fs = require('fs');
const { chromium } = require('playwright');
const report = require('./report.js')
const util = require('./util.js')

function getUrl(i) {
  let fullUrl = `${util.url}?task=performance&warmup=${util.warmupTimes}&run=${util.runTimes}`;
  for (let index in util.parameters) {
    if (util.benchmarks[i][index]) {
      fullUrl += `&${util.parameters[index]}=${util.benchmarks[i][index]}`;
    }
  }
  return fullUrl;
}

async function runBenchmark(i) {
  if (util.dryrun) {
    return Promise.resolve(0.1);
  }

  const browser = await chromium.launchPersistentContext(util.userDataDir, {
    headless: false,
    executablePath: util['browserPath'],
    viewport: null,
    ignoreHTTPSErrors: true,
    args: util['browserArgs'],
  });
  const page = await browser.newPage();
  await page.goto(getUrl(i));

  //await page.evaluate(async () => {
  //  const runButton = document.querySelector('#gui > ul > li:nth-child(5) > div > span');
  //  runButton.click();
  //  await new Promise(resolve => setTimeout(resolve, util.timeout));
  //});

  try {
    await page.waitForSelector('#timings > tbody > tr:nth-child(8) > td:nth-child(2)', { timeout: util.timeout });
  } catch (err) {
    await browser.close();
    return Promise.resolve(-1);
  }
  const resultElem = await page.$('#timings > tbody > tr:nth-child(8) > td:nth-child(2)');
  let result = await resultElem.evaluate(element => element.textContent);
  await browser.close();

  result = parseFloat(result.replace(' ms', ''));
  return Promise.resolve(result);
}

async function runBenchmarks() {
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
  let results = [];
  for (let i = 0; i < benchmarksLen; i++) {
    if (indexes.indexOf(i) < 0) {
      continue;
    }
    let benchmark = util.benchmarks[i];
    let testName = benchmark.slice(0, -1).join('-');
    let backend = benchmark[benchmark.length - 1];
    if (testName != previousTestName) {
      results.push([testName].concat(Array(util.backends.length).fill(0)));
      previousTestName = testName;
    }
    let result = await runBenchmark(i);
    results[results.length - 1][util.backends.indexOf(backend) + 1] = result;
    console.log(`[${i + 1}/${benchmarksLen}] ${benchmark}: ${result}ms`);
  }
  await report(results, startTime);
}

module.exports = {
  runBenchmarks: runBenchmarks
}
