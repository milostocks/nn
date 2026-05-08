import axios from "axios";

async function testTicker() {
  const symbol = "SOLUSDT";
  try {
    const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    console.log(`Symbol: ${res.data.symbol}`);
    console.log(`Price: ${res.data.lastPrice}`);
    console.log(`Change %: ${res.data.priceChangePercent}`);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testTicker();
