'use strict';

const util = require('./util.js');

function getTableFromResults(results, name, duration) {
  const goodStyle = 'style="color:green"';
  const badStyle = 'style="color:red"';
  const neutralStyle = 'style="color:black"';
  let resultsTable = `<table><tr><th>Perf(${name}; Duration: ${duration})</th><th>WebGPU (ms)</th><th>WebGL (ms)</th><th>WebGPU vs. WebGL (%)</th><th>WASM (ms)</th><th>WebGPU vs. WASM (%)</th><th>CPU (ms)</th><th>WebGPU vs. CPU (%)</th></tr>`;
  for (let result of results) {
    let webgpuValue = result[util.backends.indexOf('webgpu') + 1];
    resultsTable += `<tr><td>${result[0]}</td><td>${result[1]}</td>`;
    for (let i = 1; i < util.backends.length; i++) {
      let style = webgpuValue == 0 || result[i + 1] == 0 ? neutralStyle : (webgpuValue < result[i + 1] ? goodStyle : badStyle);
      let percent = 'NA';
      if (result[i + 1] !== 0 && webgpuValue !== 0) {
        percent = parseFloat((result[i + 1] - webgpuValue) / result[i + 1] * 100).toFixed(2);
      }
      resultsTable += `<td>${result[i + 1]}</td><td ${style}>${percent}</td>`;
    }
    resultsTable += '</tr>';
  }
  resultsTable += '</table>';
  return resultsTable;
}

function report(results, startTime) {
  const duration = util.getDuration(startTime, new Date());
  let resultsTable = getTableFromResults(results['average'], 'Average', duration) + '<br>';
  resultsTable += getTableFromResults(results['Best'], 'Best', duration) + '<br>';
  resultsTable += getTableFromResults(results['Warmup'], 'Warmup', duration);

  return resultsTable;
}

function reportCorrectness(results, startTime) {
  const goodStyle = 'style="color:green"';
  const badStyle = 'style="color:red"';
  const neutralStyle = 'style="color:black"';
  const duration = util.getDuration(startTime, new Date());
  let resultsTable = `<table><tr><th>Correctness(Duration: ${duration})</th><th>WebGPU</th><th>WebGL</th><th>WASM</th><th>CPU</th></tr>`;
  for (let result of results['Prediction']) {
    let webgpuValue = result[util.backends.indexOf('webgpu') + 1];
    resultsTable += `<tr><td>${result[0]}</td><td>${result[1]}</td>`;
    for (let i = 1; i < util.backends.length; i++) {
      let style = webgpuValue == 0 || result[i + 1] == 0 ? neutralStyle : (webgpuValue < result[i + 1] ? goodStyle : badStyle);
      resultsTable += `<td>${result[i + 1]}</td></td>`;
    }
    resultsTable += '</tr>';
  }
  resultsTable += '</table>';
  return resultsTable;
}

function reportUnittest(results, failIndex, startTime) {
  let resultsTable = `<table><tr><th>WebGPU Unit Test Results (FAILED: ${failIndex}; Duration: ${util.getDuration(startTime, new Date())})</th></tr>`;

  for (let result of results) {
    resultsTable += `<tr><td>${result}</td></td>`;
    resultsTable += '</tr>';
  }
  resultsTable += '</table>';

  return resultsTable;
}

module.exports = {
  report: report,
  reportCorrectness: reportCorrectness,
  reportUnittest: reportUnittest
};
