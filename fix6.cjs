const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const oldHandler = `bot.onText(/^\\/quis_[a-zA-Z0-9]+$/, async (msg) => {
  const token = msg.text.trim();
  if (quizzes.has(token)) {
    const quiz = quizzes.get(token);
    quiz.activeIn = msg.chat.id.toString();
    const emojiAmount = numToEmoji(quiz.amount);
    const emojiTotalWinners = numToEmoji(quiz.totalWinners);
    const text = \`<tg-emoji emoji-id="6293924231805672278">🎉</tg-emoji> KUIS DIMULAI! <tg-emoji emoji-id="6293924231805672278">🎉</tg-emoji>\\n\\nreward : \${emojiAmount} \${quiz.coin.toLowerCase()} untuk \${emojiTotalWinners} orang\\n\\nsoal : <b>\${quiz.question}</b>\\n\\nreply pesan ini untuk menjawab (\${quiz.remainingWinners} Pemenang)\`;
    const sentMsg = await bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
    quiz.quizMessageId = sentMsg.message_id;
  }
});`;

const newHandler = `bot.onText(/^\\/quis_[a-zA-Z0-9]+$/, async (msg) => {
  const userId = msg.from.id.toString();
  const admins = getQuizAdmins();
  if (admins.length > 0 && !admins.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "❌ Anda tidak memiliki akses untuk menempelkan token kuis.");
  }

  const token = msg.text.trim();
  if (quizzes.has(token)) {
    const quiz = quizzes.get(token);
    
    if (quiz.activeIn !== null) {
      return bot.sendMessage(msg.chat.id, "❌ Token ini sudah pernah digunakan dan kuis sudah berjalan/selesai.");
    }
    
    quiz.activeIn = msg.chat.id.toString();
    const emojiAmount = numToEmoji(quiz.amount);
    const emojiTotalWinners = numToEmoji(quiz.totalWinners);
    const text = \`<tg-emoji emoji-id="6293924231805672278">🎉</tg-emoji> KUIS DIMULAI! <tg-emoji emoji-id="6293924231805672278">🎉</tg-emoji>\\n\\nreward : \${emojiAmount} \${quiz.coin.toLowerCase()} untuk \${emojiTotalWinners} orang\\n\\nsoal : <b>\${quiz.question}</b>\\n\\nreply pesan ini untuk menjawab (\${quiz.remainingWinners} Pemenang)\`;
    const sentMsg = await bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
    quiz.quizMessageId = sentMsg.message_id;
  }
});`;

if (c.includes('quiz.activeIn = msg.chat.id.toString();')) {
  // normalize newlines for replacement
  c = c.replace(oldHandler.replace(/\n/g, '\r\n'), newHandler.replace(/\n/g, '\r\n'));
  c = c.replace(oldHandler, newHandler);
  fs.writeFileSync('bot.js', c);
  console.log('Fixed quiz token handler');
} else {
  console.log('Handler not found!');
}
