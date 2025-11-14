#!/usr/bin/env node
// Ensure Electron binary is installed using a reliable mirror
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronPath = path.dirname(require.resolve('electron/package.json'));
const installScript = path.join(electronPath, 'install.js');

if (fs.existsSync(installScript)) {
  try {
    execSync('node install.js', {
      cwd: electronPath,
      env: {
        ...process.env,
        ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
      },
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('Electron postinstall failed, but continuing...');
    console.warn('You may need to manually run: ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/.pnpm/electron@*/node_modules/electron/install.js');
  }
}

