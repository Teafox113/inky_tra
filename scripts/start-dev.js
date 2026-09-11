const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const electron = require('../app/node_modules/electron');
const userData = path.join(root, '.local', 'user-data');
fs.mkdirSync(userData, { recursive: true });
const child = spawn(electron, [path.join(root, 'app'), ...process.argv.slice(2)], {
    cwd: root, stdio: 'inherit', env: { ...process.env, INKY_TRA_USER_DATA: userData }
});
child.on('error', err => { console.error(err.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
