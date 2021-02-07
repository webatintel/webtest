const fs = require('fs');
const os = require('os');
const fsPromises = fs.promises;
const path = require('path');
const runTFJS = require('./workloads/TFJS.js');
const settings = require('../config.json');
const Client = require('ssh2-sftp-client');

function getPlatformName() {
  let platform = os.platform();

  if (platform === 'win32') {
    return 'windows';
  } else if (platform === 'darwin') {
    return 'macOS';
  } else {
    return platform;
  }
}

/*
 * Sort the score object array by specific key and get the medium one.
 */
function sortScores(scoresArray, score, propertyName) {
  scoresArray.sort((a, b) => {
    return Number.parseFloat(a[score][propertyName]) -
        Number.parseFloat(b[score][propertyName]);
  });
}

/*
 * Run a workload several times and sort
 */
async function runWorkload(workload, executor) {
  let originScoresArray = [];
  let scoresArray = [];
  const flags = settings.chrome_flags;
  for (let i = 0; i < workload.run_times; i++) {
    let thisScore = await executor(workload, flags);
    originScoresArray.push(thisScore);
    scoresArray.push(thisScore);

    await new Promise(
        resolve => setTimeout(
            resolve,
            workload.sleep_interval *
                1000));  // sleep for a while before next time running
  }

  sortScores(scoresArray, 'results', 'Total Result');
  const middleIndex = Math.round((workload.run_times - 1) / 2);

  let selectedRound = -1;
  for (let i = 0; i < originScoresArray.length; i++) {
    if (scoresArray[middleIndex] === originScoresArray[i]) selectedRound = i;
  }

  return Promise.resolve({
    'middle_score': scoresArray[middleIndex],
    'selected_round': selectedRound,
    'detailed_scores': originScoresArray
  });
}

/*
 *   Generate a JSON file to store this test result
 *   Return: The absolute pathname of the JSON file
 */
async function storeTestData(deviceInfo, workload, jsonData, timestamp) {
  let testResultsDir =
      path.join(process.cwd(), 'out', timestamp, workload.name);
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, {recursive: true});
  }

  let cpuInfo = [
    deviceInfo['CPU']['mfr'], deviceInfo['CPU']['info'].replace(/\s/g, '-')
  ].join('-');
  let date = new Date();
  let isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  let jsonDate = isoDate.toISOString().split('.')[0].replace(/T|-|:/g, '');
  let browser = deviceInfo['Browser'];
  let jsonFilename = jsonDate + '_' + cpuInfo + '_' + browser + '.json';
  let absJSONFilename = path.join(testResultsDir, jsonFilename);

  await fsPromises.writeFile(
      absJSONFilename, JSON.stringify(jsonData, null, 4));
  return Promise.resolve(absJSONFilename);
}

/*
 * Call a workload and generate the JSON file to store the test results
 * Return: The absolute path name of the JSON file.
 */

async function genWorkloadResult(deviceInfo, workload, executor, timestamp) {
  // if (!settings.dev_mode) {
  //   await syncRemoteDirectory(workload, 'pull');
  // }
  let results = await runWorkload(workload, executor);
  let jsonData = {
    'workload': workload.name,
    'device_info': deviceInfo,
    'test_result': results.middle_score.results,
    'selected_round': results.selected_round,
    'test_rounds': results.detailed_scores,
    'chrome_flags': settings.chrome_flags,
    'execution_date': results.middle_score.date
  }

  let jsonFilename =
      await storeTestData(deviceInfo, workload, jsonData, timestamp);
  // if (!settings.dev_mode) {
  //   await syncRemoteDirectory(workload, 'push');
  // }
  return Promise.resolve(jsonFilename);
}

/*
 * Sync local test results directory with the one in remote server.
 */
