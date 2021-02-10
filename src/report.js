'use strict';

const fs = require('fs');
const path = require('path');
const util = require('./util.js');

async function report(results, startTime) {
  let timestamp = util.getTimestamp(startTime);

  // style
  const htmlStyle = '<style> \
		* {font-family: Calibri (Body);} \
	  table {border-collapse: collapse;} \
	  table, td, th {border: 1px solid black;} \
	  th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
    </style>';

  // resultTable
  let resultsTable = '<table><tr><th>Benchmark</th><th>WebGPU (ms)</th><th>WebGL (ms) (WebGPU vs. WebGL)</th><th>WASM (ms) (WebGPU vs. WASM)</th><th>CPU (ms) (WebGPU vs. CPU)</th></tr>';
  const goodStyle = 'style="color:green"';
  const badStyle = 'style="color:red"';
  const neutralStyle = 'style="color:black"';

  for (let result of results) {
    let webgpuValue = result[util.backends.indexOf('webgpu') + 1];
    resultsTable += `<tr><td>${result[0]}</td><td>${result[1]}</td>`;
    for (let i = 1; i < util.backends.length; i++) {
      let style = webgpuValue == 0 || result[i + 1] == 0 ? neutralStyle : (webgpuValue < result[i + 1] ? goodStyle : badStyle);
      let percent = 'NA';
      if (result[i + 1] !== 0 && webgpuValue !== 0) {
        percent = parseFloat((result[i + 1] - webgpuValue) / result[i + 1] * 100).toFixed(2) + '%';
      }
      resultsTable += `<td ${style}>${result[i + 1]} (${percent})</td>`;
    }
    resultsTable += '</tr>';
  }
  resultsTable += '</table><br>';

  // configTable
  util['duration'] = util.getDuration(startTime, new Date());
  let configTable = '<table><tr><th>Category</th><th>Info</th></tr>';
  for (let category of ['duration', 'hostname', 'platform', 'url', 'browserPath', 'browserArgs', 'cpuName', 'gpuName', 'powerPlan', 'gpuDriverVersion', 'screenResolution', 'chromeVersion', 'chromeRevision']) {
    configTable += `<tr><td>${category}</td><td>${util[category]}</td></tr>`;
  }
  configTable += '</table>'

  const html = htmlStyle + resultsTable + configTable;
  await fs.promises.writeFile(path.join(util.resultsDir, `${timestamp}.html`), html);

  if ('email' in util.args) {
    let subject = '[TFJS Test] ' + util['hostname'] + ' ' + timestamp;
    await util.sendMail(util.args['email'], subject, html);
  }
}

module.exports = report;
