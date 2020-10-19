const fs = require('fs');
const path = require('path');
const child = require('child_process');


function getDate(){
  let dateObj = new Date();
  let year = dateObj.getFullYear();
  let month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
  let date = ("0" + dateObj.getDate()).slice(-2);
  let hours = dateObj.getHours();
  let minutes = dateObj.getMinutes();
  let seconds = dateObj.getSeconds();
  return `${year}${month}${date}_${hours}${minutes}${seconds}`;
}


async function cloneTFJS() {

  await new Promise((resolve, reject) => {
    // download upstream
    let dlCmd = 'git clone https://github.com/tensorflow/tfjs';
    // add remote repo
    let arCmd = `cd ${tfjsDir} && git remote add yunfei https://github.com/haoyunfeix/tfjs`;
    let cmd = `${dlCmd} && ${arCmd}`;
    console.log(cmd);
    let output = child.execSync(cmd);
    console.log(output.toString());

    return resolve();
  });
  return Promise.resolve();
}


async function pullTFJS() {
  const currentDate = getDate();
  console.log(currentDate);

  await new Promise((resolve, reject) => {
    // chekcout master branch
    let cmCmd = `cd ${tfjsDir} && git checkout . && git checkout master`;
    // pull master
    let pmCmd = 'git pull';
    // new branch for test
    let nbCmd = `git checkout -b ${currentDate}`;
    // merge webgpu code
    let mwCmd = 'git fetch yunfei && git merge yunfei/e2e_webgpu';
    let cmd = `${cmCmd} && ${pmCmd} && ${nbCmd} && ${mwCmd}`;
    console.log(cmd);
    let output = child.execSync(cmd);
    console.log(output.toString());

    return resolve();
  });
  return Promise.resolve();
}


async function downloadModels() {
  const MODELS_BASE_URL =
    'https://storage.googleapis.com/tfjs-models/savedmodel';
  const MOBILENET_BASE = 'posenet/mobilenet/quant2/075';
  const RESNET50_BASE = 'posenet/resnet50/float';

  await new Promise((resolve, reject) => {
    if(!fs.existsSync(`${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${RESNET50_BASE}`)){
      fs.mkdirSync(`${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${RESNET50_BASE}`, {recursive: true});
    }
    let cmd = '';
    cmd = `curl -o ${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${RESNET50_BASE}/model-stride32.json ${MODELS_BASE_URL}/${RESNET50_BASE}/model-stride32.json`
    console.log(cmd);
    let output = child.execSync(cmd);
    for(let i = 1; i < 24; i++){
      cmd = `curl -o ${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${RESNET50_BASE}/group1-shard${i}of23.bin ${MODELS_BASE_URL}/${RESNET50_BASE}/group1-shard${i}of23.bin`
      let output = child.execSync(cmd);
    }

    if(!fs.existsSync(`${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${MOBILENET_BASE}`)){
      fs.mkdirSync(`${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${MOBILENET_BASE}`, {recursive: true});
    }
    cmd = `curl -o ${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${MOBILENET_BASE}/model-stride32.json ${MODELS_BASE_URL}/${MOBILENET_BASE}/model-stride16.json`
    console.log(cmd);
    output = child.execSync(cmd);
    for(let i = 1; i < 2; i++){
      cmd = `curl -o ${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel/${MOBILENET_BASE}/group1-shard${i}of1.bin ${MODELS_BASE_URL}/${MOBILENET_BASE}/group1-shard${i}of1.bin`
      let output = child.execSync(cmd);
    }
    console.log(output.toString());

    return resolve();
  });
  return Promise.resolve();
}


async function buildWebGPU() {

  await new Promise((resolve, reject) => {
    let cmd = '';
    cmd = `cd ${tfjsDir}/tfjs-backend-webgpu && yarn && yarn build`
    console.log(cmd);
    let output = child.execSync(cmd);
    console.log(output.toString());
    if (!fs.existsSync(`${tfjsDir}/e2e/benchmarks/dist`)) {
      fs.mkdirSync(`${tfjsDir}/e2e/benchmarks/dist`, {recursive: true});
    }
    fs.copyFileSync(`${tfjsDir}/tfjs-backend-webgpu/dist/tf-webgpu.js`,
        `${tfjsDir}/e2e/benchmarks/dist/tf-webgpu.js`);
    fs.copyFileSync(`${tfjsDir}/tfjs-backend-webgpu/dist/tf-webgpu.js.map`,
        `${tfjsDir}/e2e/benchmarks/dist/tf-webgpu.js.map`);

    return resolve();
  });
  return Promise.resolve();
}

async function startServer() {
  await new Promise((resolve, reject) => {
    try {
      let cmd = `cd ${tfjsDir}/e2e/benchmarks && npx http-server -p 8080`;
      let output = child.execSync(cmd);
      console.log(output.toString());
      return Promise.resolve();
    } catch (err) {
      console.log('server already started');
  }
    return resolve();
  });
  return Promise.resolve();
}

async function updateTFJS() {
  if(!fs.existsSync(folder)) {
    console.log(`Start clone ${folder}`);
    await cloneTFJS();
  }else {
    console.log(`Exist ${folder}, skip clone...`);
  }
  await pullTFJS();
  if(!fs.existsSync(`${tfjsDir}/e2e/benchmarks/local-benchmark/savedmodel`)) {
    await downloadModels();
  }
  await buildWebGPU();
  // TODO: start server in another process
  //await startServer();
}



const folder = 'tfjs';
const tfjsDir = path.join(process.cwd(), folder);
if (require.main === module) {
  updateTFJS();
} else {
  module.exports = {
    updateTFJS: updateTFJS
  };
}

