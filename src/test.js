'use strict';

const fs = require('fs');
const { chromium } = require('playwright');
const path = require('path');
const style = require('./style.js')
const util = require('./util.js')
const report = require('./report.js')
// For perf test and correctness test.
const benchmark = require('./benchmark.js');
// For unit test.
const unittest = require('./unittest.js');

async function sendResults(unitResultTable, perfResultTable, correctnessResult, timestamp) {
    const seperator = '<br><br>';
    const html = style.getStyle()
        + unitResultTable + seperator
        + perfResultTable + seperator
        + correctnessResult + seperator
        + style.getConfigTable(util);

    await fs.promises.writeFile(path.join(util.resultsDir, `all${timestamp}.html`), html);

    if ('email' in util.args) {
        let startTime = new Date();
        let timestamp = util.getTimestamp(startTime);
        let subject = '[TFJS Test] ' + util['hostname'] + ' ' + timestamp;
        await util.sendMail(util.args['email'], subject, html);
    }
}

async function runAllTests() {
    // Unit test.
    let startTime = new Date();
    let timestamp = util.getTimestamp(startTime);
    const [unitResults, failIndex] = await unittest.run();
    const unitResultsTable = report.reportUnittest(unitResults, failIndex, startTime);

    // Correctness test.
    startTime = new Date();
    const correctnessResults = await benchmark.run(['Prediction'], 'correctness');
    const correctnessResultsTable = report.reportCorrectness(correctnessResults, startTime);

    // Perf test.
    startTime = new Date();
    const perfResults = await benchmark.run(['average', 'Best', 'Warmup'], 'performance');
    const perfResultsTable = report.report(perfResults, startTime);
    await sendResults(unitResultsTable, perfResultsTable, correctnessResultsTable, timestamp);
}

module.exports = {
    runAllTests: runAllTests
}
