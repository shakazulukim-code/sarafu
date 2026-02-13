const fs = require('fs');
try {
    const content = fs.readFileSync('build_debug.log', 'utf16le'); // Try explicit encoding or utf8
    console.log(content);
} catch (e) {
    // try just utf8 
    try {
        const content2 = fs.readFileSync('build_debug.log', 'utf8');
        console.log(content2);
    } catch (e2) {
        console.error(e2);
    }
}
