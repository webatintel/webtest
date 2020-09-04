"use strict";

const settings = require('../config.json');
const platformBrowser = require('./browser.js');
const { chromium } = require('playwright-chromium');
const path = require('path');
const fs = require('fs');
const si = require('systeminformation');

/*
* Get information of gpu driver version and browser version
*/
async function getOtherInfo() {
  console.log('********** Get other device info **********');
  platformBrowser.configChromePath(settings);
  const chromePath = settings.chrome_path;
  const userDataDir = path.join(process.cwd(), 'userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir);
  }
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromePath,
    viewport: null,
    args: ["--start-maximized"]
  });

  const page = await browser.newPage();

  // Get Chrome version
  await page.goto('chrome://version');
  const browserNameElem = await page.$('#inner > tbody > tr:nth-child(1) > td.label');
  let browserName = await browserNameElem.evaluate(element => element.innerText);

 if (browserName.includes('Chromium')) {
    browserName = 'Chromium';
  } else {
    browserName = 'Chrome';
  }
  const versionElement = await page.$('#version');
  const versionInfo = await versionElement.evaluate(element => element.innerText);
  console.log(versionInfo);

  const os = await si.osInfo();
  let osArch = os.arch === 'x64' ? '64-bit': '32-bit';
  // Some device's default language is Chinese
  let chineseOsArch = os.arch === 'x64' ? '64 位': '32 位';
  if (!(versionInfo.includes(osArch) || versionInfo.includes(chineseOsArch))) {
    return Promise.reject("Error: Arches mismatch between Chrome and test system!");
  }
  let chromeChannel = '';
  if (versionInfo.includes('Stable')) {
    chromeChannel = 'Stable';
  } else if (versionInfo.includes('canary')) {
    chromeChannel = 'Canary';
  // } else if (versionInfo.includes('Developer') || versionInfo.includes('dev')) {
  } else if (versionInfo.includes('beta')) {
    chromeChannel = 'Beta';
  } else if (versionInfo.includes('dev')) {
    chromeChannel = 'Dev';
  } else {
    chromeChannel = 'Stable';
  }
  let chromeVersion = browserName + '-' + chromeChannel + '-' + versionInfo.split(' ')[0];
  if (browserName === "Chromium") {
    chromeVersion = browserName + '-' + versionInfo.split(' ')[0];
  }
  console.log('********** Chrome version **********');
  console.log(chromeVersion);
  
  // Get GPU driver version
  console.log('********** GPU driver version **********');
  await page.goto('chrome://gpu');
  const gpuDriverVersion = await page.evaluate(() => {
    let table = document.querySelector('#basic-info').querySelector('#info-view-table');
    for (let i = 0; i < table.rows.length; i++) {
      if (table.rows[i].cells[0].innerText === 'Driver version') {
        return table.rows[i].cells[1].innerText;
      }
    }
    return '';
  });
  if (gpuDriverVersion === '')
    console.error("Error: Cann't get GPU Driver version!");
  console.log(gpuDriverVersion);

  const screenRes = await page.evaluate(() => {
    const screenResX = window.screen.width;
    const screenResY = window.screen.height;
    const scaleRatio = window.devicePixelRatio;
    return screenResX * scaleRatio + " x " + screenResY * scaleRatio;
  });

  await browser.close(); // A bug here, await close() method will hang and never been resolved.

  const otherInfo = {
    "chromeVersion": chromeVersion,
    "gpuDriverVersion": gpuDriverVersion,
    "ScreenResolution": screenRes
  };

 return Promise.resolve(otherInfo);
};

module.exports = getOtherInfo;
