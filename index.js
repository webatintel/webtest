'use strict';

const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const cron = require('node-cron');
const {execSync} = require('child_process');

async function runMultiConfigs() {
  const configDir = path.join(process.cwd(), 'configs');
  const originConfigPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configDir)) {
    execSync('node main.js', {stdio: 'inherit'});
  } else {
    const configPaths = await fsPromises.readdir(configDir);
    console.log(configPaths);
    if (configPaths.length === 0) {
      execSync('node main.js', {stdio: 'inherit'});
    } else {
      for (let configPath of configPaths) {
        await fsPromises.copyFile(
            path.join(configDir, configPath), originConfigPath);
        execSync('node main.js', {stdio: 'inherit'});
      }
    }
  }
}

const useCron = false;
const sched = '0 0 0 * * Sat';
if (useCron) {
  cron.schedule(sched, () => {
    runMultiConfigs();
  });
} else {
  runMultiConfigs();
}
