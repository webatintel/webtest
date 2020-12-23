"use strict";

const genDeviceInfo = require('./src/get_device_info.js');
const runTest = require('./src/run.js');
const browser = require('./src/browser.js');
const genTestReport = require('./src/gen_single_report.js');
const sendMail = require('./src/send_mail.js');
const settings = require('./config.json');
const cron = require('node-cron');
const moment = require('moment');
const os = require('os');
const GetChromiumBuild = require('./src/get_chromium_build.js');

const args = require('yargs')
  .usage('node $0 [args]')
  .option('email', {
    alias: 'e',
    type: 'string',
    describe: 'email to',
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
    ['node $0 --email yourname@intel.com','send report to yourname@intel.com'],
    ['node $0 -u -e yourname@intel.com','update chrome and send report to yourname@intel.com'],
  ])
  .help()
  .argv;

const cpuModel = os.cpus()[0].model;
const platform = runTest.getPlatformName();

async function main() {
  //await browser.updateChrome();
  //await repo.updateTFJS();

  let d = new Date();
  let timestamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2)
      + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);;

  let deviceInfo = {};
  let subject = "";
  try {
    if (settings["chromium_builder"]["enable_chromium_build"]) {
      const commitId = settings["chromium_builder"]["commit_id"];
      if (commitId !== "") {
        subject = `Web auto test report on ${platform} with commit id: ${commitId}`;
        await GetChromiumBuild(commitId);
      } else {
        throw Error("Commit id should be specific in config.json if you run with chromium build");
      }
    }

    deviceInfo = await genDeviceInfo();
    if (subject === "")
      subject = '[TFJS Test] ' + timestamp + ' - ' + platform + ' - ' + deviceInfo["CPU"]["info"] + ' - ' + deviceInfo.Browser;

    const workloadResults = await runTest.genWorkloadsResults(deviceInfo, args.target);
    const testReports = await genTestReport(workloadResults);

    if ('email' in args)
      await sendMail(args['email'], subject, testReports);
  } catch (err) {

    console.log(err);
    let subject = '[TFJS Test] ' + timestamp;
    if (!settings.dev_mode && err.message.includes('No new browser update')) {
      subject += 'Auto test cancelled on ' + platform + ' as no browser update';
    } else {
      subject += 'Auto test failed on ' + platform + '-' + cpuModel;
    }

    if ('email' in args)
      await sendMail(args['email'], subject, err);
  }
}

if (settings.enable_cron) {
  cron.schedule(settings.update_browser_sched, () => {
    browser.updateChrome();
    //repo.updateTFJS();
  });
  if (cpuModel.includes('Intel')) {
    cron.schedule(settings.intel_test_cadence, async () => {
      settings.chrome_flags = ["--enable-unsafe-webgpu", "--enable-dawn-features=disable_robustness",
    "--enable-features=WebAssemblySimd,WebAssemblyThreads"];
      await main();
      // settings.chrome_flags = ["--enable-unsafe-webgpu","--enable-features=WebAssemblySimd,WebAssemblyThreads"];
      // await main();
    });
  } else {
    cron.schedule(settings.amd_test_cadence, () => {
      main();
    });
  }
} else {
  if ('update-chrome' in args)
    browser.updateChrome();

  settings.chrome_flags = ["--enable-unsafe-webgpu", "--enable-dawn-features=disable_robustness",
    "--enable-features=WebAssemblySimd,WebAssemblyThreads"];
  // main().then(() => {
  //   settings.chrome_flags = ["--enable-unsafe-webgpu", "--enable-features=WebAssemblySimd,WebAssemblyThreads"];
  //   main();
  // });
  main();
}
