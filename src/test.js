'use strict';

const fs = require('fs');
const { chromium } = require('playwright');
const path = require('path');
const style = require('./style.js')
const util = require('./util.js')

const benchmark = require('./benchmark.js');
const correctness = require('./correctness.js');
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
    let startTime = new Date();
    let timestamp = util.getTimestamp(startTime);
    const unitResult = await unittest.run();
    const correctnessResult = await correctness.run();
    const perfResult =  await benchmark.run();

    await sendResults(unitResult, perfResult, correctnessResult, timestamp);
}

module.exports = {
    runAllTests: runAllTests
}
