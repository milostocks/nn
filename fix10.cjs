const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const oldStr = `"💡 <b>Panduan Membuat Kuis</b>\\n\\nGunakan format berikut:\\n<code>/quiz [jumlah_reward] [koin] [jumlah_pemenang]\\nq:\\n[Pertanyaan kuis]\\na:\\n[Jawaban1]\\n[Jawaban2]</code>\\n\\n<b>Contoh:</b>\\n<code>/quiz 10 usdt 5\\nq:\\na-z sambung sampe 3 huruf\\na:\\nwpx\\nqif</code>"`;

const newStr = `"💡 <b>Panduan Membuat Kuis</b>\\n\\n⚠️ <i>Sebelum membuat quiz, coba cek saldo dulu di grup dengan mengetik command</i> <code>/saldoquiz</code>\\n\\nGunakan format berikut:\\n<code>/quiz [jumlah_reward] [koin] [jumlah_pemenang]\\nq:\\n[Pertanyaan kuis]\\na:\\n[Jawaban1]\\n[Jawaban2]</code>\\n\\n<b>Contoh:</b>\\n<code>/quiz 10 usdt 5\\nq:\\na-z sambung sampe 3 huruf\\na:\\nwpx\\nqif</code>"`;

if (c.includes(oldStr)) {
  c = c.replace(oldStr, newStr);
  fs.writeFileSync('bot.js', c);
  console.log("Updated guide message");
} else {
  console.log("Could not find the guide message");
}
