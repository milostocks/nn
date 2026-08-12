const { Api } = require("telegram");
console.log("CreateGroupCall exists:", !!Api.phone.CreateGroupCall);
console.log("DiscardGroupCall exists:", !!Api.phone.DiscardGroupCall);
console.log("GetFullChannel exists:", !!Api.channels.GetFullChannel);
