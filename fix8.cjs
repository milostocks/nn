const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const search = `    try {
      const errorMsg = await bot.sendMessage(msg.chat.id, \`❌ Gagal konversi. Pastikan simbol koin benar (contoh: BTC, SOL, ETH).\`, { 
        reply_to_message_id: msg.message_id 
      });
      
      // Hapus pesan error setelah 1 detik
      setTimeout(() => {
        bot.deleteMessage(msg.chat.id, errorMsg.message_id).catch(() => {});
      }, 1000);
    } catch (sendErr) {
      console.error("DEBUG SEND ERROR:", sendErr.message);
    }`;

// Replace with empty string (just keep the console.error above it)
c = c.replace(search.replace(/\n/g, '\r\n'), '');
c = c.replace(search, '');

fs.writeFileSync('bot.js', c);
console.log('Removed conversion error message');
