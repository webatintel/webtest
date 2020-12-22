"use strict";

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const cpuList = require('../cpu_list.json');
// const sendMail = require('./send_mail.js');

/*
* Draw table header
* @param {String}, type, one of ["summary", "details"]
*/
function drawTableHeader(type, basedResult, preResult, competitorResult, preComResult) {
  let preCpu = "", preOs = "", preBrowser = "", basedVsPre= "";
  let comCpu = "", comOs = "", comBrowser = "", basedVsCom = "</tr>";
  let preComCpu = "", preComOs = "", preComBrowser = "", ComVsPre = "";
  let firstCol = "Workloads";
  if (type !== "summary")
    firstCol = basedResult.workload;
  if (preResult !== "") {
    preCpu = `<th>${preResult.device_info.CPU.info}</th>`;
    preOs = `<th>${preResult.device_info.OS}</th>`;
    preBrowser = `<th>${preResult.device_info.Browser}</th>`;
    basedVsPre= `<th rowspan='3'>Chrome vs. previous (${basedResult.device_info.CPU.codename})</th>`;
  }
  if (competitorResult !== "") {
    comCpu = `<th>${competitorResult.device_info.CPU.info}</th>`;
    comOs = `<th>${competitorResult.device_info.OS}</th>`;
    comBrowser = `<th>${competitorResult.device_info.Browser}</th>`;
    basedVsCom = `<th rowspan='3'>${basedResult.device_info.CPU.codename} vs. ${competitorResult.device_info.CPU.codename}</th></tr>`;
    if (preComResult !== "") {
      preComCpu = `<th>${preComResult.device_info.CPU.info}</th>`;
      preComOs = `<th>${preComResult.device_info.OS}</th>`;
      preComBrowser = `<th>${preComResult.device_info.Browser}</th>`;
      ComVsPre= `<th rowspan='3'>Chrome vs. previous (${preComResult.device_info.CPU.codename})</th>`;
    }
  }
  const tableHeader = `<tr><th rowspan="3">${firstCol}</th>\
      ${preComCpu + preCpu + comCpu}<th>${basedResult.device_info.CPU.info}</th>${ComVsPre + basedVsPre + basedVsCom}\
      <tr>${preComOs + preOs + comOs}<th>${basedResult.device_info.OS}</th></tr>\
      <tr>${preComBrowser + preBrowser + comBrowser}<th>${basedResult.device_info.Browser}</th></tr>`;
  return tableHeader;
}

function drawRoundsHeader(basedResult, competitorResult) {
  let comCol = "</tr>";
  let basedRoundCol = "<tr>", comRoundCol = "";
  const basedResultLength = basedResult.test_rounds.length;
  for (let i = 0; i < basedResultLength; i++) {
    basedRoundCol += `<th>Round ${i + 1}</th>`;
  }

  let header = `<tr><th rowspan='2'>Workloads</th><th colspan='${basedResultLength}'>\
    ${basedResult.device_info.CPU.info + " " + basedResult.device_info.Browser}</th>`;
  if (competitorResult !== "") {
    const comResultLength = competitorResult.test_rounds.length;
    for (let i = 0; i < comResultLength; i++) {
      comRoundCol += `<th>Round ${i + 1}</th>`;
    }
    comCol = `<th colspan='${comResultLength}'>\
      ${competitorResult.device_info.CPU.info + " " + competitorResult.device_info.Browser}</th></tr>`;
  }
  header = header + comCol + basedRoundCol + comRoundCol + "</tr>";
  return header;
}

function drawRoundsResult(basedResult, competitorResult) {
  let basedResultCol = `<tr><td>${basedResult.workload}</td>`;
  let comResultCol = "";
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
  if (competitorResult !== "") {
    for (let i = 0; i < competitorResult.test_rounds.length; i++) {
      if (competitorResult.test_rounds[i] !== undefined) {
        if (i === competitorResult.selected_round)
          comResultCol += `<td ${selectedStyle}>${competitorResult.test_rounds[i].scores["Total Score"]}</td>`;
        else
          comResultCol += `<td>${competitorResult.test_rounds[i].scores["Total Score"]}</td>`;
      } else {
        comResultCol += "<td> - </td>";
      }
    }
  }
  const resultCol = basedResultCol + comResultCol + "</tr>";
  return resultCol;
}

