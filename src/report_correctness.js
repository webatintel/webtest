'use strict';

const util = require('./util.js');

function report(results, startTime) {
    const goodStyle = 'style="color:green"';
    const badStyle = 'style="color:red"';
    const neutralStyle = 'style="color:black"';
    const duration = util.getDuration(startTime, new Date());
    let resultsTable = `<table><tr><th>Correctness(Duration: ${duration})</th><th>WebGPU</th><th>WebGL</th><th>WASM</th><th>CPU</th></tr>`;
    for (let result of results) {
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

module.exports = report;
