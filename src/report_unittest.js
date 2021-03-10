'use strict';

const util = require('./util.js');

function report(results, failIndex, startTime) {
  let resultsTable = `<table><tr><th>WebGPU Unit Test Results (FAILED: ${failIndex}; Duration: ${util.getDuration(startTime, new Date())})</th></tr>`;

  for (let result of results) {
    resultsTable += `<tr><td>${result}</td></td>`;
    resultsTable += '</tr>';
  }
  resultsTable += '</table>';

  return resultsTable;
}

module.exports = report;
