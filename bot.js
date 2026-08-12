import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import dotenv from "dotenv";
import cron from "node-cron";
import axios from "axios";
import { runMarketScanner, analyzePair } from "./scanner.js";

dotenv.config({ override: true });

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// Abaikan pesan usang yang diterima saat bot mati
const BOT_START_TIME = Math.floor(Date.now() / 1000);
const originalProcessUpdate = bot.processUpdate.bind(bot);
bot.processUpdate = (update) => {
  const msgDate = update.message?.date || update.callback_query?.message?.date;
  if (msgDate && msgDate < BOT_START_TIME) return; // Abaikan pesan lama
  originalProcessUpdate(update);
};


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Flag untuk mencegah spamming scan
let isScanning = false;

// 🔔 SISTEM ALARM (Price Alert)
let activeAlarms = []; // Format: { chatId, symbol, tp, sl, direction, entryPrice }



// 🔥 SYSTEM PROMPT (GRAVITY)
const SYSTEM_PROMPT = `
Kamu adalah AI trader profesional crypto futures.

TUGAS:
Menganalisa chart dari gambar dan memberikan keputusan trading.

ATURAN WAJIB:
- Jangan pernah menolak analisa
- Jangan bilang "tidak ada gambar"
- Jika tidak jelas → tetap analisa
- DILARANG KERAS menggunakan format Markdown (seperti **teks** atau *teks*). Tulis dalam teks biasa.
- Jika disediakan "LIVE MARKET DATA", WAJIB gunakan data tersebut sebagai acuan utama validasi.
- WAJIB memberikan angka pasti untuk Entry, Stop Loss, dan Take Profit. DILARANG KERAS menuliskan "Menunggu konfirmasi" atau "N/A".
- Jika harga sedang terjun bebas (dump tajam) atau terbang (pump kuat) secara vertikal, PRIORITASKAN Trend Following. DILARANG KERAS menyarankan REVERSAL (lawan arus) jika harga masih berada jauh di atas EMA20/EMA50 (saat naik) atau jauh di bawah EMA20/EMA50 (saat turun).

FORMAT WAJIB:

📊 Analisa: [Berikan analisa singkat dan tajam berdasarkan chart tersebut]

Keputusan Trading:
   🪙 Pair: [Sebutkan Nama Koin, Contoh: BTCUSDT atau SOLUSDT]
   🎯 Aksi: [LONG / SHORT / WAIT]
   ⚖️ Leverage: [Saran leverage]
   🟢 Entry: [Harga entry ideal]
   🔴 Stop Loss: [Harga cut loss]
   💰 Take Profit: [Target harga]
   ⏳ Timeframe: [Sebutkan timeframe chart ini]

⚡ Confidence: [Tingkat keyakinan dalam persentase, contoh: 68%]
`;

function checkAllowed(msg) {
  if (msg.chat.type === "private") return true;

  const chatId = msg.chat.id.toString();
  // Filter out empty strings from the split array
  const allowedGroups = process.env.ALLOWED_GROUPS 
    ? process.env.ALLOWED_GROUPS.split(",").filter(id => id.trim() !== "") 
    : [];

  if (allowedGroups.length > 0 && !allowedGroups.includes(chatId)) {
    return false;
  }
  return true;
}



// ==========================================
// FITUR AUTO-SCANNER & AI VALIDATOR
// ==========================================

