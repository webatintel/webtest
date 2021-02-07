const settings = require('../config.json');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const axios = require('axios').default;
const sevenZ = require('7zip-min');
const net = require('net');

const localChromiumDir = path.join(process.cwd(), 'chromium_binary');

/*
 * Exec chromium build on remote host
 * @param {String}, commit id
 */
async function remoteExecChromiumBuild(commitId) {
  const message = {command: 'build', content: commitId};
  const host = settings['chromium_builder']['host'];
  const port = settings['chromium_builder']['port'];
  const chromiumUrl = await new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(port, host, () => {
      client.write(JSON.stringify(message));
    });

    client.on('data', data => {
      console.log('Received: ' + data);
      let status = JSON.parse(data).status;
      let msg = JSON.parse(data).msg;
      // Socket connected
      if (status === 0) {
        console.log(msg);
        console.log(
            'Waiting for build completed, this may take a very long time...');
        // Build done, this will take a very long time
      } else if (status === 1) {
        console.log('Build successfully, you can get url from: ', msg);
        client.destroy();  // kill client after server's response
        resolve(msg);
      } else {
        client.destroy();  // kill client after server's response
        reject('Build Error: ', msg);
      }
    });
    client.on('close', () => {
      console.log('Connection closed');
    });
    client.on('error', e => {
      console.log(e);
      reject(e);
    });
  });
  return Promise.resolve(chromiumUrl);
}

/*
 * Update chromePath and dev_mode to true in config.json
 */
async function updateConfig(executablePath) {
  if (!fs.existsSync(executablePath)) {
    return Promise.reject(`Error: The executable chrome binary: ${
        executablePath} does not exist!`);
  }
  console.log(`Executable chromium path at: ${executablePath}`);
  let platform = os.platform();
  if (platform === 'win32') {
    settings['win_chrome_path'] = executablePath;
  } else if (platform === 'linux') {
    settings['linux_chrome_path'] = executablePath;
  } else {
    return Promise.reject('Unsupported test platform');
  }
  settings['dev_mode'] = true;
  await fs.promises.writeFile(
      path.join(process.cwd(), 'config.json'),
      JSON.stringify(settings, null, 4));
  return Promise.resolve();
}

/*
 * Download chromium build from remote host
 * @param {String}, chromiumUrl, url of chromium to be download
 */
async function dlChromiumBuild(chromiumUrl) {
  const chromiumPath =
      path.join(localChromiumDir, chromiumUrl.split('/').pop());
  if (!fs.existsSync(localChromiumDir)) {
    fs.mkdirSync(localChromiumDir, {recursive: true});
  }
  const result = await new Promise((resolve, reject) => {
    axios({method: 'get', url: chromiumUrl, responseType: 'stream'})
        .then(response => {
          console.log(`**************Downloading chromium build to ${
              chromiumPath}******************`);
          let stream = fs.createWriteStream(chromiumPath);
          response.data.pipe(stream).on('close', () => {
            console.log('**************Download done.*****************');
            resolve(chromiumPath);
          });
        })
        .catch(error => {
          reject('Download chromium build error: ', error);
        });
  });
  return Promise.resolve(result);
}

/*
 * Unzip chromium build to local
 * @param, {String}, chromiumPath
 */
async function unzipChromium(chromiumPath) {
  const binaryFolder = path.basename(chromiumPath);
  const binaryDir = path.join(localChromiumDir, binaryFolder.split('.')[0]);
  const executablePath = path.join(binaryDir, 'Chrome-bin', 'chrome.exe');
  // Clean up existing binary dir if it's duplicated
  if (fs.existsSync(binaryDir)) {
    fs.rmdirSync(binaryDir, {recursive: true});
  }
  return new Promise((resolve, reject) => {
    // Unzip chromium binary  local command: "7z x -y -sdel -odir_path
    // chrome.7z"
    sevenZ.unpack(chromiumPath, binaryDir, err => {
      console.log(
          '**************Start extracting chromium binary**************');
      if (err !== null)
        reject(err);
      else
        resolve(executablePath);
    });
  });
}

/*
 * Centralized place to execute chromium build, get binary from remote host,
 * unzip binary to local, and update config.json file
 * @param, {String}, commitId, used for building chromium at the head of
 * specific commit id
 */
async function GetChromiumBuild(commitId) {
  console.log('Start chromium build...')
  const chromiumUrl = await remoteExecChromiumBuild(commitId);
  const chromiumPath = await dlChromiumBuild(chromiumUrl);
  const executablePath = await unzipChromium(chromiumPath);
  await updateConfig(executablePath);
}

module.exports = GetChromiumBuild;
