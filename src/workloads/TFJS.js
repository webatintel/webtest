const settings = require('../../config.json');
const platformBrowser = require('../browser.js');
const {chromium} = require('playwright-chromium');
const path = require('path');
const fs = require('fs');

async function runTensorflowTest(workload, flags) {
  let args = ['--start-maximized'];
  if (flags !== undefined) {
    args = args.concat(flags);
  }
  platformBrowser.configChromePath(settings);
  const userDataDir = path.join(process.cwd(), 'out', 'userData');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: settings.chrome_path,
    viewport: null,
    ignoreHTTPSErrors: true,
    args: args
  });
  const page = await browser.newPage();
  browser.setDefaultNavigationTimeout(3 * 60 * 1000);
  await page.goto(workload.url, {waitUntil: 'networkidle'});
  await page.waitForTimeout(3 * 1000);
  // Waits for result elements
  await page.waitForSelector(
      '#timings > tbody > tr:nth-child(8) > td:nth-child(2)',
      {timeout: 10 * 60 * 1000});

  const resultElem =
      await page.$('#timings > tbody > tr:nth-child(8) > td:nth-child(2)');
  const result = await resultElem.evaluate(element => element.textContent);
  let results = {};
  console.log(`Result: ${result}`);
  results['Total Score'] = result;

  const resultBody = await page.$('#timings > tbody');
  const resultLength =
      await resultBody.evaluate(element => element.rows.length);
  for (let i = 1; i < resultLength; i++) {
    let typeSelector =
        `#timings > tbody > tr:nth-child(${i}) > td:nth-child(1)`;
    let valueSelector =
        `#timings > tbody > tr:nth-child(${i}) > td:nth-child(2)`;
    const typeElem = await page.$(typeSelector);
    const valueElem = await page.$(valueSelector);
    const type = await typeElem.evaluate(element => element.innerText);
    const value = await valueElem.evaluate(element => element.innerText);
    results[type] = value;
  }

  // console.log('********** Detailed results: **********');
  // console.log(results);

  await browser.close();

  return Promise.resolve({date: Date(), results: results});
}

module.exports = runTensorflowTest;