async function processChartAnalysis(msg, photoArray, captionText) {
  const chatId = msg.chat.id;
  const msgId = msg.message_id;
  let loadingMsg;
  try {
    const fileId = photoArray[photoArray.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;

    loadingMsg = await bot.sendMessage(chatId, `<tg-emoji emoji-id="5451882707875276247">📊</tg-emoji> Analisa chart...`, { reply_to_message_id: msgId, parse_mode: 'HTML' });

    let textPrompt = "Analisa chart ini dan berikan keputusan trading.";
    
    const symbolMatch = captionText ? captionText.match(/\b([a-zA-Z]{2,10})\b/i) : null;
    if (symbolMatch) {
      const coinName = symbolMatch[1].toUpperCase();
      const symbol = coinName.endsWith("USDT") ? coinName : `${coinName}USDT`;
      const liveData = await analyzePair(symbol, "5m", true);
      if (liveData) {
        textPrompt += `\n\nLIVE MARKET DATA (DARI API):\n- Symbol: ${liveData.symbol}\n- Price: ${liveData.price}\n- RSI(14): ${liveData.rsi}\n- EMA20: ${liveData.ema20}\n- EMA50: ${liveData.ema50}\n- Trend: ${liveData.reason}\n\nGunakan data angka di atas UNTUK MEMVALIDASI apa yang kamu lihat di gambar agar analisa lebih akurat.`;
      }
    }

    if (captionText) {
      textPrompt += `\n\nCatatan/Pesan dari user: "${captionText}"\nPerhatikan pesan user di atas.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: textPrompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0,
    });

    let result = response.choices[0].message.content;
    result = result.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    result = result.replace(/🪙/g, '<tg-emoji emoji-id="5215725958329282459">🪙</tg-emoji>');
    result = result.replace(/📊/g, '<tg-emoji emoji-id="5451882707875276247">📊</tg-emoji>');
    result = result.replace(/🎯/g, '<tg-emoji emoji-id="5424818078833715060">🎯</tg-emoji>');
    result = result.replace(/⚖️/g, '<tg-emoji emoji-id="5447644880824181073">⚖️</tg-emoji>');
    result = result.replace(/🟢/g, '<tg-emoji emoji-id="5215685881989442149">🟢</tg-emoji>');
    result = result.replace(/🔴/g, '<tg-emoji emoji-id="5215313353706057331">🔴</tg-emoji>');
    result = result.replace(/💰/g, '<tg-emoji emoji-id="5213094908608392768">💰</tg-emoji>');
    result = result.replace(/⚡/g, '<tg-emoji emoji-id="5424972470023104089">⚡</tg-emoji>');
    result = result.replace(/⏳/g, '<tg-emoji emoji-id="5215394081911351762">⏳</tg-emoji>');

    result = result.replace(/(Keputusan Trading:?[\s\S]*?)(?=\n*<tg-emoji[^>]*>⚡<\/tg-emoji>\s*Confidence:?|\n*⚡\s*Confidence:?)/i, "<blockquote>$1</blockquote>\n");

    // 🔔 Tambahkan tombol Alarm jika di Private Chat
    let options = { parse_mode: "HTML", reply_to_message_id: msgId };
    
    // Coba deteksi data untuk alarm
    // Regex lebih fleksibel untuk menangkap angka dengan titik atau koma
    const pairMatch = result.match(/(?:Pair|🪙):?\s*([a-zA-Z0-9]+)/i);
    const aksiMatch = result.match(/Aksi:?\s*(LONG|SHORT)/i);
    const tpMatch = result.match(/Take Profit:?\s*([0-9.,]+)/i);
    const slMatch = result.match(/Stop Loss:?\s*([0-9.,]+)/i);

    // Cari simbol di caption, di baris Pair, atau di seluruh hasil analisa
    let detectedSymbol = "";
    if (pairMatch) {
      detectedSymbol = pairMatch[1].toUpperCase();
    } else if (captionText) {
      const capMatch = captionText.match(/\b([a-zA-Z]{2,10})\b/i);
      if (capMatch) detectedSymbol = capMatch[1].toUpperCase();
    } 
    
    // Fallback: cari koin berakhiran USDT di seluruh teks analisa
    if (!detectedSymbol) {
      const globalMatch = result.match(/\b([a-zA-Z0-9]{2,10})USDT\b/i);
      if (globalMatch) detectedSymbol = globalMatch[0].toUpperCase();
    }

    const finalSymbol = detectedSymbol ? (detectedSymbol.endsWith("USDT") ? detectedSymbol : `${detectedSymbol}USDT`) : "";

    if (msg.chat.type === "private") {
      if (finalSymbol && aksiMatch && tpMatch && slMatch) {
        // Bersihkan angka (ganti koma ke titik)
        const cleanTP = tpMatch[1].replace(",", ".");
        const cleanSL = slMatch[1].replace(",", ".");
        
        options.reply_markup = {
          inline_keyboard: [[
            { text: `🔔 Set Alarm ${finalSymbol}`, callback_data: `alarm:${finalSymbol}:${aksiMatch[1]}:${cleanTP}:${cleanSL}` }
          ]]
        };
      }
    }

    await bot.sendMessage(chatId, `<tg-emoji emoji-id="6293924231805672278">🚨</tg-emoji> <i><b>YAPS SIGNAL</b></i> <tg-emoji emoji-id="6293924231805672278">🚨</tg-emoji>\n\n${result}`, options);

    if (loadingMsg) await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => { });

  } catch (err) {
    if (loadingMsg) await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => { });
    bot.sendMessage(chatId, "❌ Error saat analisa chart", { reply_to_message_id: msgId }).catch(()=>{});
  }
}

/*
// Jadwalkan auto-scanner setiap 1 jam sekali (di menit ke-0)
cron.schedule("0 * * * *", () => {
  // console.log("⏰ Cron job triggered: Menjalankan auto-scanner...");
  runAndBroadcastScanner();
});
*/

// Command manual untuk memaksa bot nge-scan saat ini juga
// 📷 HANDLE GAMBAR (Dikirim langsung dengan/tanpa caption)
bot.on("photo", async (msg) => {
  if (!checkAllowed(msg)) return;
  const caption = msg.caption ? msg.caption : "";
  if (msg.chat.type !== "private" && !caption.includes("@")) return;
  await processChartAnalysis(msg, msg.photo, caption);
});



// 📝 HANDLE TEXT (Termasuk me-reply gambar)
bot.on("message", async (msg) => {
  /*
  console.log("\n--- EVENT MESSAGE BARU ---");
  console.log("Tipe chat:", msg.chat.type);
  console.log("Teks pesan:", msg.text || "(Bukan teks)");
  console.log("Apakah punya msg.photo?", !!msg.photo);
  console.log("Apakah me-reply sesuatu?", !!msg.reply_to_message);
  */

  // Abaikan pesan jika berisi gambar (sudah ditangani oleh bot.on("photo"))
  if (msg.photo) return;

  if (!checkAllowed(msg)) return;


    // console.log("⚠️ Pesan ini me-reply pesan lain, tapi BUKAN gambar.");

  // Jika pesan mereply sebuah gambar
  if (msg.reply_to_message && msg.reply_to_message.photo) {
    if (msg.chat.type !== "private" && !(msg.text || "").includes("@")) return;
    await processChartAnalysis(msg, msg.reply_to_message.photo, msg.text || "");
    return;
  }

  // Jika user mengetik /start di private chat
  if (msg.chat.type === "private" && (msg.text || "").toLowerCase() === "/start") {
    bot.sendMessage(msg.chat.id, "💡 <b>Halo! Berikut perintah yang bisa kamu gunakan:</b>\n\n1. 📷 Kirim gambar chart (atau reply gambar) untuk dianalisa.\n2. 💰 <code>1 sol to idr</code> atau <code>1 sol usdt</code> - Konversi koin.", { parse_mode: "HTML" }).catch(()=>{});
  }
});

// 🔔 HANDLE CALLBACK QUERY (Tombol Alarm)
bot.on("callback_query", async (callbackQuery) => {
  const { data, message } = callbackQuery;
  const chatId = message.chat.id;

  if (data.startsWith("alarm:")) {
    const [, symbol, direction, tp, sl] = data.split(":");
    
    // Simpan alarm
    activeAlarms.push({
      chatId,
      symbol,
      direction: direction.toUpperCase(),
      tp: parseFloat(tp),
      sl: parseFloat(sl),
      createdAt: Date.now()
    });

    await bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Alarm dipasang untuk ${symbol}!` }).catch(()=>{});
    await bot.sendMessage(chatId, `🔔 <b>Alarm Aktif: ${symbol}</b>\n━━━━━━━━━━━━━━━\n🎯 TP: <code>${tp}</code>\n🔴 SL: <code>${sl}</code>\n\nBot akan memberi tahu jika harga menyentuh target!`, { parse_mode: "HTML" }).catch(()=>{});
  }
});

