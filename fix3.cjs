const fs = require('fs');
let content = fs.readFileSync('bot.js', 'utf8');

// Replace handler 1
const h1Search = `bot.onText(/^(\\d+(?:\\.\\d+)?)\\s*([a-zA-Z0-9]{2,10})(?:\\s*to\\s*|\\s+)([a-zA-Z0-9]{2,10})$/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const amount = parseFloat(match[1]);
  const from = match[2].toUpperCase();
  const to = match[3].toUpperCase();`;
  
const h1Replace = h1Search + "\n  if (!/[A-Z]/.test(from) || !/[A-Z]/.test(to)) return; // Koin harus mengandung huruf";

// Normalize CRLF
content = content.replace(h1Search.replace(/\n/g, '\r\n'), h1Replace.replace(/\n/g, '\r\n'));
content = content.replace(h1Search, h1Replace);

// Replace handler 2
const h2Search = `bot.onText(/^(\\d+(?:\\.\\d+)?)\\s*([a-zA-Z0-9]{2,10})$/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const amount = parseFloat(match[1]);
  const from = match[2].toUpperCase();`;
  
const h2Replace = h2Search + "\n  if (!/[A-Z]/.test(from)) return; // Koin harus mengandung huruf";

content = content.replace(h2Search.replace(/\n/g, '\r\n'), h2Replace.replace(/\n/g, '\r\n'));
content = content.replace(h2Search, h2Replace);

fs.writeFileSync('bot.js', content);
console.log("FIXED NUMBERS");
