'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let parameters = [
  'benchmark',
  'architecture',
  'inputType',
  'inputSize',
  'backend',
];

let platform = os.platform();

let targetBackends = {
  'conformance': ['webgpu'],
  'performance': ['webgpu', 'webgl', 'wasm']
};

// please make sure these metrics are shown up in order
let targetMetrics = {
  'conformance': ['Prediction'],
  'performance': ['Warmup time','Subsequent average','Best time']
};

const outDir = path.join(path.resolve(__dirname), '../out');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

let userDataDir;
if (platform === 'darwin') {
  userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/Chrome Canary`;
} else if (platform === 'linux') {
  userDataDir = `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
} else if (platform === 'win32') {
  userDataDir = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/User Data`;
}
// Use different userDataDir config in case there is another process opened by user.
// Otherwise, Chrome will reuse the existing process when you run it twice with the same profile.
// And since there is no new process, Playwright can't connect to it.
userDataDir = path.join(path.dirname(userDataDir), 'User_Data_for_tfjs_test');

module.exports = {
  'browserArgs': ['--enable-unsafe-webgpu', '--enable-features=WebAssemblySimd,WebAssemblyThreads', '--start-maximized'],
  'hostname': os.hostname(),
  'parameters': parameters,
  'platform': platform,
  'targetBackends': targetBackends,
  'targetMetrics': targetMetrics,
  'outDir': outDir,
  'resultsDir': `${outDir}/results`,
  'userDataDir': userDataDir,
  'url': 'http://wp-27.sh.intel.com/workspace/project/tfjswebgpu/tfjs/e2e/benchmarks/local-benchmark/',
  'timeout': 180 * 1000,
};
