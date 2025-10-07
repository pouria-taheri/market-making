import { getCurrentPrice as getSahraPrice } from "./get-current-price-sahra.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

function tehranYmd(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function tehranHms(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hh = parts.find((p) => p.type === "hour").value;
  const mm = parts.find((p) => p.type === "minute").value;
  const ss = parts.find((p) => p.type === "second").value;
  return { hh: Number(hh), mm: Number(mm), ss: Number(ss) };
}

function ensureDir(path) {
  try {
    mkdirSync(path, { recursive: true });
  } catch {}
}

function saveClose(symbol, record) {
  const dir = join(process.cwd(), "data");
  ensureDir(dir);
  const file = join(dir, `close-price-${symbol}.json`);
  let arr = [];
  if (existsSync(file)) {
    try {
      arr = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      arr = [];
    }
  }
  arr.push(record);
  writeFileSync(file, JSON.stringify(arr, null, 2));
}

async function captureClose(symbol) {
  const res = await getSahraPrice(symbol, { resolution: "1D" });
  const now = new Date();
  if (!res.status) {
    const rec = {
      tehranTime: formatTehran(now),
      isoUtc: now.toISOString(),
      status: false,
      message: res.message,
    };
    saveClose(symbol, rec);
    return { status: false, message: res.message };
  }

  const last = res.priceSeries[res.priceSeries.length - 1];
  const rec = {
    tehranTime: formatTehran(now),
    isoUtc: now.toISOString(),
    symbol,
    close: last,
  };
  saveClose(symbol, rec);
  return { status: true, record: rec };
}

async function runScheduler(symbol) {
  let lastTriggeredYmd = null;
  console.log(
    `Close-capture scheduler started for ${symbol}. Target: 12:30:00 Asia/Tehran`
  );

  const tick = async () => {
    const now = new Date();
    const { hh, mm, ss } = tehranHms(now);
    const ymd = tehranYmd(now);

    if (hh === 12 && mm === 30 && ss === 0 && lastTriggeredYmd !== ymd) {
      lastTriggeredYmd = ymd;
      try {
        const res = await captureClose(symbol);
        if (res.status) {
          console.log(
            `[${formatTehran(new Date())}] Stored close for ${symbol}:`,
            res.record.close
          );
        } else {
          console.log(
            `[${formatTehran(
              new Date()
            )}] Failed to fetch close for ${symbol}:`,
            res.message
          );
        }
      } catch (e) {
        console.error(
          `[${formatTehran(new Date())}] Error capturing close:`,
          String(e?.message || e)
        );
      }
    }
  };

  // Align to next second
  const align = 1000 - (Date.now() % 1000);
  setTimeout(() => {
    tick();
    setInterval(tick, 1000);
  }, align);
}

// CLI
// node store-close-price-sahra.js AHRM1IRR           -> daemon mode (12:30 daily)
// node store-close-price-sahra.js AHRM1IRR --once   -> capture immediately once
const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  const symbol = process.argv[2] || "AHRM1IRR";
  const once = process.argv.includes("--once");

  if (once) {
    captureClose(symbol)
      .then((res) => console.log(JSON.stringify(res, null, 2)))
      .catch((e) => {
        console.error(String(e?.message || e));
        process.exit(1);
      });
  } else {
    runScheduler(symbol);
  }
}
