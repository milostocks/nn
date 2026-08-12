const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');
const startMatch = "const message = `<tg-emoji emoji-id=\"6190336264940559752\">💰</tg-emoji> ${amount.toLocaleString()} ${from} = ${formattedResult}${changeText}`;";
const endMatch = "try {\n      const errorMsg = await bot.sendMessage(msg.chat.id, `❌ Gagal konversi.";

const startIndex = c.lastIndexOf(startMatch);
const endIndex = c.indexOf(endMatch, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = startMatch + "\n\n    await bot.sendMessage(msg.chat.id, message, { \n      parse_mode: \"HTML\", \n      reply_to_message_id: msg.message_id \n    });\n\n  } catch (err) {\n    console.error(\"DEBUG CONVERT ERROR:\", err.message);\n    ";
  
  const before = c.substring(0, startIndex);
  const after = c.substring(endIndex);
  fs.writeFileSync('bot.js', before + replacement + after);
  console.log("FIXED!");
} else {
  console.log("MATCH NOT FOUND", startIndex, endIndex);
}
