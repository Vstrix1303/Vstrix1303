// Copies the built single-file game into the desktop app.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'index.html'), dst = path.join(__dirname, 'game', 'index.html');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('game copied:', (fs.statSync(dst).size / 1024).toFixed(0), 'KB');
