'use strict';

const { exec } = require('child_process');
const { chromium } = require('playwright');
const si = require('systeminformation');
const util = require('./util.js');

async function getConfig() {
  // CPU
  const cpuData = await si.cpu();
  let cpuName = cpuData.brand;
  const cpuManufacturer = cpuData.manufacturer;
  if (cpuManufacturer.includes('Intel')) {
    cpuName = cpuName.split(' ').pop();
  } else if (cpuManufacturer.includes('AMD')) {
    // Trim the brand name, e.g. Ryzen 7 4700U with Radeon Graphics -> Ryzen 7 4700U
    cpuName = cpuName.split(' ').slice(0, 3).join(' ');
  }

  // GPU
  const gpuData = await si.graphics();
  let gpuModel = 'Unknown GPU';
  // For remote desktop, there is no gpuData.controllers
  if (gpuData.controllers.length >= 1) {
    gpuModel = gpuData.controllers.slice(-1)[0].model;
  }
  const gpuName = gpuModel.replace('(TM)', '').replace('(R)', '');

  // power plan
  let powerPlan = 'Unknown Power Plan';
  if (util['platform'] == 'win32') {
    powerPlan = await new Promise((resolve, reject) => {
      // `cmd /c chcp 65001>nul &&`: this command sets cmd's console output to utf-8) at start of my exec command
      exec('cmd /c chcp 65001>nul && powercfg /GetActiveScheme', (error, stdout, stderr) => {
        if (stdout.includes('Balanced') || stdout.includes('平衡')) {
          resolve('Balanced');
        } else if (stdout.includes('High performance') || stdout.includes('高性能')) {
          resolve('High performance');
        } else if (stdout.includes('Power saver') || stdout.includes('省电')) {
          resolve('Power saver');
        } else {
          resolve('Unknown Power Plan');
        }
      });
    });
  }

  util['cpuName'] = cpuName;
  util['gpuName'] = gpuName;
  util['powerPlan'] = powerPlan;

  await getExtraConfig();
}

/*
 * Get extra config info via Chrome
 */
async function getExtraConfig() {
  if (util.dryrun) {
    return;
  }
  const browser = await chromium.launchPersistentContext(util.userDataDir, {
    headless: false,
    executablePath: util.browserPath,
    viewport: null,
  });

  const page = await browser.newPage();

  // Chrome version and revision
  await page.goto('chrome://version');
  const chromeNameElem = await page.$('#inner > tbody > tr:nth-child(1) > td.label');
  let chromeName = await chromeNameElem.evaluate(element => element.innerText);
  const chromeRevisionElem = await page.$('#inner > tbody > tr:nth-child(2) > td.version');
  let chromeRevision = await chromeRevisionElem.evaluate(element => element.innerText);

  if (chromeName.includes('Chromium')) {
    chromeName = 'Chromium';
  } else {
    chromeName = 'Chrome';
  }
  const versionElement = await page.$('#version');
  let chromeVersion = await versionElement.evaluate(element => element.innerText);

  // GPU driver version
  await page.goto('chrome://gpu');
  const gpuDriverVersion = await page.evaluate(() => {
    let table = document.querySelector('#basic-info').querySelector('#info-view-table');
    for (let i = 0; i < table.rows.length; i++) {
      if (table.rows[i].cells[0].innerText === 'Driver version') {
        return table.rows[i].cells[1].innerText;
      }
    }
    return 'NA';
  });

  // screen resolution
  const screenResolution = await page.evaluate(() => {
    const screenResolutionX = window.screen.width;
    const screenResolutionY = window.screen.height;
    const scaleRatio = window.devicePixelRatio;
    return screenResolutionX * scaleRatio + 'x' + screenResolutionY * scaleRatio;
  });

  await browser.close();

  util['chromeVersion'] = chromeVersion;
  util['chromeRevision'] = chromeRevision;
  util['gpuDriverVersion'] = gpuDriverVersion;
  util['screenResolution'] = screenResolution;
}

module.exports = getConfig;