// 🕰️ MONITORING ALARM (Setiap 30 detik)
setInterval(async () => {
  if (activeAlarms.length === 0) return;

  for (let i = activeAlarms.length - 1; i >= 0; i--) {
    const alarm = activeAlarms[i];
    try {
      const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${alarm.symbol}`);
      const currentPrice = parseFloat(res.data.price);

      let triggered = false;
      let msg = "";

      if (alarm.direction === "LONG") {
        if (currentPrice >= alarm.tp) {
          triggered = true;
          msg = `✅ <b>TARGET TAKE PROFIT TERCAPAI!</b>\n\n📌 Pair: ${alarm.symbol}\n📈 Harga: <code>${currentPrice}</code>\n🥳 Cuan mendarat!`;
        } else if (currentPrice <= alarm.sl) {
          triggered = true;
          msg = `❌ <b>STOP LOSS TERKENA!</b>\n\n📌 Pair: ${alarm.symbol}\n📉 Harga: <code>${currentPrice}</code>\n🧘 Amankan modal dulu.`;
        }
      } else if (alarm.direction === "SHORT") {
        if (currentPrice <= alarm.tp) {
          triggered = true;
          msg = `✅ <b>TARGET TAKE PROFIT TERCAPAI!</b>\n\n📌 Pair: ${alarm.symbol}\n📉 Harga: <code>${currentPrice}</code>\n🥳 Cuan mendarat!`;
        } else if (currentPrice >= alarm.sl) {
          triggered = true;
          msg = `❌ <b>STOP LOSS TERKENA!</b>\n\n📌 Pair: ${alarm.symbol}\n📈 Harga: <code>${currentPrice}</code>\n🧘 Amankan modal dulu.`;
        }
      }

      if (triggered) {
        await bot.sendMessage(alarm.chatId, `🔔 <b>ALARM TRIGGERED!</b>\n━━━━━━━━━━━━━━━━━━━━\n${msg}`, { parse_mode: "HTML" });
        activeAlarms.splice(i, 1);
      }
    } catch (err) {
      console.error("Error monitoring alarm:", err.message);
    }
  }
}, 30000);


// 💰 FITUR CONVERT MULTI-COIN (MEXC/Binance/Indodax)
// Helper untuk mengambil data ticker 24 jam (untuk % change)
async function get24hChange(symbol) {
  try {
    const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`, { timeout: 5000 });
    return {
      priceChangePercent: parseFloat(res.data.priceChangePercent),
      lastPrice: parseFloat(res.data.lastPrice)
    };
  } catch (err) {
    try {
      // Fallback ke MEXC jika Binance gagal
      const res = await axios.get(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}USDT`, { timeout: 5000 });
      return {
        priceChangePercent: parseFloat(res.data[0].priceChangePercent),
        lastPrice: parseFloat(res.data[0].lastPrice)
      };
    } catch (e) {
      return null;
    }
  }
}

async function performConversion(msg, amount, from, to) {
  try {
    const getPrice = async (symbol) => {
      // Handling khusus USDT ke IDR
      if (symbol === "USDTIDR") {
        try {
          const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=USDTIDR`, { timeout: 5000 });
          return parseFloat(res.data.price);
        } catch (e) {
          try {
            const res = await axios.get(`https://indodax.com/api/ticker/usdtidr`, { timeout: 5000 });
            return parseFloat(res.data.ticker.last);
          } catch (e2) {
            return 16200; // Standar kurs jika API mati
          }
        }
      }

      // Coba MEXC dulu baru Binance
      try {
        const res = await axios.get(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`, { timeout: 5000 });
        return parseFloat(res.data.price);
      } catch (err) {
        const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, { timeout: 5000 });
        return parseFloat(res.data.price);
      }
    };

    if (from === to) return;

    let fromInUsdt = 1;
    let toInUsdt = 1;

    // Hitung nilai 'from' dalam USDT
    if (from !== "USDT") {
      if (from === "IDR") {
        const rate = await getPrice("USDTIDR");
        fromInUsdt = 1 / rate;
      } else {
        fromInUsdt = await getPrice(`${from}USDT`);
      }
    }

    // Hitung nilai 'to' dalam USDT
    if (to !== "USDT") {
      if (to === "IDR") {
        const rate = await getPrice("USDTIDR");
        toInUsdt = 1 / rate;
      } else {
        toInUsdt = await getPrice(`${to}USDT`);
      }
    }

    const result = (amount * fromInUsdt) / toInUsdt;
    
    // Format output
    const formattedResult = to === "IDR" 
      ? `Rp ${Math.round(result).toLocaleString("id-ID")}` 
      : `${result > 0.01 ? result.toLocaleString("en-US", { maximumFractionDigits: 6 }) : result.toFixed(8)} ${to}`;

    // Ambil data perubahan harga 24 jam jika 'from' adalah crypto
    let changeText = "";
    if (from !== "IDR" && from !== "USDT") {
      const ticker = await get24hChange(from);
      if (ticker) {
        const emoji = ticker.priceChangePercent >= 0 
          ? '<tg-emoji emoji-id="6206343625232619150">📈</tg-emoji>' 
          : '<tg-emoji emoji-id="6206343625232619150">📉</tg-emoji>';
        const sign = ticker.priceChangePercent >= 0 ? "+" : "";
        changeText = `\n\n${emoji} ${sign}${ticker.priceChangePercent}%`;
      }
    }

    const message = `<tg-emoji emoji-id="6190336264940559752">💰</tg-emoji> ${amount.toLocaleString()} ${from} = ${formattedResult}${changeText}`;

    await bot.sendMessage(msg.chat.id, message, { 
      parse_mode: "HTML", 
      reply_to_message_id: msg.message_id 
    });

  } catch (err) {
    console.error("DEBUG CONVERT ERROR:", err.message);
    try {
      const errorMsg = await bot.sendMessage(msg.chat.id, `❌ Gagal konversi. Pastikan simbol koin benar (contoh: BTC, SOL, ETH).`, { 
        reply_to_message_id: msg.message_id 
      });
      
      // Hapus pesan error setelah 1 detik
      setTimeout(() => {
        bot.deleteMessage(msg.chat.id, errorMsg.message_id).catch(() => {});
      }, 1000);
    } catch (sendErr) {
      console.error("DEBUG SEND ERROR:", sendErr.message);
    }
  }
}

// Handler: [angka] [coin] [to] [coin] atau [angka] [coin] [coin]
bot.onText(/^(\d+(?:\.\d+)?)\s*([a-zA-Z0-9]{2,10})(?:\s*to\s*|\s+)([a-zA-Z0-9]{2,10})$/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const amount = parseFloat(match[1]);
  const from = match[2].toUpperCase();
  const to = match[3].toUpperCase();
  await performConversion(msg, amount, from, to);
});

// Handler: [angka] [coin] (misal: 1 sol)
bot.onText(/^(\d+(?:\.\d+)?)\s*([a-zA-Z0-9]{2,10})$/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const amount = parseFloat(match[1]);
  const from = match[2].toUpperCase();
  // Jika user input koin saja, default ke USDT (atau IDR jika koinnya USDT)
  const to = from === "USDT" ? "IDR" : "USDT";
  await performConversion(msg, amount, from, to);
});


// ==========================================
// FITUR KUIS
// ==========================================
let activeQuiz = null;

bot.onText(/^\/quiz\s+(\d+)\s+([a-zA-Z0-9]+)\s+(\d+)$/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const chatId = msg.chat.id;
  const nominal = parseInt(match[1]);
  const koin = match[2].toUpperCase();
  const pemenang = parseInt(match[3]);

  try {
    const admins = await bot.getChatAdministrators(chatId);
    const isAdmin = admins.some(a => a.user.id === msg.from.id);
    if (!isAdmin) return bot.sendMessage(chatId, '❌ Hanya admin yang bisa membuat kuis.');

    activeQuiz = {
      chatId,
      nominal,
      koin,
      pemenang,
      pemenangList: [],
      isActive: true
    };
    
    bot.sendMessage(chatId, `🎉 <b>KUIS DIMULAI!</b> 🎉\n\n🎁 Hadiah: <b>${nominal} ${koin}</b>\n🏆 Untuk: <b>${pemenang} Pemenang Pertama</b>\n\nSiapa cepat dia dapat!`, { parse_mode: 'HTML' });
  } catch (err) { }
});

bot.onText(/^\/saldoquiz$/i, async (msg) => {
  if (!checkAllowed(msg)) return;
  if (!activeQuiz || !activeQuiz.isActive) return bot.sendMessage(msg.chat.id, '❌ Tidak ada kuis aktif.');
  bot.sendMessage(msg.chat.id, `💰 Sisa slot pemenang: ${activeQuiz.pemenang - activeQuiz.pemenangList.length}`);
});

// ==========================================
// FITUR TANYA AI
// ==========================================
const aiHistory = new Map();

bot.onText(/^\/tanya\s+([\s\S]+)/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  const question = match[1];
  const historyKey = `${msg.chat.id}_${msg.from.id}`;

  try {
    const processingMsg = await bot.sendMessage(msg.chat.id, '⏳ <i>Mencari jawaban...</i>', { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    
    let history = aiHistory.get(historyKey) || [];
    history.push({ role: 'user', content: question });
    if (history.length > 10) history = history.slice(history.length - 10);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: history,
    });

    const answer = response.choices[0].message.content;
    history.push({ role: 'assistant', content: answer });
    aiHistory.set(historyKey, history);

    await bot.editMessageText(answer, {
      chat_id: msg.chat.id,
      message_id: processingMsg.message_id,
      parse_mode: 'Markdown'
    });
  } catch (err) { }
});

// ==========================================
// FITUR MYADMIN
// ==========================================
bot.onText(/^\/myadmin(?:\s+([\s\S]+))?/i, async (msg, match) => {
  if (!checkAllowed(msg)) return;
  if (msg.chat.type === 'private') return bot.sendMessage(msg.chat.id, '❌ Perintah ini hanya bisa digunakan di dalam grup.');

  const extraText = match[1] ? match[1].trim() : '';

  if (extraText) {
    const adminListHardcoded = ['@lonyello', '@Reckoner1', '@lgibtmls', '@son_ying', '@SykesArs', '@salsa012', '@Semogawan', '@brokoligur', '@ntahsiapa43', '@maddragon66', '@Muntjacc', '@touyasn', '@slomotiong', '@HideB0B', '@syavlyy', '@theEnd134567892', '@Harlan27', '@lengserkan_prabowo'];
    if (userClient && userClient.connected) {
       const messageToSend = `${extraText} ${adminListHardcoded.join(' ')}`;
       bot.sendMessage(msg.chat.id, '⏳ <i>Mengirim pesan tag via Userbot...</i>', { parse_mode: 'HTML', reply_to_message_id: msg.message_id }).then(sentMsg => {
           userClient.sendMessage(msg.chat.id.toString(), { message: messageToSend, parseMode: 'html' })
             .then(() => bot.deleteMessage(msg.chat.id, sentMsg.message_id).catch(()=>{}))
             .catch(() => bot.editMessageText('❌ Gagal', { chat_id: msg.chat.id, message_id: sentMsg.message_id }).catch(()=>{}));
       });
    } else {
       bot.sendMessage(msg.chat.id, '❌ Userbot belum terhubung.', { reply_to_message_id: msg.message_id });
    }
  } else {
    try {
      const admins = await bot.getChatAdministrators(msg.chat.id);
      let adminListDynamic = [];
      for (const admin of admins) {
        if (!admin.user.is_bot) {
          adminListDynamic.push(admin.user.username ? `@${admin.user.username}` : `<a href="tg://user?id=${admin.user.id}">${admin.user.first_name}</a>`);
        }
      }
      if (adminListDynamic.length > 0) bot.sendMessage(msg.chat.id, `👮‍♂️ <b>Daftar Admin:</b>\n\n` + adminListDynamic.join('\n'), { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    } catch (err) {}
  }
});

// ==========================================
// FITUR HY YAPS
// ==========================================
bot.onText(/hy yaps/i, async (msg) => {
  if (!checkAllowed(msg)) return;
  bot.sendMessage(msg.chat.id, 'hallo kak yaps di sini', { reply_to_message_id: msg.message_id });
});

// ==========================================
// FITUR CAPTCHA (KNOK KNOK)
// ==========================================
const pendingVerifications = new Map();

function escapeHtml(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

bot.on('new_chat_members', async (msg) => {
  if (!checkAllowed(msg)) return;
  const chatId = msg.chat.id;
  for (const newMember of msg.new_chat_members) {
    if (newMember.is_bot) continue;
    
    const safeName = escapeHtml(newMember.first_name);
    const mentionText = newMember.username ? `@${newMember.username}` : `<a href="tg://user?id=${newMember.id}">${safeName}</a>`;
    
    let sentMsg;
    try {
      sentMsg = await bot.sendMessage(chatId, `${mentionText} KNOK KNOK who is there?`, { parse_mode: 'HTML' });
    } catch (e) {
      console.error("Gagal kirim pesan CAPTCHA:", e.message);
    }
    
    const userId = newMember.id;
    const timeoutId = setTimeout(async () => {
      // 1. Kirim pesan pemberitahuan kick
      try {
        await bot.sendMessage(chatId, `${mentionText} telah di kick karna tidak membalas pesan ku`, { parse_mode: 'HTML' });
      } catch (err) {
        console.error("Gagal kirim pesan kick:", err.message || err);
      }

      // 2. Lakukan kick (ban + unban agar bisa join lagi nanti)
      try {
        await bot.banChatMember(chatId, userId);
        await bot.unbanChatMember(chatId, userId);
      } catch (err) {
        console.error("Gagal kick member:", err.message || err);
      }

      // 3. Hapus pesan KNOK KNOK awal
      if (sentMsg) {
        try {
          await bot.deleteMessage(chatId, sentMsg.message_id);
        } catch (err) {}
      }

      pendingVerifications.delete(`${chatId}_${userId}`);
    }, 10000);

    if (sentMsg) {
      pendingVerifications.set(`${chatId}_${userId}`, { messageId: sentMsg.message_id, timeoutId });
    }
  }
});

bot.on('message', async (msg) => {
  if (msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.is_bot) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const pendingKey = `${chatId}_${userId}`;
    if (pendingVerifications.has(pendingKey)) {
      const verification = pendingVerifications.get(pendingKey);
      if (msg.reply_to_message.message_id === verification.messageId) {
        clearTimeout(verification.timeoutId);
        pendingVerifications.delete(pendingKey);
        await bot.sendMessage(chatId, 'resmi join grub', { reply_to_message_id: msg.message_id });
      }
    }
  }
});

// ==========================================
// FITUR DAFTAR COMMAND (/fatality)
// ==========================================
bot.onText(/^\/fatality$/i, (msg) => {
  if (!checkAllowed(msg)) return;
  const commandList = `🤖 <b>DAFTAR COMMAND BOT</b> 🤖\n\n📌 <b>Fitur Utama:</b>\n• <code>/tanya [pertanyaan]</code> - Bertanya kepada AI.\n• <code>/myadmin</code> - Melihat daftar admin grup.\n• <code>/myadmin [pesan]</code> - (Userbot) Men-tag semua admin.\n\n🎮 <b>Fitur Kuis:</b>\n• <code>/quiz [nominal] [koin] [jumlah_pemenang]</code> - Membuat kuis (Hanya Admin).\n• <code>/saldoquiz</code> - Mengecek saldo untuk kuis.\n\n💱 <b>Fitur Konversi Kripto:</b>\n• <code>[angka] [koin] to [koin]</code> - Konversi harga koin (contoh: <code>1 btc to usdt</code>).\n• <code>[angka] [koin]</code> - Cek harga ke USDT/IDR (contoh: <code>1 sol</code>).\n\n📊 <b>Fitur Analisa Trading AI:</b>\n• Kirim / Reply gambar chart ke bot dengan caption bebas.\n\n🛡️ <b>Fitur Otomatis (Auto):</b>\n• <b>Captcha:</b> Tes KNOK KNOK (10 detik).\n• <b>Auto-reply:</b> Ketik <code>hy yaps</code>.\n`;
  bot.sendMessage(msg.chat.id, commandList, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});
