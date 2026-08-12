const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const search = `console.error("DEBUG CONVERT ERROR:", err.message);`;
c = c.replace(search, '');

fs.writeFileSync('bot.js', c);
console.log('Removed console error message');
