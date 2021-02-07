const {chromium} = require('playwright-chromium');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const xl = require('excel4node');
const settings = require('../config.json');
const platformBrowser = require('./browser.js');


async function getAllFlags() {
  platformBrowser.configChromePath(settings);
  let nameList = [];
  let flagList = [];
  let descList = [];
  let platformList = [];
  let statusList = [];
  const browser = await chromium.launch(
      {headless: false, executablePath: settings.chrome_path});
  const page = await browser.newPage();
  await page.goto('chrome://flags');
  const flagElements = await page.$$(
      '#tab-content-available > div > div.experiment > div.experiment-default.flex-container > div.flex > a');
  const nameElements = await page.$$(
      '#tab-content-available > div > div.experiment > div.experiment-default.flex-container > div.flex > h3.experiment-name');
  const descElements = await page.$$(
      '#tab-content-available > div > div.experiment > div.experiment-default.flex-container > div.flex > p > span:nth-child(odd)');
  const platformElements = await page.$$(
      '#tab-content-available > div > div.experiment > div.experiment-default.flex-container > div.flex > p > span.platforms');
  const statusElements = await page.$$(
      '#tab-content-available > div > div.experiment > div.experiment-default.flex-container > div.flex.experiment-actions > select');
  for (const flag of flagElements) {
    const flagText = await flag.evaluate(element => element.textContent);
    flagList.push(flagText);
  }
  for (const name of nameElements) {
    const nameText = await name.evaluate(element => element.textContent);
    nameList.push(nameText);
  }
  for (const desc of descElements) {
    const descText = await desc.evaluate(element => element.textContent);
    descList.push(descText);
  }
  for (const platform of platformElements) {
    const platformText =
        await platform.evaluate(element => element.textContent);
    platformList.push(platformText);
  }
  for (const status of statusElements) {
    const statusText = await status.evaluate(element => element.value);
    statusList.push(statusText);
  }

  let flagsList = [];
  if (flagList.length === nameList.length &&
      descList.length === platformList.length &&
      statusList.length === flagList.length) {
    for (let i = 0; i < nameList.length; i++) {
      let flags = {};
      flags['name'] = nameList[i];
      flags['desc'] = descList[i];
      flags['platform'] = platformList[i];
      flags['flag'] = flagList[i];
      flags['status'] = statusList[i];
      console.log(flags);
      flagsList.push(flags);
    }

  } else {
    return Promise.reject(
        `Error: the length of flags' properties are not equal. \
        ${flagList.length}-${nameList.length}-${descList.length}-${
            platformList.length}-${statusList}`);
  }
  console.log(flagsList);
  // try {
  //   await browser.close();
  // }catch (e){console.log(e)};
  return Promise.resolve(flagsList);
}

async function writeDataToExcel(pathname, jsonData) {
  let wb = new xl.Workbook();

  let ws = wb.addWorksheet('Index');
  let tableHeader = ['Name', 'Desc', 'Support Platforms', 'Flags', 'Status'];

  for (let i = 0; i < tableHeader.length; i++)
    ws.cell(1, i + 1).string(tableHeader[i]);

  for (let i = 0; i < jsonData.length; i++) {
    let desc = jsonData[i]['desc'];
    let platform = jsonData[i]['platform'];
    ws.cell(i + 2, 1).string(jsonData[i]['name']);
    ws.cell(i + 2, 2).string(desc);
    ws.cell(i + 2, 3).string(platform);
    ws.cell(i + 2, 4).string(jsonData[i]['flag']);
    ws.cell(i + 2, 5).string(jsonData[i]['status']);
  }

  console.log(pathname);
  await wb.write(pathname);

  return Promise.resolve();
}

async function genExcelFiles() {
  console.log('start get result');
  const results = await getAllFlags();
  // console.log("get result: ", results);
  let excelPathName = path.join(process.cwd(), 'flags.xlsx');
  await writeDataToExcel(excelPathName, results);

  return Promise.resolve();
}

genExcelFiles().catch(console.error);
