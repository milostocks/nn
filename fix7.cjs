const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const tanyaCommand = `
// ==========================================
// FITUR TANYA AI (/tanya)
// ==========================================
bot.onText(/^\\/tanya(?:\\s+([\\s\\S]+))?$/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const question = match[1];

  if (!question) {
    return bot.sendMessage(msg.chat.id, "💡 <b>Cara Penggunaan:</b>\\n<code>/tanya [pertanyaan kamu]</code>\\n\\n<b>Contoh:</b>\\n<code>/tanya Siapakah presiden Indonesia?</code>", { parse_mode: "HTML", reply_to_message_id: msg.message_id });
  }

  try {
    const processingMsg = await bot.sendMessage(msg.chat.id, "⏳ <i>Mencari jawaban...</i>", { parse_mode: "HTML", reply_to_message_id: msg.message_id });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Menggunakan gpt-4o-mini karena lebih cepat dan murah untuk teks
      messages: [{ role: "user", content: question }],
    });

    const answer = response.choices[0].message.content;

    await bot.editMessageText(answer, {
      chat_id: msg.chat.id,
      message_id: processingMsg.message_id,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("OpenAI Error (/tanya):", err.message);
    bot.sendMessage(msg.chat.id, "❌ Maaf, saya sedang tidak bisa menjawab saat ini.", { reply_to_message_id: msg.message_id });
  }
});
`;

if (!c.includes('/tanya(?:\\s+([\\s\\S]+))?/i')) {
  c = c + '\n' + tanyaCommand;
  fs.writeFileSync('bot.js', c);
  console.log('Added /tanya command');
} else {
  console.log('Command already exists');
}
