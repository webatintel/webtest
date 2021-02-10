'use strict';

const fs = require('fs');
const nodemailer = require("nodemailer");
const os = require('os');
const path = require('path');
const { exit } = require('process');

let benchmarksJson = [
  {
    'benchmark': 'bodypix',
    'architecture': ['MobileNetV1', 'ResNet50'],
    'inputSize': [0.25, 0.5, 0.75, 1.0],
    'inputType': ['image', 'tensor'],
    'backend': ['wasm', 'webgl'],
  },
  {
    'benchmark': 'mobilenet_v2',
    'backend': ['wasm', 'webgl', 'webgpu'],
  },
  {
    'benchmark': 'posenet',
    'architecture': ['MobileNetV1', 'ResNet50'],
    'inputSize': [128, 257, 512, 1024],
    'inputType': ['image', 'tensor'],
    'backend': ['wasm', 'webgl', 'webgpu'],
  },
];

let parameters = [
  'benchmark',
  'architecture',
  'inputType',
  'inputSize',
  'backend',
];

let backends = [
  'webgpu',
  'webgl',
  'wasm',
  'cpu',
];

let platform = os.platform();

let benchmarks = [];
for (let benchmarkJson of benchmarksJson) {
  let seqArray = [];
  for (let p of parameters) {
    seqArray.push(p in benchmarkJson ? (Array.isArray(benchmarkJson[p]) ? benchmarkJson[p] : [benchmarkJson[p]]) : ['']);
  }
  benchmarks = benchmarks.concat(cartesianProduct(seqArray));
}

const outDir = path.join(process.cwd(), '../out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

let browserPath = '';
if (platform === 'darwin') {
  browserPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
} else if (platform === 'linux') {
  browserPath = '/usr/bin/google-chrome-unstable';
} else if (platform === 'win32') {
  browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
} else {
  console.error('Unsupported Platform');
  exit(1);
}

function cartesianProduct(arr) {
  return arr.reduce(function (a, b) {
    return a.map(function (x) {
      return b.map(function (y) {
        return x.concat([y]);
      })
    }).reduce(function (a, b) { return a.concat(b) }, [])
  }, [[]])
}

function getDuration(start, end) {
  let diff = Math.abs(start - end);
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
};

function getTimestamp(date) {
  return date.getFullYear() + padZero(date.getMonth() + 1) + padZero(date.getDate()) + padZero(date.getHours()) + padZero(date.getMinutes()) + padZero(date.getSeconds())
}

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

function padZero(str) {
  return ('0' + str).slice(-2);
}

module.exports = {
  'browserPath': browserPath,
  'browserArgs': ['--enable-unsafe-webgpu', '--enable-dawn-features=disable_robustness', '--enable-features=WebAssemblySimd,WebAssemblyThreads', '--disable-hang-monitor', '--start-maximized'],
  'hostname': os.hostname(),
  'platform': platform,

  'benchmarks': benchmarks,
  'backends': backends,
  'parameters': parameters,
  'outDir': outDir,
  'resultsDir': `${outDir}/results`,
  'userDataDir': `${outDir}/User Data`,

  getDuration: getDuration,
  getTimestamp: getTimestamp,
  sendMail: sendMail,
};
