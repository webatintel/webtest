'use strict';

const fs = require('fs');
const report = require('./report_correctness.js')
const style = require('./style.js')
const util = require('./util.js')

function getUrl(i) {
    let fullUrl = `${util.url}?task=correctness&warmup=${util.warmupTimes}&run=${util.runTimes}`;
    for (let index in util.parameters) {
        if (util.benchmarks[i][index]) {
            fullUrl += `&${util.parameters[index]}=${util.benchmarks[i][index]}`;
        }
    }
    return fullUrl;
}

async function runBenchmark(i) {
    if (util.dryrun) {
        return Promise.resolve(0.1);
    }

    const [context, page] = await style.gotoURL(getUrl(i), util);
    if (context == -1) {
        return -1;
    }

    let resultAverage = await style.queryTable(page, 'Prediction matches CPU', util.timeout);
    await context.close();
    return resultAverage;
}

async function run() {
    let startTime = new Date();
    let benchmarksLen = util.benchmarks.length;
    let target = util.args.target;
    if (target === undefined) {
        target = '0-' + (benchmarksLen - 1);
    }
    let indexes = [];
    let fields = target.split(',');

    for (let field of fields) {
        if (field.indexOf('-') > -1) {
            for (let i = parseInt(field.split('-')[0]); i <= parseInt(field.split('-')[1]); i++) {
                indexes.push(parseInt(i));
            }
        } else {
            indexes.push(parseInt(field));
        }
    }

    if (!fs.existsSync(util.resultsDir)) {
        fs.mkdirSync(util.resultsDir, { recursive: true });
    }

    let previousTestName = '';
    let results = [];
    let resultsBest = [];
    let resultsWarmup = [];
    for (let i = 0; i < benchmarksLen; i++) {
        if (indexes.indexOf(i) < 0) {
            continue;
        }
        let benchmark = util.benchmarks[i];
        let testName = benchmark.slice(0, -1).join('-');
        let backend = benchmark[benchmark.length - 1];
        if (testName != previousTestName) {
            results.push([testName].concat(Array(util.backends.length).fill(0)));
            previousTestName = testName;
        }
        let result = await runBenchmark(i);
        // TODO: move these into array.
        results[results.length - 1][util.backends.indexOf(backend) + 1] = result;
        console.log(`[${i + 1}/${benchmarksLen}] ${benchmark}: ${result}ms`);
    }
    return report(results, startTime);
}

module.exports = {
    run: run
}
