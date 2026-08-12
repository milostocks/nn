const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

const search = `           try {
             let bio = "";
             if (userClient && userClient.connected) {
               try {
                 const fullUser = await userClient.invoke(new Api.users.GetFullUser({ id: userId }));
                 bio = fullUser.fullUser.about || "";
               } catch (e2) {
                 const userChat = await bot.getChat(userId);
                 bio = userChat.bio || "";
               }
             } else {
               const userChat = await bot.getChat(userId);
               bio = userChat.bio || "";
             }
             
             if (!bio.includes("@yaps_everydays")) {
                await bot.sendMessage(msg.chat.id, "Tolong tambahkan @yaps_everydays di bio (Tentang) Telegram Anda jika mau mengikuti kuis.", { reply_to_message_id: msg.message_id });
                return;
             }
           } catch (e) {
             console.error("Gagal mendapatkan bio user", e.message);
           }`;

const replace = `           try {
             const userChat = await bot.getChat(userId);
             const bio = userChat.bio || "";
             
             if (!bio.includes("@yaps_everydays")) {
                await bot.sendMessage(msg.chat.id, "Tolong tambahkan @yaps_everydays di bio (Tentang) Telegram Anda jika mau mengikuti kuis.", { reply_to_message_id: msg.message_id });
                return;
             }
           } catch (e) {
             console.error("Gagal mendapatkan bio user", e.message);
           }`;

if (c.includes('if (userClient && userClient.connected) {')) {
  c = c.replace(search.replace(/\n/g, '\r\n'), replace.replace(/\n/g, '\r\n'));
  c = c.replace(search, replace);
  fs.writeFileSync('bot.js', c);
  console.log("Reverted to bot bio check");
} else {
  console.log("Could not find the bio check block");
}
