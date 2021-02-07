'use strict';

const genDeviceInfo = require('./src/get_device_info.js');
const runTest = require('./src/run.js');
const browser = require('./src/browser.js');
const genTestReport = require('./src/gen_single_report.js');
const sendMail = require('./src/send_mail.js');
const settings = require('./config.json');
const cron = require('node-cron');
const moment = require('moment');
const os = require('os');
const path = require('path');
const fs = require('fs');
const GetChromiumBuild = require('./src/get_chromium_build.js');

const args = require('yargs')
                 .usage('node $0 [args]')
                 .option('email', {
                   alias: 'e',
                   type: 'string',
                   describe: 'email to',
                 })
                 .option('repeat', {
                   type: 'number',
                   describe: 'repeat times',
                   default: 1,
                 })
                 .option('target', {
                   type: 'string',
                   describe: 'index of workloads to run, e.g., 1-2,5,6',
                 })
                 .option('update-chrome', {
                   alias: 'u',
                   type: 'boolean',
                   describe: 'Update chrome',
                 })
                 .example([
                   [
                     'node $0 --email yourname@intel.com',
                     'send report to yourname@intel.com'
                   ],
                   [
                     'node $0 -u -e yourname@intel.com',
                     'update chrome and send report to yourname@intel.com'
                   ],
                 ])
                 .help()
                 .argv;

const cpuModel = os.cpus()[0].model;
const platform = runTest.getPlatformName();

const duration = (start, end) => {
  let diff = Math.abs(start - end);
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
};

async function main() {
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }
  let deviceInfo = await genDeviceInfo();
  for (let i = 0; i < args['repeat']; i++) {
    try {
      let startTime = new Date();
      let timestamp = startTime.getFullYear() +
          ('0' + (startTime.getMonth() + 1)).slice(-2) +
          ('0' + startTime.getDate()).slice(-2) +
          ('0' + startTime.getHours()).slice(-2) +
          ('0' + startTime.getMinutes()).slice(-2) +
          ('0' + startTime.getSeconds()).slice(-2);
      console.log(
          `== Test round ${i + 1}/${args['repeat']} at ${timestamp} ==`);
      let subject = '[TFJS Test] ' + timestamp + ' - ' + platform + ' - ' +
          deviceInfo['CPU']['info'] + ' - ' + deviceInfo.Browser;
      const workloadResults =
          await runTest.genWorkloadsResults(deviceInfo, args.target, timestamp);
      let endTime = new Date();
      const testReports = await genTestReport(
          workloadResults, duration(startTime, endTime), timestamp);

      if ('email' in args) await sendMail(args['email'], subject, testReports);
    } catch (err) {
      console.log(err);
      let subject = '[TFJS Test] ' + timestamp;
      if (!settings.dev_mode && err.message.includes('No new browser update')) {
        subject +=
            'Auto test cancelled on ' + platform + ' as no browser update';
      } else {
        subject += 'Auto test failed on ' + platform + '-' + cpuModel;
      }

      if ('email' in args) await sendMail(args['email'], subject, err);
    }
  }
}

if (settings.enable_cron) {
  cron.schedule(settings.update_browser_sched, () => {
    browser.updateChrome();
    // repo.updateTFJS();
  });
  if (cpuModel.includes('Intel')) {
    cron.schedule(settings.intel_test_cadence, async () => {
      settings.chrome_flags = [
        '--enable-unsafe-webgpu', '--enable-dawn-features=disable_robustness',
        '--enable-features=WebAssemblySimd,WebAssemblyThreads'
      ];
      await main();
      // settings.chrome_flags =
      // ["--enable-unsafe-webgpu","--enable-features=WebAssemblySimd,WebAssemblyThreads"];
      // await main();
    });
  } else {
    cron.schedule(settings.amd_test_cadence, () => {
      main();
    });
  }
} else {
  if ('update-chrome' in args) browser.updateChrome();

  settings.chrome_flags = [
    '--enable-unsafe-webgpu', '--enable-dawn-features=disable_robustness',
    '--enable-features=WebAssemblySimd,WebAssemblyThreads'
  ];
  main();
}
