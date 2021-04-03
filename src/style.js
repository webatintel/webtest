'use strict';

const { chromium } = require('playwright');

function getConfigTable(util) {
  let configTable = '<table><tr><th>Category</th><th>Info</th></tr>';
  for (let category
    of ['hostname', 'platform', 'url', 'browserPath',
      'browserArgs', 'cpuName', 'gpuName', 'powerPlan',
      'gpuDriverVersion', 'screenResolution', 'chromeVersion',
      'chromeRevision']) {
    configTable += `<tr><td>${category}</td><td>${util[category]}</td></tr>`;
  }
  configTable += '</table>';
  return configTable;
}

function getStyle() {
  const htmlStyle = '<style> \
      * {font-family: Calibri (Body);} \
      table {border-collapse: collapse;} \
      table, td, th {border: 1px solid black;} \
      th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
      </style>';
  return htmlStyle;
}

function getDurationTable(duration) {
  return `<table><tr><td>duration</td><td>${duration}</td></tr></table>`;
}

async function gotoURL(url, util) {
  const context = await chromium.launchPersistentContext(util.userDataDir, {
    headless: false,
    executablePath: util['browserPath'],
    viewport: null,
    ignoreHTTPSErrors: true,
    args: util['browserArgs'],
  });
  const page = await context.newPage();
  try {
    await page.goto(url);
  }
  catch (error) {
    console.error(`Failed goto ${url}!`);
    context.close();
    return [-1, -1];
  }

  return [context, page];
}

async function queryTable(page, expectedType, timeout) {
  let index = 1;
  let result = -1;
  while (true) {
    let selector = '#timings > tbody > tr:nth-child(' + index + ')';
    try {
      await page.waitForSelector(selector, { timeout: timeout });
    } catch (err) {
      break;
    }
    const type = await page.$eval(selector + ' > td:nth-child(1)', el => el.textContent);
    if (type.includes(expectedType)) {
      if (expectedType.includes('Prediction')) {
        result = await page.$eval(selector + ' > td:nth-child(2)', el => el.textContent);
      } else {
        result = await page.$eval(selector + ' > td:nth-child(2)', el => parseFloat(el.textContent.replace(' ms', '')));
      }
      break;
    }
    index += 1;
  }
  return result;
}

module.exports = {
  getConfigTable: getConfigTable,
  getStyle: getStyle,
  getDurationTable: getDurationTable,
  gotoURL: gotoURL,
  queryTable: queryTable,
};
