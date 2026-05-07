import axios from "axios";
import { RSI, EMA } from "technicalindicators";

const BINANCE_FUTURES_API = "https://fapi.binance.com/fapi/v1";

// 1. Ambil semua token USDT di Binance Futures
export async function getUSDTPairs() {
  try {
    const response = await axios.get(`${BINANCE_FUTURES_API}/exchangeInfo`);
    const symbols = response.data.symbols
      .filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING" && s.contractType === "PERPETUAL")
      .map((s) => s.symbol);
    return symbols;
  } catch (error) {
    // console.error("Gagal mengambil exchangeInfo:", error.message);
    return [];
  }
}

// 2. Ambil data candlestick (Klines)
export async function getKlines(symbol, interval = "5m", limit = 100) {
  try {
    const response = await axios.get(`${BINANCE_FUTURES_API}/klines`, {
      params: { symbol, interval, limit },
    });

    // Format: [Open time, Open, High, Low, Close, Volume, Close time, ...]
    const klines = response.data.map((d) => ({
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
    return klines;
  } catch (error) {
    // console.error(`Gagal mengambil klines untuk ${symbol}:`, error.message);
    return null;
  }
}

// 3. Analisa satu koin menggunakan indikator teknikal
export async function analyzePair(symbol, interval = "5m", forceScan = false) {
  const klines = await getKlines(symbol, interval, 50);
  if (!klines || klines.length < 50) return null;

  const closes = klines.map((k) => k.close);
  
  // Hitung RSI (14)
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const currentRSI = rsiValues[rsiValues.length - 1];

  // Hitung EMA 20 & 50
  const ema20Values = EMA.calculate({ values: closes, period: 20 });
  const ema50Values = EMA.calculate({ values: closes, period: 50 });
  const currentEMA20 = ema20Values[ema20Values.length - 1];
  const currentEMA50 = ema50Values[ema50Values.length - 1];

  const currentPrice = closes[closes.length - 1];

  // LOGIC FILTER SEDERHANA:
  // Cari kondisi Oversold (RSI < 30) atau Overbought (RSI > 70)
  // Atau cari kondisi harga menembus EMA20 ke atas dengan momentum
  let signalType = null;
  let reason = "";
  let score = 0; // Tambahkan sistem skor untuk mencari yang "paling bagus"

  if (currentRSI < 30) {
    signalType = "LONG";
    const trend = currentPrice < currentEMA50 ? "Downtrend Kuat" : "Uptrend";
    reason = `RSI Sangat Rendah (Oversold: ${currentRSI.toFixed(2)}). Tren Saat Ini: ${trend}.`;
    score = 30 - currentRSI; // Semakin rendah RSI, semakin tinggi skor
  } else if (currentRSI > 70) {
    signalType = "SHORT";
    const trend = currentPrice > currentEMA50 ? "Uptrend Kuat" : "Downtrend";
    reason = `RSI Sangat Tinggi (Overbought: ${currentRSI.toFixed(2)}). Tren Saat Ini: ${trend}.`;
    score = currentRSI - 70; // Semakin tinggi RSI, semakin tinggi skor
  } else if (currentPrice > currentEMA20 && currentPrice > currentEMA50 && currentRSI > 55 && currentRSI < 70) {
    // Uptrend kuat
    signalType = "LONG";
    reason = `Uptrend kuat. Harga di atas EMA20 & EMA50. RSI Bullish (${currentRSI.toFixed(2)}).`;
    score = 5; // Skor standar untuk uptrend
  } else if (forceScan) {
    signalType = "ANALISA MANUAL";
    reason = `Permintaan analisa spesifik dari user. RSI berada di level ${currentRSI.toFixed(2)}.`;
    score = 0;
  }

  if (signalType) {
    return {
      symbol,
      price: currentPrice,
      rsi: currentRSI.toFixed(2),
      ema20: currentEMA20.toFixed(4),
      ema50: currentEMA50.toFixed(4),
      signalType,
      reason,
      score,
      klinesData: klines.slice(-10) // Kirim 10 candle terakhir untuk OpenAI
    };
  }

  return null;
}

// 4. Jalankan scanner ke seluruh market
export async function runMarketScanner(specificCoin = null) {
  // console.log("Memulai market scanner...");
  let targetPairs = [];

  if (specificCoin) {
    const symbol = specificCoin.toUpperCase().endsWith("USDT") ? specificCoin.toUpperCase() : `${specificCoin.toUpperCase()}USDT`;
    targetPairs = [symbol];
    // console.log(`Memulai analisa untuk koin spesifik: ${symbol}...`);
  } else {
    const pairs = await getUSDTPairs();
    if (pairs.length === 0) return [];

    // console.log(`Menemukan ${pairs.length} pair USDT. Memulai analisa...`);
    
    // Batasi hanya scan 50 pair teratas berdasarkan abjad/volume untuk menghemat waktu & rate limit
    // (Idealnya kita sort by volume, tapi untuk simplifikasi kita ambil 100 pertama)
    targetPairs = pairs.slice(0, 100); 
  }

  const signals = [];

  // Agar tidak terkena rate limit, gunakan Promise.all dengan batching (contoh batch per 10)
  for (let i = 0; i < targetPairs.length; i += 10) {
    const batch = targetPairs.slice(i, i + 10);
    const results = await Promise.all(batch.map((p) => analyzePair(p, "5m", !!specificCoin)));
    
    results.forEach((res) => {
      if (res) signals.push(res);
    });
  }

  // Urutkan sinyal berdasarkan skor tertinggi (yang paling extreme / paling bagus untuk entry)
  signals.sort((a, b) => b.score - a.score);

  // console.log(`Scanner selesai. Menemukan ${signals.length} potensi sinyal.`);
  return signals;
}
