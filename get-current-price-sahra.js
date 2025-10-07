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

export async function getCurrentPrice(
  symbolName,
  { resolution = "1D", commodity = false } = {}
) {
  const base = SecurityConfig.Sahra_config.endpoint_url;
  const path = commodity
    ? "/api/v1/FutureTradingView/History"
    : "/api/v1/TradingView/history";

  const now = Math.floor(Date.now() / 1000);
  const before = now - 4 * 24 * 60 * 60;

  const url =
    `${base}${path}` +
    `?symbol=${encodeURIComponent(symbolName)}` +
    `&resolution=${encodeURIComponent(resolution)}` +
    `&from=${before}` +
    `&to=${now}`;

  const tryNumber = SecurityConfig.Sahra_config.getPriceSeries_tryNumber;
  const tryTime = SecurityConfig.Sahra_config.getPriceSeries_tryTime;

  let lastError = null;

  for (let attempt = 1; attempt <= tryNumber; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const priceSeries = Array.isArray(data?.c) ? data.c : [];

      if (priceSeries && priceSeries.length > 1) {
        return { status: true, message: "ok", priceSeries };
      }

      return {
        status: false,
        message: `Resolution ${resolution} price list is empty`,
        priceSeries,
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
    priceSeries: [],
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
  const symbol = process.argv[2] || "IRT1AHRM0001:1";
  const resolution = process.argv[3] || "1D";

  console.log(`Starting price polling for ${symbol} every 1 minute...`);
  console.log("Press Ctrl+C to stop");

  // Get price immediately
  getCurrentPrice(symbol, { resolution })
    .then((res) => {
      const now = new Date();
      console.log(`[${formatTehran(now)}] status:`, res.status);
      console.log(`[${formatTehran(now)}] message:`, res.message);
      console.log(
        `[${formatTehran(now)}] last price:`,
        res.priceSeries[res.priceSeries.length - 1]
      );
    })
    .catch((e) => {
      const now = new Date();
      console.error(`[${formatTehran(now)}] Error:`, e);
    });

  // Set up interval to get price every 1 minute (60000ms)
  const interval = setInterval(async () => {
    try {
      const res = await getCurrentPrice(symbol, { resolution });
      const now = new Date();
      console.log(`[${formatTehran(now)}] status:`, res.status);
      console.log(`[${formatTehran(now)}] message:`, res.message);
      console.log(
        `[${formatTehran(now)}] last price:`,
        res.priceSeries[res.priceSeries.length - 1]
      );
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
