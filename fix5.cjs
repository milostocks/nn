const fs = require('fs');
let c = fs.readFileSync('bot.js', 'utf8');

c = c.replace('import { TelegramClient } from "telegram";', 'import { TelegramClient, Api } from "telegram";');

const oldBioCheck = `           try {
             const userChat = await bot.getChat(userId);
             const bio = userChat.bio || "";
             if (!bio.includes("@yaps_everydays")) {
                await bot.sendMessage(msg.chat.id, "Tolong tambahkan @yaps_everydays di bio (Tentang) Telegram Anda jika mau mengikuti kuis.", { reply_to_message_id: msg.message_id });
                return;
             }
           } catch (e) {
             console.error("Gagal mendapatkan bio user", e.message);
           }`;

const newBioCheck = `           try {
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

c = c.replace(oldBioCheck.replace(/\n/g, '\r\n'), newBioCheck.replace(/\n/g, '\r\n'));
c = c.replace(oldBioCheck, newBioCheck);

fs.writeFileSync('bot.js', c);
console.log('Fixed bio cache');
