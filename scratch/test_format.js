import axios from "axios";

async function get24hChange(symbol) {
  try {
    const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`, { timeout: 5000 });
    return {
      priceChangePercent: parseFloat(res.data.priceChangePercent),
      lastPrice: parseFloat(res.data.lastPrice)
    };
  } catch (err) {
    try {
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

async function test() {
  const from = "SOL";
  const amount = 1;
  const result = 83.99;
  const to = "USDT";
  
  const formattedResult = to === "IDR" 
      ? `Rp ${Math.round(result).toLocaleString("id-ID")}` 
      : `${result > 0.01 ? result.toLocaleString("en-US", { maximumFractionDigits: 6 }) : result.toFixed(8)} ${to}`;

  let changeText = "";
  if (from !== "IDR" && from !== "USDT") {
    const ticker = await get24hChange(from);
    if (ticker) {
      const emoji = ticker.priceChangePercent >= 0 ? "📈" : "📉";
      const sign = ticker.priceChangePercent >= 0 ? "+" : "";
      changeText = ` | ${emoji} ${sign}${ticker.priceChangePercent}%`;
    }
  }

  const message = `💰 ${amount.toLocaleString()} ${from} = ${formattedResult}${changeText}`;
  console.log(message);
}

test();
