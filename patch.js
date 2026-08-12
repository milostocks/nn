import fs from 'fs';
let content = fs.readFileSync('bot.js', 'utf8');

// 1. Replace imports
content = content.replace(/import TelegramBot[\s\S]*?dotenv\.config\(\{ override: true \}\);/m, 
`import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import dotenv from "dotenv";
import cron from "node-cron";
import axios from "axios";
import { runMarketScanner, analyzePair } from "./scanner.js";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

dotenv.config({ override: true });`);

// 2. Insert Userbot Init after openai init
content = content.replace(/const openai = new OpenAI\(\{\s*apiKey: process\.env\.OPENAI_API_KEY,\s*\}\);/,
`const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      phoneNumber: async () => await input.text("Silakan masukkan nomor HP kamu (dengan kode negara, contoh +62812...): "),
      password: async () => await input.text("Silakan masukkan password 2FA (jika ada): "),
      phoneCode: async () => await input.text("Silakan masukkan kode OTP yang dikirim oleh Telegram: "),
      onError: (err) => console.log("Login gagal:", err.message),
    });
    console.log("Userbot terhubung!");
    console.log("STRING_SESSION (Simpan ini di .env agar tidak perlu login lagi):\\n" + userClient.session.save());
  })();
}`);

// 3. Append Quiz Logic at the end
content += `
// ==========================================
// FITUR KUIS (QUIZ)
// ==========================================

const quizzes = new Map();

const getQuizAdmins = () => {
  const admins = process.env.QUIZ_ADMINS || "";
  return admins.split(",").map(id => id.trim()).filter(id => id !== "");
};

bot.onText(/^\\/quiz\\s+(\\d+(?:\\.\\d+)?)\\s+([a-zA-Z0-9]+)\\s+(\\d+)[\\s\\S]*?q:\\s*([\\s\\S]*?)a:\\s*([\\s\\S]+)$/i, (msg, match) => {
  const userId = msg.from.id.toString();
  const admins = getQuizAdmins();
  if (admins.length > 0 && !admins.includes(userId)) {
      return bot.sendMessage(msg.chat.id, "❌ Anda tidak memiliki akses untuk membuat kuis.");
  }

  const amount = parseFloat(match[1]);
  const coin = match[2].toUpperCase();
  const winners = parseInt(match[3], 10);
  const question = match[4].trim();
  const answersText = match[5].trim();
  
  const answers = answersText.split("\\n").map(a => a.trim().toLowerCase()).filter(a => a !== "");

  const tokenStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const token = \`/quis_\${tokenStr}\`;

  quizzes.set(token, {
    amount,
    coin,
    remainingWinners: winners,
    question,
    answers,
    activeIn: null,
    quizMessageId: null, // BARU: Simpan ID pesan ini
    winnersList: []
  });

  bot.sendMessage(msg.chat.id, \`✅ Kuis berhasil dibuat!\\n\\nKirim token ini ke grup untuk memulai kuis:\\n<code>\${token}</code>\`, { parse_mode: "HTML" });
});

bot.onText(/^\\/quis_[a-zA-Z0-9]+$/, async (msg) => {
  const token = msg.text.trim();
  if (quizzes.has(token)) {
    const quiz = quizzes.get(token);
    quiz.activeIn = msg.chat.id.toString();
    const text = \`🎉 <b>KUIS DIMULAI!</b> 🎉\\n\\n<b>Pertanyaan:</b>\\n\${quiz.question}\\n\\n<i>Balas (Reply) pesan ini dengan jawaban kamu! (\${quiz.remainingWinners} Pemenang)</i>\`;
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

    for (const [token, quiz] of quizzes.entries()) {
      if (quiz.activeIn === chatId && quiz.remainingWinners > 0) {
        
        // Cek Reply
        if (quiz.quizMessageId && repliedMsgId !== quiz.quizMessageId) {
           continue; // Harus mereply pesan pengumuman kuis!
        }

        if (quiz.winnersList.includes(userId)) continue;
        
        const ansIndex = quiz.answers.indexOf(text.toLowerCase());
        if (ansIndex !== -1) {
          quiz.answers.splice(ansIndex, 1);
          quiz.remainingWinners -= 1;
          quiz.winnersList.push(userId);

          const username = msg.from.username ? \`@\${msg.from.username}\` : msg.from.first_name;
          
          if (userClient && userClient.connected) {
            try {
              // msg.chat.id is a string/number, we pass it. GramJS handles it.
              await userClient.sendMessage(msg.chat.id, { message: \`cc \${quiz.amount} \${quiz.coin} \${username}\` });
            } catch (err) {
              console.error("Gagal mengirim pesan via Userbot:", err.message);
              await bot.sendMessage(msg.chat.id, \`cc \${quiz.amount} \${quiz.coin} \${username}\`);
            }
          } else {
            await bot.sendMessage(msg.chat.id, \`cc \${quiz.amount} \${quiz.coin} \${username}\`);
          }

          if (quiz.remainingWinners === 0) {
             await bot.sendMessage(msg.chat.id, \`🏁 <b>Kuis Selesai!</b> Semua pemenang telah ditemukan.\`, { parse_mode: "HTML" });
             quizzes.delete(token);
          }
          return;
        }
      }
    }
  }
});
`;
fs.writeFileSync('bot.js', content, 'utf8');
console.log("Patched bot.js successfully!");
