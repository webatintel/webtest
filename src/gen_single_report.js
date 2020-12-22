"use strict";

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { table } = require('console');
const settings = require('../config.json');
const http = require('http');
let backends = [];
// const sendMail = require('./send_mail.js');

function drawResultHeader(basedResult) {
  const roundlegth = basedResult.test_rounds.length;
  const selectedStyle = "style='background-color: #4CAF50;'";
  let tableHeader = `<tr><th>${basedResult.workload}</th>`;
  for (let i = 0; i < roundlegth; i ++) {
    if (i === basedResult.selected_round)
      tableHeader += `<th ${selectedStyle}>Round ${i + 1}</th>`;
    else
      tableHeader += `<th>Round ${i + 1}</th>`;
  }
  return tableHeader + '</tr>';
}

function drawRoundsHeader(basedResult, buffer) {
  let basedRoundCol = "<tr>";
  let keys = Object.keys(buffer);
  for (let key of keys) {
    const basedResultLength = Object.keys(buffer[key]).length;
    for (let i = 0; i < basedResultLength; i++) {
      let backendName = Object.keys(buffer[key])[i];
      if (!backends.includes(backendName)) backends.push(backendName);
    }
  }
  backends.sort();
  basedRoundCol += backends.reduce((acc, cur) => {return acc + `<th>${cur}</th>`}, '');

  let header = `<tr><th rowspan='2'>Workloads</th><th colspan='${backends.length}'>\
    ${basedResult.device_info.CPU.info + " " + basedResult.device_info.Browser}</th></tr>`;
  header = header  + basedRoundCol + "</tr>";
  return header;
}

function drawRoundsResult(basedResult, buffer) {
  let workloadLenth = Object.keys(buffer).length;
  const selectedStyle = "style='background-color: #4CAF50;'";
  const goodStyle = "style='color:green'";
  const badStyle = "style='color:red'";
  let style = '';
  let basedResultCol = '';
  for (let i = 0; i < workloadLenth; i++){
    basedResultCol += `<tr><td>${Object.keys(buffer)[i]}</td>`;
    let backendsResult = buffer[Object.keys(buffer)[i]];
    let wasmCol = `<td> - </td>`;
    let webglCol = `<td> - </td>`;
    let webgpuCol = `<td> - </td>`;
    let wasmValue = backendsResult.hasOwnProperty('wasm') ? backendsResult['wasm']['Total Score'].replace('ms', '') : 0;
    let webglValue = backendsResult.hasOwnProperty('webgl') ? backendsResult['webgl']['Total Score'].replace('ms', '') : 0;
    let webgpuValue = backendsResult.hasOwnProperty('webgpu') ? backendsResult['webgpu']['Total Score'].replace('ms', '') : 0;
    console.log(`${wasmValue}, ${webglValue}, ${webgpuValue}`);
    if (webgpuValue - wasmValue > 0) {
      style = goodStyle;
    }
    style = webgpuValue - wasmValue > 0 ? goodStyle : badStyle;
    wasmCol = `<td>${wasmValue}ms <span ${style}>${parseFloat((webgpuValue - wasmValue)/webgpuValue*100).toFixed(2)}%</span></td>`
    style = webgpuValue - webglValue > 0 ? goodStyle : badStyle;
    webglCol = `<td>${webglValue}ms <span ${style}>${parseFloat((webgpuValue - webglValue)/webgpuValue*100).toFixed(2)}%</span></td>`
    webgpuCol = `<td>${webgpuValue}ms</td>`
    basedResultCol += wasmCol + webglCol + webgpuCol;
  }

  const resultCol = basedResultCol + "</tr>";
  return resultCol;
}

function drawResultTable(basedResult) {
  let resultTable = "<table>" + drawResultHeader(basedResult);


  for (const key of Object.keys(basedResult.test_result)) {
    const basedValue = basedResult.test_result[key];
    // Draw resultTable
    let valueCols = "";
    for (const test_round of basedResult.test_rounds) {
      valueCols += `<td>${test_round['scores'][key]}</td>`;
    }
    resultTable += `<tr><td>${key}</td>${valueCols}</tr>`;
  }
  return `${resultTable}</table>`;
}

function drawDeviceInfoTable(basedResult) {
  let deviceInfoTable = "<table>";
  const basedDeviceInfo = basedResult.device_info;
  let header = `<tr><th>Category</th><th>${basedDeviceInfo["CPU"]["mfr"]}</th>`;
  deviceInfoTable += header + "</tr>";

  for (const key in basedDeviceInfo) {
    if (key === "CPU")
      deviceInfoTable += `<tr><td>${key}</td><td>${basedDeviceInfo[key].info}</td></tr>`;
    else
      deviceInfoTable += `<tr><td>${key}</td><td>${basedDeviceInfo[key]}</td></tr>`;
  }
  return `${deviceInfoTable}</table>`;
}

async function getCommitId() {
  return new Promise((resolve) => {

    http.get('http://wp-27.sh.intel.com/workspace/server/workspace/project/tfjswebgpu/tfjs/.git/refs/heads/master', (resp) => {

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
async function genSingleTestReport(resultPaths) {
  console.log("********** Generate test report as html **********");
  // Get test result table
  let resultTables = "";
  let roundsTable = "<table>";
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
      console.log("based result: ", basedResult);
    }

    let modelName, backendName;
    if (basedResult.workload.indexOf('MobileNet_Image') !== -1) modelName = 'MobileNet_Image';
    if (basedResult.workload.indexOf('MobileNet_Tensor') !== -1) modelName = 'MobileNet_Tensor';
    if (basedResult.workload.indexOf('ResNet_Image') !== -1) modelName = 'ResNet_Image';
    if (basedResult.workload.indexOf('ResNet_Tensor') !== -1) modelName = 'ResNet_Tensor';

    if (buffer[modelName] === undefined) {
      buffer[modelName] = {};
    }
    backendName = basedResult.test_result.backend;
    if (buffer[modelName][backendName] === undefined) buffer[modelName][backendName] = {};
    buffer[modelName][backendName] = basedResult.test_rounds[basedResult.selected_round].scores;
    n++;

    // Draw result table
    console.log(`n is ${n}, length is ${length}`)
    if (n === length) {
      console.log(buffer);
      roundsTable += drawRoundsHeader(basedResult, buffer);
      const resultTable = drawResultTable(basedResult);
      resultTables += `${resultTable}<br>`;
      roundsTable += drawRoundsResult(basedResult, buffer);
    }
  }
  roundsTable += "</table><br><br>";

  let workloadUrls = "<b>Workload Urls:</b> <br>";
  workloadUrls += `    - <a href="${settings.workloads[0].url}">${settings.workloads[0].url}</a><br>`;
  const chromePath = "<br><b>Chrome path: </b>" + settings.chrome_path;
  const chromeFlags = "<br><b>Chrome flags: </b>" + basedResult.chrome_flags;
  const commitIdHtml = "<br><b>TFJS repo commit id: </b>" + commitId;

  // Get device info table
  const deviceInfoTable = drawDeviceInfoTable(basedResult);
  // Define html style
  const htmlStyle = "<style> \
		* {font-family: Calibri (Body);} \
	  table {border-collapse: collapse;} \
	  table, td, th {border: 1px solid black;} \
	  th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
    </style>";

  const html = htmlStyle + roundsTable
    + "<br><br>" + workloadUrls + chromePath + chromeFlags + commitIdHtml + "<br><br><b>Device Info:</b>" + deviceInfoTable;
  console.log("******Generate html to test.html******");
  await fsPromises.writeFile('./test.html', html);
  return Promise.resolve(html);
}

module.exports = genSingleTestReport;