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

module.exports = {
  'browserArgs': ['--enable-unsafe-webgpu', '--enable-dawn-features=disable_robustness', '--enable-features=WebAssemblySimd,WebAssemblyThreads', '--start-maximized'],
  'hostname': os.hostname(),
  'parameters': parameters,
  'platform': platform,
  'targetBackends': targetBackends,
  'targetMetrics': targetMetrics,
  'outDir': outDir,
  'resultsDir': `${outDir}/results`,
  'userDataDir': `${outDir}/User Data`,
  'url': 'http://wp-27.sh.intel.com/workspace/project/tfjswebgpu/tfjs/e2e/benchmarks/local-benchmark/',
  'timeout': 180 * 1000,
};
