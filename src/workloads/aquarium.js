const settings = require('../../config.json');
const platformBrowser = require('../browser.js');
const { chromium } = require('playwright-chromium');
const path = require('path');
const fs = require('fs');

async function runAquariumTest(workload, flags) {
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
    await new Promise(resolve => setTimeout(resolve, 320 * 1000));
  });

  const endLabelElem = await page.$('#benchMessage');
  const endLabelText = await endLabelElem.evaluate(element => element.textContent);
  const scoreElem = await page.$('#avgFps');
  const score = await scoreElem.evaluate(element => element.textContent);

  if (endLabelText !== "Benchmark Finished") {
    return Promise.reject("Unknown Error: test didn't done before 320s' timeout"); 
  }
  let scores = {};

  console.log(`********** Running ${workload.name} tests completed **********`);
  console.log(`********** ${workload.name} tests score: **********`);
  console.log(`********** ${score}  **********`);
  scores['Total Score'] = score;

  await browser.close();

  return Promise.resolve({
    date: Date(),
    scores: scores
  });
}

module.exports = runAquariumTest;
