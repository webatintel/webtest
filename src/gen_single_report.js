"use strict";

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { table } = require('console');
const settings = require('../config.json');
const http = require('http');
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

function drawRoundsHeader(basedResult) {
  let basedRoundCol = "<tr>";
  const basedResultLength = basedResult.test_rounds.length;
  for (let i = 0; i < basedResultLength; i++) {
    basedRoundCol += `<th>Round ${i + 1}</th>`;
  }

  let header = `<tr><th rowspan='2'>Workloads</th><th colspan='${basedResultLength}'>\
    ${basedResult.device_info.CPU.info + " " + basedResult.device_info.Browser}</th>`;
  header = header  + basedRoundCol + "</tr>";
  return header;
}

function drawRoundsResult(basedResult) {
  let basedResultCol = `<tr><td>${basedResult.workload}</td>`;
  const selectedStyle = "style='background-color: #4CAF50;'";
  for (let i = 0; i < basedResult.test_rounds.length; i++) {
    if (basedResult.test_rounds[i] !== undefined) {
      if (i === basedResult.selected_round)
        basedResultCol += `<td ${selectedStyle}>${basedResult.test_rounds[i].scores["Total Score"]}</td>`;
      else
        basedResultCol += `<td>${basedResult.test_rounds[i].scores["Total Score"]}</td>`;
    } else {
      basedResultCol += "<td> - </td>";
    }
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
* e.g.
* {
*   "Speedometer2": path.join(__dirname, "../results/Windows/Speedometer2/20200606042844_Intel-TGL-i7-1165G7_Chrome-Canary-85.0.4165.0.json"),
*	  "WebXPRT3": path.join(__dirname, "../results/Windows/WebXPRT3/20200606053303_Intel-TGL-i7-1165G7_Chrome-Canary-85.0.4165.0.json")
* }
*/
async function genSingleTestReport(resultPaths) {
  console.log("********** Generate test report as html **********");
  // Get test result table
  let resultTables = "";
  let roundsTable = "<table>";
  let basedResult;
  let flag = false;
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
    // Draw result table
    if (!flag) {
      roundsTable += drawRoundsHeader(basedResult);
    }
    const resultTable = drawResultTable(basedResult);
    resultTables += `${resultTable}<br>`;
    roundsTable += drawRoundsResult(basedResult);
    flag = true;
  }
  roundsTable += "</table><br><br>";

  let workloadUrls = "<b>Workload Urls:</b> <br>";
  for (let workload of settings.workloads) {
    workloadUrls += `    - <b>${workload.name}</b>: <a href="${workload.url}">${workload.url}</a><br>`;
  }
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

  // Composite html body
  const html = htmlStyle + roundsTable + "<b>Details:</b>"
    + resultTables + "<br><br>" + workloadUrls + chromePath + chromeFlags + commitIdHtml + "<br><br><b>Device Info:</b>" + deviceInfoTable;
  console.log("******Generate html to test.html******");
  await fsPromises.writeFile('./test.html', html);
  return Promise.resolve(html);
}

// // // Used for debug
// (async function() {
// const workload =  {
//     "Speedometer2": path.join(__dirname, "./results/Windows/Speedometer2/20200618193506_Intel-CFL-i9-9900K_Chrome-Canary-85.0.4176.0.json"),
//     "WebXPRT3": path.join(__dirname, "./results/Windows/WebXPRT3/20200618203935_Intel-CFL-i9-9900K_Chrome-Canary-85.0.4176.0.json")
// };
// const result =await genSingleTestReport(workload);
// // await sendMail("test", result, "error", chartImages);
// })();

module.exports = genSingleTestReport;