function drawResultTable(basedResult, preResult, competitorResult, preComResult, hasPreResult) {
  let summaryCol = "";
  let resultTable = "<table>" + drawTableHeader("details", basedResult, preResult, competitorResult, preComResult);

  for (const key of Object.keys(basedResult.test_result)) {
    const basedValue = basedResult.test_result[key];
    // Get info from preResult
    let preValue = "", preCol = "", basedVsPreCol = "";
    if (preResult !== "") {
      preValue = preResult.test_result[key];
      preCol = `<td>${preValue}</td>`;
      basedVsPreCol = drawCompareResult(basedValue, preValue);
      if (basedResult.workload === "WebXPRT3" && key !== "Total Score") {
        basedVsPreCol = drawCompareResult(preValue, basedValue);
      }
    }
    // Get info from competitorResult
    let competitorCol = "", basedVsComCol = "", competitorValue = "";
    let preComValue = "", preComCol = "", comVsPreComCol = "";
    if (competitorResult !== "") {
      competitorValue = competitorResult.test_result[key];
      basedVsComCol = drawCompareResult(basedValue, competitorValue);
      if (basedResult.workload === "WebXPRT3" && key !== "Total Score") {
        basedVsComCol = drawCompareResult(competitorValue, basedValue);
      }
      competitorCol = `<td>${competitorValue}</td>`;
      // Get info from preComResult
      if (preComResult !== "") {
        preComValue = preComResult.test_result[key];
        preComCol = `<td>${preComValue}</td>`;
        comVsPreComCol = drawCompareResult(competitorValue, preComValue);
        if (basedResult.workload === "WebXPRT3" && key !== "Total Score") {
          comVsPreComCol = drawCompareResult(preComValue, competitorValue);
        }
      }
    }
    // Draw resultTable
    let otherCols = `${preComCol + preCol + competitorCol}<td>${basedValue}</td>${comVsPreComCol + basedVsPreCol + basedVsComCol}</tr>`;
    resultTable += `<tr><td>${key}</td>${otherCols}`;
    // Draw summaryCol
    if (key == "Total Score") {
      if (preResult === "" && hasPreResult) {
        preComCol = "<td>-</td>";
        preCol = "<td>-</td>";
        basedVsPreCol = "<td>-</td>";
      }
      summaryCol = `<tr><td>${basedResult.workload}</td>${otherCols}`;
    }
  }

  return { "all": `${resultTable}</table>`, "summaryCol": summaryCol };
}

async function findPreTestResult(resultPath) {
  const dir = await fs.promises.readdir(path.dirname(resultPath));
  // Gets cpu info from the test report file, e.g. Intel-KBL-i5-8350U
  const currentCPU = path.basename(resultPath).split('_')[1];
  const currentBrowser = path.basename(resultPath).split('_')[2];
  const currentBrowserChannel = currentBrowser.split('-')[1];
  if (dir.length == 0)
    return Promise.reject("Error: no test result found!");
  else if (dir.length == 1)
    return Promise.resolve("");
  else {
    let dirents = [];
    for (const dirent of dir) {
      // We only compare same CPU versions and previous browser version
      const prevBrowser = dirent.split('_')[2];
      const prevBrowserChannel = prevBrowser.split('-')[1];
      if (currentCPU === dirent.split('_')[1] && currentBrowserChannel === prevBrowserChannel &&
        currentBrowser > prevBrowser)
        dirents.push(dirent);
    }
    if (dirents.length > 0) {
      const comparedPath = path.join(path.dirname(resultPath), dirents.sort().pop());
      console.log("Found the previous test result: ", comparedPath);
      const rawComparedData = await fsPromises.readFile(comparedPath, 'utf-8');
      const preResult = JSON.parse(rawComparedData);
      console.log("compared result: ", preResult);
      return Promise.resolve(preResult);
    } else {
      return Promise.resolve("");
    }
  }
}

async function findCompetitorResult(resultPath) {
  const dir = await fs.promises.readdir(path.dirname(resultPath));
  const basedFileName = path.basename(resultPath).split('_');
  const basedCpuInfo = basedFileName[1];
  // cpu_list.json's keys are cpu brand name
  let basedCpuBrand = basedCpuInfo.slice(basedCpuInfo.indexOf('-') + 1);
  basedCpuBrand = basedCpuBrand.slice(basedCpuBrand.indexOf('-') + 1);
  const basedChromeVersion = basedFileName[2];

  let matchedAmdInfo = "";
  if (basedCpuBrand in cpuList["Intel"])
    matchedAmdInfo = cpuList["Intel"][basedCpuBrand]["competitor"].replace(/\s/g, '-');
  else
    return Promise.reject(`Error: does not found matched Intel CPU info: (${basedCpuInfo}) in cpu_list.json`);

  let amdDirents = [];
  for (const dirent of dir) {
    // We only find matched AMD cpu
    if (dirent.split('_')[1].includes(matchedAmdInfo) && dirent.split('_')[2].includes(basedChromeVersion))
      amdDirents.push(dirent);
  }
  if (amdDirents.length == 0) {
    return Promise.resolve({path: "", result: ""});
  } else {
    // Find AMD test result with latest execution time
    const amdPath = path.join(path.dirname(resultPath), amdDirents.sort().reverse()[0]);
    console.log("Found the competitor test result: ", amdPath);
    const rawComparedData = await fsPromises.readFile(amdPath, 'utf-8');
    const amdResult = JSON.parse(rawComparedData);
    console.log("Competitor result: ", amdResult);
    return Promise.resolve({path: amdPath, result: amdResult});
  }
}

