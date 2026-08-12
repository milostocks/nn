const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const imports = `import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";`;

if (!c.includes('import { TelegramClient }')) {
  c = c.replace('import { runMarketScanner, analyzePair } from "./scanner.js";', 'import { runMarketScanner, analyzePair } from "./scanner.js";\n' + imports);
}

const init = `
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
    try {
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
    } catch(err) {
      console.log("Gagal start userbot:", err.message);
    }
  })();
} else {
  console.log("API_ID atau API_HASH tidak ditemukan, Userbot tidak aktif.");
}
`;

if (!c.includes('let userClient = null;')) {
  c = c.replace(/const openai = new OpenAI\(\{[\s\S]*?\}\);/g, match => match + '\n' + init);
}

fs.writeFileSync('bot.js', c);
console.log('Fixed userClient');
