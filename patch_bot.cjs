const fs = require('fs');
let botJs = fs.readFileSync('bot.js', 'utf8');

const userbotImports = `import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";`;

if (!botJs.includes('import { TelegramClient }')) {
  botJs = botJs.replace('import { runMarketScanner, analyzePair } from "./scanner.js";', 'import { runMarketScanner, analyzePair } from "./scanner.js";\n' + userbotImports);
}

const userbotInit = `
const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION || "");
let userClient = null;

if (apiId && apiHash && !Number.isNaN(apiId)) {
  userClient = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  (async () => {
    console.log("Memulai proses login Userbot...");
    await userClient.start({
      phoneNumber: async () => await input.text("Masukkan nomor telepon (format internasional, misal +62812...): "),
      password: async () => await input.text("Masukkan password (2FA) jika ada: "),
      phoneCode: async () => await input.text("Masukkan kode OTP yang dikirim ke Telegram Anda: "),
      onError: (err) => console.error("Error saat login userbot:", err.message),
    });
    console.log("✅ Userbot berhasil login!");
    // Simpan session agar tidak perlu login lagi
    console.log("Simpan STRING_SESSION berikut di .env:");
    console.log(userClient.session.save());
  })();
} else {
  console.log("API_ID atau API_HASH tidak ditemukan, Userbot tidak aktif.");
}
`;

if (!botJs.includes('let userClient = null;')) {
  botJs = botJs.replace('const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });\n\nconst openai = new OpenAI({\n  apiKey: process.env.OPENAI_API_KEY,\n});', 'const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });\n\nconst openai = new OpenAI({\n  apiKey: process.env.OPENAI_API_KEY,\n});\n' + userbotInit);
}

// NUMBER BUG FIX
const numberFixRegex = /if \(!checkAllowed\(msg\)\) return;\n  const amount = parseFloat\(match\[1\]\);\n  const from = match\[2\]\.toUpperCase\(\);\n  const to = match\[3\]\.toUpperCase\(\);/g;
const numberFixReplace = `if (!checkAllowed(msg)) return;\n  const amount = parseFloat(match[1]);\n  const from = match[2].toUpperCase();\n  const to = match[3].toUpperCase();\n  \n  if (!/[A-Z]/.test(from) || !/[A-Z]/.test(to)) return; // Koin harus mengandung huruf`;
botJs = botJs.replace(numberFixRegex, numberFixReplace);

const numberFixRegex2 = /if \(!checkAllowed\(msg\)\) return;\n  const amount = parseFloat\(match\[1\]\);\n  const from = match\[2\]\.toUpperCase\(\);\n  \/\/ Jika user input koin saja/g;
const numberFixReplace2 = `if (!checkAllowed(msg)) return;\n  const amount = parseFloat(match[1]);\n  const from = match[2].toUpperCase();\n  \n  if (!/[A-Z]/.test(from)) return; // Koin harus mengandung huruf\n\n  // Jika user input koin saja`;
botJs = botJs.replace(numberFixRegex2, numberFixReplace2);