// Draw comparison result with style
// green for result >= 100%, yellow for 99.99% < result < 95%, red for result <= 95%
function drawCompareResult(basedValue, comparedValue) {
  const result = Math.round(((basedValue / comparedValue) * 100) * 100) / 100;
  let resultStyle = "";
  if (result >= 100)
    resultStyle = "#4CAF50";
  else if (result < 100 && result > 95)
    resultStyle = "#D1B100";
  else
    resultStyle = "red";
  return `<td style="color:${resultStyle}">${result}%</td>`;
}

function drawDeviceInfoTable(basedResult, competitorResult) {
  let deviceInfoTable = "<table>";
  const basedDeviceInfo = basedResult.device_info;
  let header = `<tr><th>Category</th><th>${basedDeviceInfo["CPU"]["mfr"]}</th>`;
  let compDeviceInfo = "";
  if (competitorResult !== "") {
    compDeviceInfo = competitorResult.device_info;
    header += `<th>${compDeviceInfo["CPU"]["mfr"]}</th>`;
  }
  deviceInfoTable += header + "</tr>";

  for (const key in basedDeviceInfo) {
    if (compDeviceInfo === "") {
      if (key === "CPU")
        deviceInfoTable += `<tr><td>${key}</td><td>${basedDeviceInfo[key].info}</td></tr>`;
      else
        deviceInfoTable += `<tr><td>${key}</td><td>${basedDeviceInfo[key]}</td></tr>`;
    } else {
      if (key === "CPU")
        deviceInfoTable += `<tr><td>${key}</td><td>${basedDeviceInfo[key].info}</td><td>${compDeviceInfo[key].info}</td></tr>`;
      else
        deviceInfoTable += `<tr><td>${key}</td><td>${basedDeviceInfo[key]}</td><td>${compDeviceInfo[key]}</td></tr>`;
    }
  }
  return `${deviceInfoTable}</table>`;
}

async function hasPreResults(resultPaths) {
  for (const key in resultPaths) {
    const resultPath = resultPaths[key];
    // Find previous test result
    const preResult = await findPreTestResult(resultPath);
    if (preResult !== "")
      return Promise.resolve(true);
  }
  return Promise.resolve(false);

}
/*
* Generate test report as html
* @param: {Object}, resultPaths, an object reprensents for test result path
*/
async function genTestReport(resultPaths) {
  console.log("********** Generate test report as html **********");
  // Get test result table
  let resultTables = "";
  let summaryTable = "<table>";
  let roundsTable = "<table>";
  let basedResult;
  let flag = false;
  const hasPreResult = await hasPreResults(resultPaths);
  let competitorResult = "";
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
    // Find previous test result
    const preResult = await findPreTestResult(resultPath);
    let preComResult = "";
    // Try to find competitor test result only when based test result is running on Intel
    if (basedResult.device_info.CPU.mfr === "Intel") {
      // Find competitor test result
      const competitor = await findCompetitorResult(resultPath);
      competitorResult = competitor.result;
      if(competitor.path !== "")
        preComResult = await findPreTestResult(competitor.path);
    }
    if (!flag) {
      summaryTable += drawTableHeader("summary", basedResult, preResult, competitorResult, preComResult);
      roundsTable += drawRoundsHeader(basedResult, competitorResult);
    }
    const resultTable = drawResultTable(basedResult, preResult, competitorResult, preComResult, hasPreResult);
    resultTables += `${resultTable.all}<br>`;
    summaryTable += resultTable.summaryCol;
    roundsTable += drawRoundsResult(basedResult, competitorResult);
    flag = true;
  }
  summaryTable += "</table><br>";
  roundsTable += "</table><br><br>";
  // Get device info table
  const deviceInfoTable = drawDeviceInfoTable(basedResult, competitorResult);
  // Define html style
  const htmlStyle = "<style> \
		* {font-family: Calibri (Body);} \
	  table {border-collapse: collapse;} \
	  table, td, th {border: 1px solid black;} \
	  th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
		</style>";
  // Composite html body
  const html = htmlStyle + "<br/><b>Summary:</b>" + summaryTable + roundsTable + "<b>Details:</b>"
    + resultTables + "<br><br>" + "<b>Device Info:</b>" + deviceInfoTable;
  console.log("******Generate html to test.html******");
  await fsPromises.writeFile('./test.html', html);
  return Promise.resolve(html);
}

module.exports = genTestReport;