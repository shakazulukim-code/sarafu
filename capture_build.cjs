const { exec } = require('child_process');
const fs = require('fs');

exec('npx vite build', { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    const log = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error}`;
    fs.writeFileSync('build_full_log.txt', log);
    console.log('Build finished. Check build_full_log.txt');
});
