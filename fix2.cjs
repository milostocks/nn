const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

// The corrupted code starts right after `const message = ...${changeText}\`;` in the performConversion function.
// Actually, it's easier to find `// 📝 HANDLE TEXT (Termasuk me-reply gambar)`
const handleTextMarker = "// 📝 HANDLE TEXT (Termasuk me-reply gambar)";
const parts = c.split(handleTextMarker);

if (parts.length >= 3) {
  // parts[0] is everything up to the FIRST handleTextMarker
  // parts[1] is everything between first and second
  // parts[2] is everything after second

  // The duplication happened inside performConversion, which is inside parts[0]!
  // Wait, no. performConversion is AT THE VERY BOTTOM originally.
  // The structure was:
  // - Top stuff
  // - bot.on("message")  <-- FIRST handleTextMarker
  // - performConversion

  // But the duplication put bot.on("message") INSIDE performConversion!
  // So the first one is the original bot.on("message").
  // The second one is the corrupted one inside performConversion.
  // We need to keep parts[0], keep parts[1], and inside parts[1] is the start of performConversion.
  
  // Actually, I can just use a regex to match the exact corrupted block and remove it.
  
  const badBlockRegex = /\/\/ 📝 HANDLE TEXT \([^)]+\)[\s\S]*?(?=try \{\s+const errorMsg = await bot\.sendMessage\(msg\.chat\.id, `❌ Gagal konversi)/g;
  
  const matches = c.match(badBlockRegex);
  if (matches) {
    console.log("Found bad block matches:", matches.length);
    // Replace the specific corruption inside performConversion
    // We want to replace it with:
    // `\n    await bot.sendMessage(msg.chat.id, message, { \n      parse_mode: "HTML", \n      reply_to_message_id: msg.message_id \n    });\n\n  } catch (err) {\n    console.error("DEBUG CONVERT ERROR:", err.message);\n    `
    
    // Let's find the one that has bot.on("message")
    
    const fixedContent = c.replace(badBlockRegex, `\n    await bot.sendMessage(msg.chat.id, message, { \n      parse_mode: "HTML", \n      reply_to_message_id: msg.message_id \n    });\n\n  } catch (err) {\n    console.error("DEBUG CONVERT ERROR:", err.message);\n    `);
    
    fs.writeFileSync('bot.js', fixedContent);
    console.log("Replaced with regex.");
  } else {
    console.log("No regex match found.");
  }
} else {
  console.log("parts length:", parts.length);
}
