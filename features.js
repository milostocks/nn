// ==========================================
// FITUR RACING SERVER (TRACKER)
// ==========================================
const RACE_DATA_FILE = 'race_data.json';
let raceData = {};
try {
  if (fs.existsSync(RACE_DATA_FILE)) {
    raceData = JSON.parse(fs.readFileSync(RACE_DATA_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Gagal membaca race_data.json', e.message);
}

const saveRaceData = () => {
  try {
    fs.writeFileSync(RACE_DATA_FILE, JSON.stringify(raceData, null, 2));
  } catch (e) {}
};

// Reset race data every week (Sunday at midnight)
cron.schedule('0 0 * * 0', () => {
  console.log('⏰ Mereset data balapan mingguan...');
  raceData = {};
  saveRaceData();
});

const app = express();
app.use(cors());
app.use(express.static('public'));

app.get('/api/race-data', (req, res) => {
  const qualified = Object.values(raceData).filter(u => u.chatCount >= 1000);
  qualified.sort((a, b) => b.chatCount - a.chatCount);
  res.json({
    allPlayers: Object.values(raceData).sort((a, b) => b.chatCount - a.chatCount),
    qualifiedPlayers: qualified
  });
});

app.listen(3000, () => {
  console.log('🏁 Racing Web Server berjalan di port 3000');
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

bot.on('new_chat_members', async (msg) => {
  if (!checkAllowed(msg)) return;
  const chatId = msg.chat.id;
  for (const newMember of msg.new_chat_members) {
    if (newMember.is_bot) continue;
    const mentionText = newMember.username ? `@${newMember.username}` : `<a href="tg://user?id=${newMember.id}">${newMember.first_name}</a>`;
    const sentMsg = await bot.sendMessage(chatId, `${mentionText} KNOK KNOK who is there?`, { parse_mode: 'HTML' });
    const userId = newMember.id;
    const timeoutId = setTimeout(async () => {
      try {
        await bot.banChatMember(chatId, userId);
        await bot.unbanChatMember(chatId, userId);
        await bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
      } catch (err) {}
      pendingVerifications.delete(`${chatId}_${userId}`);
    }, 10000);
    pendingVerifications.set(`${chatId}_${userId}`, { messageId: sentMsg.message_id, timeoutId });
  }
});

bot.on('message', async (msg) => {
  // Track chat untuk Racing Website
  if (msg.from && !msg.from.is_bot && msg.chat.type !== 'private') {
    const userId = msg.from.id.toString();
    if (!raceData[userId]) {
      raceData[userId] = {
        userId: userId,
        username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
        chatCount: 0
      };
    }
    raceData[userId].chatCount += 1;
    if (raceData[userId].chatCount % 10 === 0 || raceData[userId].chatCount === 1) {
      saveRaceData();
    }
  }

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
