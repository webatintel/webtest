'use strict';

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const {table} = require('console');
const settings = require('../config.json');
const http = require('http');
let backends = [];
// const sendMail = require('./send_mail.js');

function drawResultHeader(basedResult) {
  const roundlegth = basedResult.test_rounds.length;
  const selectedStyle = 'style="background-color: #4CAF50;"';
  let tableHeader = `<tr><th>${basedResult.workload}</th>`;
  for (let i = 0; i < roundlegth; i++) {
    if (i === basedResult.selected_round)
      tableHeader += `<th ${selectedStyle}>Round ${i + 1}</th>`;
    else
      tableHeader += `<th>Round ${i + 1}</th>`;
  }
  return tableHeader + '</tr>';
}

function drawRoundsResult(basedResult, buffer) {
  let workloadLenth = Object.keys(buffer).length;
  const goodStyle = 'style="color:green"';
  const badStyle = 'style="color:red"';
  let style = '';
  let basedResultCol = '';
  for (let i = 0; i < workloadLenth; i++) {
    basedResultCol += `<tr><td>${Object.keys(buffer)[i]}</td>`;
    let backendsResult = buffer[Object.keys(buffer)[i]];
    let webgpuValue = backendsResult.hasOwnProperty('webgpu') ?
        parseFloat(backendsResult['webgpu']['Total Score'].replace('ms', '')) :
        0;
    let webglValue = backendsResult.hasOwnProperty('webgl') ?
        parseFloat(backendsResult['webgl']['Total Score'].replace('ms', '')) :
        0;
    let wasmValue = backendsResult.hasOwnProperty('wasm') ?
        parseFloat(backendsResult['wasm']['Total Score'].replace('ms', '')) :
        0;

    let webgpuCol = `<td>${webgpuValue}</td>`;

    style = webgpuValue < webglValue ? goodStyle : badStyle;
    let percent = 'NA';
    if (webglValue !== 0 && webgpuValue !== 0) {
      percent =
          parseFloat((webglValue - webgpuValue) / webglValue * 100).toFixed(2) +
          '%';
    }
    let webglCol = `<td ${style}>${webglValue} (${percent})</td>`;

    style = webgpuValue < wasmValue ? goodStyle : badStyle;
    percent = 'NA';
    if (wasmValue !== 0 && webgpuValue !== 0) {
      percent =
          parseFloat((wasmValue - webgpuValue) / wasmValue * 100).toFixed(2) +
          '%';
    }
    let wasmCol = `<td ${style}>${wasmValue} (${percent})</td>`;

    basedResultCol += webgpuCol + webglCol + wasmCol + '</tr>';
  }

  return basedResultCol;
}

function drawDeviceInfoTable(basedResult) {
  let deviceInfoTable = '<table>';
  const basedDeviceInfo = basedResult.device_info;
  let header = `<tr><th>Category</th><th>${basedDeviceInfo['CPU']['mfr']}</th>`;
  deviceInfoTable += header + '</tr>';

  for (const key in basedDeviceInfo) {
    if (key === 'CPU')
      deviceInfoTable +=
          `<tr><td>${key}</td><td>${basedDeviceInfo[key].info}</td></tr>`;
    else
      deviceInfoTable +=
          `<tr><td>${key}</td><td>${basedDeviceInfo[key]}</td></tr>`;
  }
  return `${deviceInfoTable}</table>`;
}

async function getCommitId() {
  return new Promise((resolve) => {
    http.get(
        'http://wp-27.sh.intel.com/workspace/server/workspace/project/tfjswebgpu/tfjs/.git/refs/heads/master',
        (resp) => {
          let commitId = '';
          // A chunk of data has been recieved.
          resp.on('data', (chunk) => {
            commitId += chunk;
          });

          // The whole response has been received. Print out the result.
          resp.on('end', () => {
            resolve(commitId);
          });
        });
  });
}
/*
 * Generate test report as html
 * @param: {Object}, resultPaths, an object reprensents for test result path
 */
async function genSingleTestReport(resultPaths, duration, timestamp) {
  let roundsTable =
      '<table><tr><th>Workload</th><th>WebGPU (ms)</th><th>WebGL (ms) (WebGPU vs. WebGL)</th><th>WASM (ms) (WebGPU vs. WASM)</th></tr>';
  let basedResult;
  let flag = false;
  let buffer = {};
  let length = Object.keys(resultPaths).length;
  let n = 0;
  const commitId = await getCommitId();

  for (const key in resultPaths) {
    const resultPath = resultPaths[key];

    // Get basedResult
    if (!fs.existsSync(resultPath)) {
      return Promise.reject(`Error: file: ${resultPath} does not exist!`);
    } else {
      const rawData = await fsPromises.readFile(resultPath, 'utf-8');
      basedResult = JSON.parse(rawData);
    }

    let modelName, backendName;
    if (basedResult.workload.indexOf('MobileNet_Image') > -1)
      modelName = 'MobileNet_Image';
    if (basedResult.workload.indexOf('MobileNet_Tensor') > -1)
      modelName = 'MobileNet_Tensor';
    if (basedResult.workload.indexOf('ResNet_Image') > -1)
      modelName = 'ResNet_Image';
    if (basedResult.workload.indexOf('ResNet_Tensor') > -1)
      modelName = 'ResNet_Tensor';

    if (buffer[modelName] === undefined) {
      buffer[modelName] = {};
    }
    backendName = basedResult.test_result.backend;
    if (buffer[modelName][backendName] === undefined)
      buffer[modelName][backendName] = {};
    buffer[modelName][backendName] =
        basedResult.test_rounds[basedResult.selected_round].results;
  }

  roundsTable += drawRoundsResult(basedResult, buffer);
  roundsTable += '</table><br>';

  const durationHtml = `<b>Duration: </b>${duration}<br>`;
  const workloadUrls = `<b>Workload: </b><a href='${
      settings.workloads[0].url}'>${settings.workloads[0].url}</a><br>`;
  const chromePath = `<b>Chrome path: </b>${settings.chrome_path}<br>`;
  const chromeFlags = `<b>Chrome flags: </b>${basedResult.chrome_flags}<br>`;
  const commitIdHtml = `<b>TFJS repo commit id: </b>${commitId}`

  // Get device info table
  const deviceInfoTable = drawDeviceInfoTable(basedResult);
  // Define html style
  const htmlStyle = '<style> \
		* {font-family: Calibri (Body);} \
	  table {border-collapse: collapse;} \
	  table, td, th {border: 1px solid black;} \
	  th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
    </style>';

  const html = htmlStyle + roundsTable + '<br>' + durationHtml + workloadUrls +
      chromePath + chromeFlags + commitIdHtml + '<br><br><b>Device Info:</b>' +
      deviceInfoTable;
  await fsPromises.writeFile(path.join('out', timestamp, 'report.html'), html);
  return Promise.resolve(html);
}

module.exports = genSingleTestReport;
