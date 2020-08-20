const settings = require('../../config.json');
const platformBrowser = require('../browser.js');
const { chromium } = require('playwright-chromium');
const path = require('path');
const fs = require('fs');

async function runWebXPRT2015Test(workload, flags) {
  // let workload = settings.workloads[0];
  let args = ["--start-maximized"];
  if (flags !== undefined) {
    args = args.concat(flags);
  }
  platformBrowser.configChromePath(settings);
  console.log('********** Start running WebXPRT2015 tests **********');
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
  await page.waitForTimeout(5 * 1000);

  console.log("********** Running WebXPRT2015 tests... **********");
  // A quick rule-of-thumb is to count the number of await's or then's
  // happening in your code and if there's more than one then you're
  // probably better off running the code inside a page.evaluate call.
  // The reason here is that all async actions have to go back-and-forth
  // between Node's runtime and the browser's, which means all the JSON
  // serialization and deserializiation. While it's not a huge amount of
  // parsing (since it's all backed by WebSockets) it still is taking up
  // time that could better be spent doing something else.
  await page.evaluate(() => {
    const startButton = document.querySelector('#imgRunAll');
    startButton.click();
    // A navigation happens after click, execution context was destroyed
    // So later code will throw error
    // await new Promise(resolve => setTimeout(resolve, 8.5 * 60 * 1000));
  });
  // await page.click('#imgRunAll');
  // await page.waitForTimeout(8.5 * 60 * 1000);
  await new Promise(resolve => setTimeout(resolve, 8.5 * 60 * 1000));
  await page.waitForSelector('#page > div:nth-child(2) > fieldset > div',
    {timeout: 10 * 60 * 1000}
  );

  console.log("********** Running WebXPRT2015 tests completed **********");
  let scores = {};
  const scoreHandler = await page.$('#result1 > div > div.scoreText');
  const score = await scoreHandler.evaluate(element => element.textContent);
  console.log('********** WebXPRT2015 tests score: **********');
  console.log(`********** ${score}  **********`);
  scores['Total Score'] = score;

  const photoEnhancementElement = await page.$('#result2 > div > div.testinfoDivNoHeader > div:nth-child(1) > div > div > div.resultsworkload-duration');
  const photoEnhancementScore = await photoEnhancementElement.evaluate(element => element.innerText);
  scores['Photo Enhancement (ms)'] = photoEnhancementScore.split(" ")[0];

  const organizeAlbumElement = await page.$('#result2 > div > div.testinfoDivNoHeader > div:nth-child(2) > div > div > div.resultsworkload-duration');
  const organizeAlbumScore = await organizeAlbumElement.evaluate(element => element.innerText);
  scores['Organize Album using AI (ms)'] = organizeAlbumScore.split(" ")[0];

  const stockOptionElement = await page.$('#result2 > div > div.testinfoDivNoHeader > div:nth-child(3) > div > div > div.resultsworkload-duration');
  const stockOptionScore = await stockOptionElement.evaluate(element => element.innerText);
  scores['Stock Option Pricing (ms)'] = stockOptionScore.split(" ")[0];

  const localNoteElement = await page.$('#result2 > div > div.testinfoDivNoHeader > div:nth-child(4) > div > div > div.resultsworkload-duration');
  const localNoteScore = await localNoteElement.evaluate(element => element.innerText);
  scores['Local Notes (ms)'] = localNoteScore.split(" ")[0];

  const salesGraphsElement = await page.$('#result2 > div > div.testinfoDivNoHeader > div:nth-child(5) > div > div > div.resultsworkload-duration');
  const salesGraphsScore = await salesGraphsElement.evaluate(element => element.innerText);
  scores['Sales Graphs (ms)'] = salesGraphsScore.split(" ")[0];

  const exploreDNASequencingElement = await page.$('#result2 > div > div.testinfoDivNoHeader > div:nth-child(6) > div > div > div.resultsworkload-duration');
  const exploreDNASequencingScore = await exploreDNASequencingElement.evaluate(element => element.innerText);
  scores['Explore DNA Sequencing (ms)'] = exploreDNASequencingScore.split(" ")[0];

  console.log('********** Detailed scores: **********');
  console.log(scores);

  await browser.close();

  return Promise.resolve({
    date: Date(),
    scores: scores
  });
}

module.exports = runWebXPRT2015Test;
