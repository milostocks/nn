const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const turnOnSlowModeStr = `    quiz.activeIn = msg.chat.id.toString();

    // Turn ON Slow Mode (30s)
    if (userClient && userClient.connected) {
      try {
        await userClient.invoke(new Api.channels.ToggleSlowMode({
          channel: msg.chat.id.toString(),
          seconds: 30
        }));
      } catch (err) {
        console.error("Gagal menyalakan slow mode:", err.message);
      }
    }
`;

const turnOffSlowModeStr = `                // Pindahkan ke memori kuis selesai agar bisa dicek nanti
                endedQuizzes.add(quiz.quizMessageId);
                quizzes.delete(token);

                // Turn OFF Slow Mode (0s)
                if (userClient && userClient.connected) {
                  try {
                    await userClient.invoke(new Api.channels.ToggleSlowMode({
                      channel: msg.chat.id.toString(),
                      seconds: 0
                    }));
                  } catch (err) {
                    console.error("Gagal mematikan slow mode:", err.message);
                  }
                }
`;

// Insert Turn ON
if (!c.includes('// Turn ON Slow Mode (30s)')) {
  c = c.replace('quiz.activeIn = msg.chat.id.toString();', turnOnSlowModeStr);
}

// Insert Turn OFF
if (!c.includes('// Turn OFF Slow Mode (0s)')) {
  c = c.replace(`                endedQuizzes.add(quiz.quizMessageId);\r
                quizzes.delete(token);`, turnOffSlowModeStr);
  // fallback if newlines are different
  c = c.replace(`                endedQuizzes.add(quiz.quizMessageId);\n                quizzes.delete(token);`, turnOffSlowModeStr);
}

fs.writeFileSync('bot.js', c);
console.log("Added slow mode toggle");
