const settings = require('../../config.json');
const platformBrowser = require('../browser.js');
const { chromium } = require('playwright-chromium');
const path = require('path');
const fs = require('fs');

async function runBasemarkTest(workload, flags) {
  let args = ["--start-maximized"];
  if (flags !== undefined) {
    args = args.concat(flags);
  }
  platformBrowser.configChromePath(settings);
  console.log(`********** Start running ${workload.name} tests **********`);
  const userDataDir = path.join(process.cwd(), 'userData');
  if (fs.existsSync(userDataDir)) {
    fs.rmdirSync(userDataDir, { recursive: true });
  }
  fs.mkdirSync(userDataDir);
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: settings.chrome_path,
    viewport: null,
    args: args
  });
  const page = await browser.newPage();
  console.log(`********** Going to URL: ${workload.url} **********`);
  await page.goto(workload.url, { waitUntil: "networkidle" });
  const configButton = await page.$('#extended-information > div:nth-child(2) > div.disabled.panel-heading.accordion-heading > div > a');
  await configButton.click();
  const suiteSelect = await page.$('#suite-config > div:nth-child(2) > select');
  await suiteSelect.type('Graphics Suite', {delay: 100});
  await page.waitForTimeout(3 * 1000);
  console.log(`********** Running ${workload.name} tests... **********`);
  // A quick rule-of-thumb is to count the number of await's or then's
  // happening in your code and if there's more than one then you're
  // probably better off running the code inside a page.evaluate call.
  // The reason here is that all async actions have to go back-and-forth
  // between Node's runtime and the browser's, which means all the JSON
  // serialization and deserializiation. While it's not a huge amount of
  // parsing (since it's all backed by WebSockets) it still is taking up
  // time that could better be spent doing something else.
  await page.evaluate(async () => {
    const startButton = document.querySelector('#start');
    startButton.click();
  });
  await new Promise(resolve => setTimeout(resolve, 2.5 * 60 * 1000));
  // Waits for result elements
  await page.waitForSelector('#test-run-0 > div > div:nth-child(4) > div.col-xs-6.col-sm-6.col-md-6.score', { timeout: 10 * 60 * 1000 });
  console.log(`********** Running ${workload.name} tests completed **********`);

  const scoreElem = await page.$('#test-run-0 > div > div:nth-child(4) > div.col-xs-6.col-sm-6.col-md-6.score');
  const score = await scoreElem.evaluate(element => element.textContent);
  let scores = {};
  console.log(`********** ${workload.name} tests score: **********`);
  console.log(`********** ${score}  **********`);
  scores['Total Score'] = score;
  scores['Graphics Suite'] = score;
  const subcaseList = [
    'WebGL 1.0.2 Test',
    'WebGL 2.0 Test',
    'Shader Pipeline Test',
    'Draw-call Stress Test',
    'Geometry Stress Test',
    'Canvas Test',
    'SVG Test'
  ];

  for (let i = 0; i < subcaseList.length; i ++) {
    let selector = `#test-run-0 > div > div:nth-child(4) > div.col-xs-12.col-sm-12.col-md-12.suite-results-breakdown > div:nth-child(${i+1}) > div.col-xs-2.col-sm-2.col-md-2.score`;
    const subcaseElem = await page.$(selector);
    const subcaseScore = await subcaseElem.evaluate(element => element.innerText);
    scores[subcaseList[i]] = subcaseScore;
  }

  console.log('********** Detailed scores: **********');
  console.log(scores);

  await browser.close();

  return Promise.resolve({
    date: Date(),
    scores: scores
  });
}

module.exports = runBasemarkTest;
