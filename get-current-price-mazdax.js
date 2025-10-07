import fetch from "node-fetch";
import { SecurityConfig } from "./config/config.js";
import { fileURLToPath } from "url";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

function formatTehran(date) {
  return new Intl.DateTimeFormat("en-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export async function getCurrentPrice(symbolName) {
  const base = SecurityConfig.Mazdax_config.endpoint_url_market;
  const url = `${base}/market/rollingprice?from=mazdax&symbol=${encodeURIComponent(
    symbolName
  )}`;

  const tryNumber = SecurityConfig.Sahra_config.getPriceSeries_tryNumber;
  const tryTime = SecurityConfig.Sahra_config.getPriceSeries_tryTime;

  let lastError = null;

  for (let attempt = 1; attempt <= tryNumber; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization:
            "Bearer ULRdBoxPmCzrokZtpX2tOB-WBj1YT3JK-ne8kaB02Ys2zbiGuaOgnqDPXsbGEhrWPHZcKfviWTfRR4XrZKYSZAOBzp8AFXW4cKwb9-SEkCj8vhLmwrGHQIsBfTLr6pwj",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const lastPrice = data?.[symbolName]?.lastPrice;

      if (lastPrice !== undefined && lastPrice !== null) {
        return { status: true, message: "ok", lastPrice };
      }

      return {
        status: false,
        message: "Mazdax last_price is empty",
        lastPrice: null,
      };
    } catch (err) {
      lastError = err;
      if (attempt < tryNumber) {
        await delay(tryTime);
        continue;
      }
    }
  }

  return {
    status: false,
    message: lastError
      ? String(lastError.message || lastError)
      : "request failed",
    lastPrice: null,
  };
}

// CLI usage when run directly with Node
const isMain = (() => {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  const symbol = process.argv[2] || "AHRM1IRR";

  console.log(`Starting Mazdax price polling for ${symbol} every 1 minute...`);
  console.log("Press Ctrl+C to stop");

  // Get price immediately
  getCurrentPrice(symbol)
    .then((res) => {
      const now = new Date();
      console.log(`[${formatTehran(now)}] status:`, res.status);
      console.log(`[${formatTehran(now)}] message:`, res.message);
      console.log(`[${formatTehran(now)}] last price:`, res.lastPrice);
    })
    .catch((e) => {
      const now = new Date();
      console.error(`[${formatTehran(now)}] Error:`, e);
    });

  // Set up interval to get price every 1 minute (60000ms)
  const interval = setInterval(async () => {
    try {
      const res = await getCurrentPrice(symbol);
      const now = new Date();
      console.log(`[${formatTehran(now)}] status:`, res.status);
      console.log(`[${formatTehran(now)}] message:`, res.message);
      console.log(`[${formatTehran(now)}] last price:`, res.lastPrice);
    } catch (e) {
      const now = new Date();
      console.error(`[${formatTehran(now)}] Error:`, e);
    }
  }, 60000);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nStopping price polling...");
    clearInterval(interval);
    process.exit(0);
  });
}
