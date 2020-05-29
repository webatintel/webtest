"use strict";


const genDeviceInfo = require('./src/get_device_info.js');
const runTest = require('./src/run.js');
const genTestReport = require('./src/gen_test_report.js');
const sendMail = require('./src/send_mail.js');
const settings = require('./config.json');
const cron = require('node-cron');
const moment = require('moment');
const os = require('os');


const cpuModel = os.cpus()[0].model;
const platform = runTest.getPlatformName();

async function main() {

  let now = moment();
  const weekAndDay = now.week() + '.' + now.day();

  try {
    const deviceInfo = await genDeviceInfo();
    console.log(deviceInfo);

    const workloadResults = await runTest.genWorkloadsResults(deviceInfo);
    console.log(JSON.stringify(workloadResults, null, 4));

    const testReports = await genTestReport(workloadResults);

    let subject = '[W' + weekAndDay + '] Web PnP weekly automation test report - ' + platform + ' - ' + deviceInfo.Browser;
    console.log(subject);
    await sendMail(subject, testReports, 'test_report');
  } catch (err) {
    let subject = '[W' + weekAndDay + '] Web PnP weekly automation test failed on: ' + platform + '-' + cpuModel;
    await sendMail(subject, err, 'failure_notice');
  }
}


if (settings.enable_cron) {
  if (cpuModel.includes('Intel')) {
    cron.schedule(settings.intel_test_cadence, () => {
      main();
    });
  } else {
    cron.schedule(settings.amd_test_cadence, () => {
      main();
    });
  }
} else {
  main();
}

