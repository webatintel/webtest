'use strict';

const fs = require('fs');
const nodemailer = require('nodemailer');
const path = require('path');
const util = require('./util.js');

async function sendMail(to, subject, html) {
  let from = 'webgraphics@intel.com';

  let transporter = nodemailer.createTransport({
    host: 'ecsmtp.sh.intel.com',
    port: 25,
    secure: false,
    auth: false,
  });

  transporter.verify(error => {
    if (error)
      console.error('transporter error: ', error);
    else
      console.log('Email was sent!');
  });

  let info = await transporter.sendMail({
    from: from,
    to: to,
    subject: subject,
    html: html,
  });
  return Promise.resolve();
}

async function report(results) {
  const goodStyle = 'style=color:green';
  const badStyle = 'style=color:red';
  const neutralStyle = 'style=color:black';

  let html = '<style> \
		* {font-family: Calibri (Body);} \
	  table {border-collapse: collapse;} \
	  table, td, th {border: 1px solid black;} \
	  th {background-color: #0071c5; color: #ffffff; font-weight: normal;} \
    </style>';

  for (let target of ['performance', 'conformance']) {
    if (!(target in results)) {
      continue;
    }
    let targetResults = results[target];
    let metrics = util.targetMetrics[target];
    let metricsLength = metrics.length;
    let unit;
    if (target == 'performance') {
      unit = ' (ms)';
    } else {
      unit = '';
    }
    for (let metricIndex = 0; metricIndex < metrics.length; metricIndex++) {
      let metric = metrics[metricIndex];
      let resultsTable = `<table><tr><th>${target} (${metric}, duration ${targetResults[targetResults.length - 1]})</th><th>webgpu${unit}</th>`;
      for (let i = 1; i < util.targetBackends[target].length; i++) {
        let backend = util.targetBackends[target][i];
        resultsTable += `<th>${backend}${unit}</th>`;
        if (target == 'performance') {
          resultsTable += `<th>webgpu vs ${backend} (%)</th>`;
        }
      }
      resultsTable += '</tr>';
      for (let resultIndex = 0; resultIndex < targetResults.length; resultIndex++) {
        // stop until duration
        if (resultIndex == targetResults.length - 1) {
          break;
        }
        let result = targetResults[resultIndex];
        let webgpuValue = result[metricIndex + 1];
        resultsTable += `<tr><td>${result[0]}</td><td>${webgpuValue}</td>`;
        for (let i = 1; i < util.targetBackends[target].length; i++) {
          let otherValue = result[i * metricsLength + metricIndex + 1];
          resultsTable += `<td>${otherValue}</td>`;
          if (target == 'performance') {
            let style = (webgpuValue == 0 || otherValue == 0 ? neutralStyle : (webgpuValue < otherValue ? goodStyle : badStyle));
            let percent = 'NA';
            if (otherValue !== 0 && webgpuValue !== 0) {
              percent = parseFloat(otherValue / webgpuValue * 100).toFixed(2);
            }
            resultsTable += `<td ${style}>${percent}%</td>`;
          }
        }
        resultsTable += '</tr>';
      }
      resultsTable += '</table><br>';
      html += resultsTable;
    }
  }

  if ('unit' in results) {
    let targetResults = results['unit'];
    let resultsTable = `<table><tr><th>Unit</th></tr>`;
    let result = targetResults[targetResults.length - 1];
    let style = result.includes('FAILED') ? badStyle : goodStyle;
    resultsTable += `<tr><td ${style}>${result}</td></tr></table><br>`;
    html += resultsTable;
  }

  let configTable = '<table><tr><th>Category</th><th>Info</th></tr>';
  for (let category of ['hostname', 'platform', 'url', 'browserPath', 'browserArgs', 'cpuName', 'gpuName', 'powerPlan', 'gpuDriverVersion', 'screenResolution', 'chromeVersion', 'chromeRevision', 'wasmMultithread', 'wasmSIMD']) {
    configTable += `<tr><td>${category}</td><td>${util[category]}</td></tr>`;
  }
  configTable += '</table>'
  html += configTable;

  await fs.promises.writeFile(path.join(util.resultsDir, `${util.timestamp}.html`), html);

  if ('email' in util.args) {
    let subject = '[TFJS Test] ' + util['hostname'] + ' ' + util.timestamp;
    await sendMail(util.args['email'], subject, html);
  }
}

module.exports = report;