// QUIZ FEATURE
const quizFeature = `
// ==========================================
// FITUR KUIS (QUIZ)
// ==========================================

const quizzes = new Map();
const endedQuizzes = new Set();

const emojiDigits = {
  '0': '5195439139868134115',
  '1': '5197397670724912036',
  '2': '5197250993296785376',
  '3': '5195203805725084605',
  '4': '5195057239966107210',
  '5': '5195233277790668761',
  '6': '5195235549828371271',
  '7': '5195021875205393428',
  '8': '5195017563058229112',
  '9': '5195068256557223373'
};

const standardEmojiDigits = {
  '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
  '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣'
};

function numToEmoji(num) {
  return String(num).split('').map(char => {
    if (emojiDigits[char]) {
      return \`<tg-emoji emoji-id="\${emojiDigits[char]}">\${standardEmojiDigits[char]}</tg-emoji>\`;
    }
    return char;
  }).join('');
}

const getQuizAdmins = () => {
  const admins = process.env.QUIZ_ADMINS || "";
  return admins.split(",").map(id => id.trim()).filter(id => id !== "");
};

bot.onText(/^\\/quiz([\\s\\S]*)$/i, (msg) => {
  if (msg.chat.type !== "private") return;

  const fullText = msg.text || "";
  const regex = /^\\/quiz\\s+(\\d+(?:\\.\\d+)?)\\s+([a-zA-Z0-9]+)\\s+(\\d+)[\\s\\S]*?q:\\s*([\\s\\S]*?)a:\\s*([\\s\\S]+)$/i;
  
  const parsed = fullText.match(regex);
  if (!parsed) {
     return bot.sendMessage(msg.chat.id, "💡 <b>Panduan Membuat Kuis</b>\\r?\\n\\r?\\nGunakan format berikut:\\r?\\n<code>/quiz [jumlah_reward] [koin] [jumlah_pemenang]\\r?\\nq:\\r?\\n[Pertanyaan kuis]\\r?\\na:\\r?\\n[Jawaban1]\\r?\\n[Jawaban2]</code>\\r?\\n\\r?\\n<b>Contoh:</b>\\r?\\n<code>/quiz 10 usdt 5\\r?\\nq:\\r?\\na-z sambung sampe 3 huruf\\r?\\na:\\r?\\nwpx\\r?\\nqif</code>", { parse_mode: "HTML" });
  }

  const userId = msg.from.id.toString();
  const admins = getQuizAdmins();
  if (admins.length > 0 && !admins.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "❌ Anda tidak memiliki akses untuk membuat kuis.\\r?\\n\\r?\\njika kamu ingin membuat quis tolong kirimkan cc kepada username ini @son_ying");
  }

  const amount = parseFloat(parsed[1]);
  const coin = parsed[2].toUpperCase();
  const winners = parseInt(parsed[3], 10);
  const question = parsed[4].trim();
  const answersText = parsed[5].trim();
  const answers = answersText.split("\\r?\\n").map(a => a.trim().toLowerCase()).filter(a => a !== "");

  if (answers.length !== winners) {
      return bot.sendMessage(msg.chat.id, \`❌ <b>Gagal Membuat Kuis!</b>\\r?\\n\\r?\\nJumlah jawaban yang kamu berikan (\${answers.length}) tidak sama dengan jumlah pemenang yang kamu tentukan (\${winners}).\\r?\\n\\r?\\nPastikan kamu memberikan jumlah baris jawaban yang pas!\`, { parse_mode: "HTML" });
  }

  const tokenStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const token = \`/quis_\${tokenStr}\`;

  quizzes.set(token, {
    amount,
    coin,
    totalWinners: winners,
    remainingWinners: winners,
    question,
    answers,
    activeIn: null,
    quizMessageId: null,
    winnersList: [],
    winnerUsernames: []
  });

  bot.sendMessage(msg.chat.id, \`✅ Kuis berhasil dibuat!\\r?\\n\\r?\\nKirim token ini ke grup untuk memulai kuis:\\r?\\n<code>\${token}</code>\`, { parse_mode: "HTML" });
});

bot.onText(/^\\/quis_[a-zA-Z0-9]+$/, async (msg) => {
  const token = msg.text.trim();
  if (quizzes.has(token)) {
    const quiz = quizzes.get(token);
    quiz.activeIn = msg.chat.id.toString();
    const emojiAmount = numToEmoji(quiz.amount);
    const emojiTotalWinners = numToEmoji(quiz.totalWinners);
    const text = \`<tg-emoji emoji-id="6293924231805672278">🎉</tg-emoji> KUIS DIMULAI! <tg-emoji emoji-id="6293924231805672278">🎉</tg-emoji>\\r?\\n\\r?\\nreward : \${emojiAmount} \${quiz.coin.toLowerCase()} untuk \${emojiTotalWinners} orang\\r?\\n\\r?\\nsoal : <b>\${quiz.question}</b>\\r?\\n\\r?\\nreply pesan ini untuk menjawab (\${quiz.remainingWinners} Pemenang)\`;
    const sentMsg = await bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
    quiz.quizMessageId = sentMsg.message_id;
  }
});

bot.on("message", async (msg) => {
  if (!checkAllowed(msg)) return;
  const text = (msg.text || "").trim();
  if (text && msg.chat.type !== "private") {
    const chatId = msg.chat.id.toString();
    const userId = msg.from.id.toString();
    
    const repliedMsgId = msg.reply_to_message ? msg.reply_to_message.message_id : null;

    // 1. Cek apakah ini reply ke kuis yang masih berjalan
    let isActiveQuiz = false;
    for (const [token, quiz] of quizzes.entries()) {
      if (quiz.activeIn === chatId && quiz.remainingWinners > 0) {
        
        if (quiz.quizMessageId && repliedMsgId === quiz.quizMessageId) {
           isActiveQuiz = true;
           
           if (quiz.winnersList.includes(userId)) continue;
           
           if (!msg.from.username) {
             await bot.sendMessage(msg.chat.id, "tolong pasang username anda jika mau mengikuti quiz", { reply_to_message_id: msg.message_id });
             return;
           }

           try {
             const userChat = await bot.getChat(userId);
             const bio = userChat.bio || "";
             if (!bio.includes("@yaps_everydays")) {
                await bot.sendMessage(msg.chat.id, "Tolong tambahkan @yaps_everydays di bio (Tentang) Telegram Anda jika mau mengikuti kuis.", { reply_to_message_id: msg.message_id });
                return;
             }
           } catch (e) {
             console.error("Gagal mendapatkan bio user", e.message);
           }
           
           const ansIndex = quiz.answers.indexOf(text.toLowerCase());
           if (ansIndex !== -1) {
             quiz.answers.splice(ansIndex, 1);
             quiz.remainingWinners -= 1;
             quiz.winnersList.push(userId);

             const username = msg.from.username ? \`@\${msg.from.username}\` : msg.from.first_name;
             quiz.winnerUsernames.push(username);
             
             const rewardPerWinner = Number((quiz.amount / quiz.totalWinners).toFixed(4));

             if (userClient && userClient.connected) {
               try {
                 await userClient.sendMessage(msg.chat.id, { message: \`cc \${rewardPerWinner} \${quiz.coin} \${username}\` });
               } catch (err) {
                 console.error("Gagal mengirim pesan via Userbot:", err.message);
                 await bot.sendMessage(msg.chat.id, \`cc \${rewardPerWinner} \${quiz.coin} \${username}\`);
               }
             } else {
               await bot.sendMessage(msg.chat.id, \`cc \${rewardPerWinner} \${quiz.coin} \${username}\`);
             }

             if (quiz.remainingWinners === 0 || quiz.answers.length === 0) {
                const winnersText = quiz.winnerUsernames.join(" ");
                const endMessage = \`🏁 <b>Kuis Selesai</b>\\r?\\n\\r?\\nwinner :\\r?\\n\${winnersText}\`;
                await bot.sendMessage(msg.chat.id, endMessage, { parse_mode: "HTML" });
                
                // Pindahkan ke memori kuis selesai agar bisa dicek nanti
                endedQuizzes.add(quiz.quizMessageId);
                quizzes.delete(token);
             }
             return;
           }
        }
      }
    }

    // 2. Jika bukan kuis aktif, cek apakah itu reply ke kuis yang sudah selesai
    if (!isActiveQuiz && repliedMsgId && endedQuizzes.has(repliedMsgId)) {
        await bot.sendMessage(msg.chat.id, "kuis nya habis anjing", { reply_to_message_id: msg.message_id });
        return;
    }
  }
});

bot.onText(/^\\/saldoquiz/i, async (msg) => {
  const userId = msg.from.id.toString();
  const admins = getQuizAdmins();
  if (admins.length > 0 && !admins.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "❌ Anda tidak memiliki akses untuk mengecek saldo.");
  }
  
  const targetGroup = process.env.ALLOWED_GROUPS ? process.env.ALLOWED_GROUPS.split(",")[0].trim() : null;
  if (!targetGroup) {
      return bot.sendMessage(msg.chat.id, "❌ Grup tujuan belum diatur di file .env (ALLOWED_GROUPS).");
  }

  if (userClient && userClient.connected) {
    try {
      await userClient.sendMessage(targetGroup, { message: "balance" });
    } catch (err) {
      console.error("Gagal mengecek saldo via Userbot:", err.message);
      bot.sendMessage(msg.chat.id, "❌ Gagal mengecek saldo via Userbot.");
    }
  } else {
    bot.sendMessage(msg.chat.id, "❌ Userbot belum terhubung.");
  }
});
`;

if (!botJs.includes('FITUR KUIS (QUIZ)')) {
  botJs = botJs + '\n' + quizFeature;
}

fs.writeFileSync('bot.js', botJs);
console.log("ALL FIXES APPLIED SUCCESSFULLY");