async function syncRemoteDirectory(workload, action) {
  let testResultsDir =
      path.join(process.cwd(), 'results', getPlatformName(), workload.name);
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, {recursive: true});
  }
  let localResultFiles = await fsPromises.readdir(testResultsDir);

  const serverConfig = {
    host: settings.result_server.host,
    username: settings.result_server.username,
    password: settings.result_server.password
  };

  let currentPlatform = getPlatformName();
  let remoteResultDir =
      `/home/${settings.result_server.username}/webpnp/results/${
          currentPlatform}/${workload.name}`;
  let sftp = new Client();
  try {
    await sftp.connect(serverConfig);
    let remoteResultDirExist = await sftp.exists(remoteResultDir);
    if (!remoteResultDirExist) {
      await sftp.mkdir(remoteResultDir, true);
    }

    let remoteResultFiles = await sftp.list(remoteResultDir);

    if (action === 'pull') {
      for (let remoteFile of remoteResultFiles) {
        if (!fs.existsSync(path.join(testResultsDir, remoteFile.name))) {
          console.log(`Downloading remote file: ${remoteFile.name}...`);
          await sftp.fastGet(
              remoteResultDir + '/' + remoteFile.name,
              path.join(testResultsDir, remoteFile.name));
          console.log(`Remote file: ${remoteFile.name} downloaded.`);
        }
      }
    } else if (action === 'push') {
      for (let localFile of localResultFiles) {
        let absRemoteFilename = remoteResultDir + `/${localFile}`;
        let remoteFileExist = await sftp.exists(absRemoteFilename);
        if (!remoteFileExist) {
          console.log(`Uploading local file: ${localFile}`);
          await sftp.fastPut(
              path.join(testResultsDir, localFile), absRemoteFilename);
          console.log(`${localFile} uploaded to remote server.`);
        }
      }
    }
  } catch (err) {
    console.log(err);
  } finally {
    await sftp.end();
  }

  return Promise.resolve(testResultsDir);
}

/*
 * Run all the workloads defined in ../config.json and
 * generate the results to the ../results directory.
 * Return: an object like {
 *   'Speedometer2': 'path/to/json/file',
 *   ...
 * }
 */
async function genWorkloadsResults(deviceInfo, target, timestamp) {
  let results = {};
  let executors = {
    'TFJS_WebGL_ResNet_Tensor': runTFJS,
    'TFJS_WebGL_ResNet_Image': runTFJS,
    'TFJS_WebGL_MobileNet_Tensor': runTFJS,
    'TFJS_WebGL_MobileNet_Image': runTFJS,
    'TFJS_WebGPU_ResNet_Tensor': runTFJS,
    'TFJS_WebGPU_ResNet_Image': runTFJS,
    'TFJS_WebGPU_MobileNet_Tensor': runTFJS,
    'TFJS_WebGPU_MobileNet_Image': runTFJS,
    'TFJS_WASM_ResNet_Tensor': runTFJS,
    'TFJS_WASM_ResNet_Image': runTFJS,
    'TFJS_WASM_MobileNet_Tensor': runTFJS,
    'TFJS_WASM_MobileNet_Image': runTFJS,
  };

  let workloads_length = settings.workloads.length
  if (target === undefined) {
    target = '0-' + (workloads_length - 1);
  }
  let indexes = [];
  let fields = target.split(',');

  for (field of fields) {
    if (field.indexOf('-') > -1) {
      for (let i = parseInt(field.split('-')[0]);
           i <= parseInt(field.split('-')[1]); i++) {
        indexes.push(parseInt(i));
      }
    } else {
      indexes.push(parseInt(field));
    }
  }

  for (let i = 0; i < workloads_length; i++) {
    let workload = settings.workloads[i];
    console.log(`[${i + 1}/${workloads_length}] ${workload.name}`)
    if (indexes.indexOf(i) < 0) {
      console.log('Skipped')
      continue;
    }

    let executor = executors[workload.name];
    results[workload.name] =
        await genWorkloadResult(deviceInfo, workload, executor, timestamp);
  }

  return Promise.resolve(results);
}

module.exports = {
  getPlatformName: getPlatformName,
  genWorkloadsResults: genWorkloadsResults
}
