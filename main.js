import { getCurrentPrice as getSahraPrice } from "./get-current-price-sahra.js";
import { getCurrentPrice as getMazdaxPrice } from "./get-current-price-mazdax.js";
import {
  executeShortMechanism,
  placeBothLadders,
  executeLongMechanism,
} from "./short-mechanism.js";
import { cancelOrders } from "./cancel-orders.js";

const SYMBOL_MAZDAX = "AHRM1IRR";
const SYMBOL_SAHRA = "IRT1AHRM0001:1";
const THRESHOLD = 0.01; // 1%
const SAHRA_RESOLUTIONS = ["1", "5", "15", "60", "1D"]; // fallback order

export function computeRelativeDiff(basePrice, comparePrice) {
  if (typeof basePrice !== "number" || typeof comparePrice !== "number")
    return null;
  if (basePrice === 0) return null;
  return Math.abs(comparePrice - basePrice) / basePrice;
}

export function shouldShort(mazdax, sahra, threshold) {
  const diff = computeRelativeDiff(sahra, mazdax);
  return diff !== null && mazdax > sahra && diff >= threshold;
}

export function shouldLong(mazdax, sahra, threshold) {
  const diff = computeRelativeDiff(sahra, mazdax);
  return diff !== null && mazdax < sahra && diff >= threshold;
}

async function fetchPricesOnce() {
  // Try Sahra with resolution fallbacks
  let sahraRes = null;
  let sahraResolutionUsed = null;
  for (const res of SAHRA_RESOLUTIONS) {
    // eslint-disable-next-line no-await-in-loop
    const attempt = await getSahraPrice(SYMBOL_SAHRA, { resolution: res });
    if (
      attempt?.status === true &&
      Array.isArray(attempt.priceSeries) &&
      attempt.priceSeries.length > 0
    ) {
      sahraRes = attempt;
      sahraResolutionUsed = res;
      break;
    }
  }

  const mazdaxRes = await getMazdaxPrice(SYMBOL_MAZDAX);

  const sahraOk =
    sahraRes &&
    Array.isArray(sahraRes.priceSeries) &&
    sahraRes.priceSeries.length > 0;
  const mazdaxLastCoerced = Number(mazdaxRes?.lastPrice);
  const mazdaxOk =
    mazdaxRes?.status === true && Number.isFinite(mazdaxLastCoerced);

  if (!sahraOk || !mazdaxOk) {
    return {
      ok: false,
      reason: {
        sahraOk,
        mazdaxOk,
        sahraResolutionTried: sahraResolutionUsed || SAHRA_RESOLUTIONS,
        mazdaxMessage: mazdaxRes?.message,
        mazdaxLastRaw: mazdaxRes?.lastPrice,
        mazdaxLastType: typeof mazdaxRes?.lastPrice,
      },
    };
  }

  const sahraLast = sahraRes.priceSeries[sahraRes.priceSeries.length - 1];
  const mazdaxLast = mazdaxLastCoerced;

  return {
    ok: true,
    sahra: sahraLast,
    mazdax: mazdaxLast,
    sahraResolutionUsed,
  };
}

async function tick() {
  try {
    const res = await fetchPricesOnce();
    if (!res.ok) {
      console.log("Fetch not ok", res.reason);
      return;
    }

    const { sahra, mazdax, sahraResolutionUsed } = res;

    const rel = (mazdax - sahra) / sahra;
    const pct = (rel * 100).toFixed(3);
    console.log(
      `Prices => Sahra(${sahraResolutionUsed}): ${sahra} | Mazdax: ${mazdax} | Diff: ${pct}%`
    );

    if (shouldShort(mazdax, sahra, THRESHOLD)) {
      await onShortSignal({ mazdax, sahra });
      return;
    }

    if (shouldLong(mazdax, sahra, THRESHOLD)) {
      await onLongSignal({ mazdax, sahra });
      return;
    }
  } catch (e) {
    console.log("Tick error", e?.message || e);
  }
}

async function onShortSignal(context) {
  console.log("SHORT signal detected", context);
  console.log(
    `1% threshold triggered! Mazdax: ${context.mazdax}, Sahra: ${context.sahra}`
  );

  try {
    // Calculate target price at the moment of threshold trigger
    const targetPrice = 0.01 * context.sahra + context.sahra;
    console.log(
      `Target price calculated: (1% × ${context.sahra}) + ${context.sahra} = ${targetPrice}`
    );

    const result = await executeShortMechanism(
      context.sahra,
      SYMBOL_MAZDAX,
      targetPrice
    );

    if (result.success) {
      console.log("✅ Short mechanism completed successfully");
      console.log(`Target price: ${result.targetPrice}`);
      console.log(`Total amount to SELL MARKET: ${result.totalAmount}`);

      if (result.needsBuyOrder) {
        console.log(
          `📝 Note: Buy limit order needed at ${result.buyOrderPrice} for ${result.buyOrderAmount} amount`
        );
        console.log(
          `💰 Total sell amount includes buy order: ${result.totalAmount}`
        );
      }

      // TODO: Execute market sell order with result.totalAmount
      console.log(`🚀 EXECUTE MARKET SELL: ${result.totalAmount} units`);
    } else {
      console.log("❌ Short mechanism failed:", result.message);
    }
  } catch (error) {
    console.error("❌ Error in short mechanism:", error.message);
  }
}

async function onLongSignal(context) {
  console.log("LONG signal detected", context);
  try {
    const targetPrice = context.sahra - 0.01 * context.sahra;
    const result = await executeLongMechanism(
      context.sahra,
      SYMBOL_MAZDAX,
      targetPrice
    );
    if (result.success) {
      console.log("✅ Long mechanism completed successfully");
      console.log(`Target price: ${result.targetPrice}`);
      console.log(`Total units to BUY LIMIT: ${result.totalUnits}`);
    } else {
      console.log("❌ Long mechanism failed:", result.message);
    }
  } catch (error) {
    console.error("❌ Error in long mechanism:", error.message);
  }
}

async function laddersTick() {
  try {
    // state across ticks
    if (typeof laddersTick.lastPrice !== "number") laddersTick.lastPrice = null;
    if (!Array.isArray(laddersTick.lastOrderIds)) laddersTick.lastOrderIds = [];

    const priceRes = await getMazdaxPrice(SYMBOL_MAZDAX);
    if (!priceRes?.status || !Number.isFinite(Number(priceRes.lastPrice))) {
      console.log("Ladders tick: invalid price", priceRes?.message);
      return;
    }

    const currentPrice = Math.floor(Number(priceRes.lastPrice));

    const priceChanged =
      laddersTick.lastPrice === null || currentPrice !== laddersTick.lastPrice;

    if (!priceChanged) {
      console.log("Ladders: price unchanged, skipping re-placement", {
        price: currentPrice,
      });
      return;
    }

    // cancel previous ladder orders if any
    if (laddersTick.lastOrderIds.length > 0) {
      try {
        const cancelRes = await cancelOrders(laddersTick.lastOrderIds);
        console.log(
          "Ladders: canceled previous orders",
          cancelRes?.result || cancelRes?.message
        );
      } catch (e) {
        console.log("Ladders: cancel error", e?.message || e);
      }
      laddersTick.lastOrderIds = [];
    }

    // place new ladders around current price
    const res = await placeBothLadders(SYMBOL_MAZDAX);
    const buyIds = Array.isArray(res?.buy?.orders)
      ? res.buy.orders
          .map((o) => o?.id ?? o?.orderId ?? o?.order?.id ?? o?.order?.orderId)
          .filter((v) => Number.isInteger(v))
      : [];
    const sellIds = Array.isArray(res?.sell?.orders)
      ? res.sell.orders
          .map((o) => o?.id ?? o?.orderId ?? o?.order?.id ?? o?.order?.orderId)
          .filter((v) => Number.isInteger(v))
      : [];

    laddersTick.lastOrderIds = [...buyIds, ...sellIds];
    laddersTick.lastPrice = currentPrice;

    console.log("Ladders (replaced)", {
      price: currentPrice,
      buyPlaced: res?.buy?.placed || 0,
      sellPlaced: res?.sell?.placed || 0,
      trackedOrderIds: laddersTick.lastOrderIds.length,
    });
  } catch (e) {
    console.log("Ladders tick error", e?.message || e);
  }
}

// run immediately, then every 1 minute
console.log("Market-making orchestrator started. Polling every 60s...");
tick();
setInterval(tick, 60_000);
// run ladder maintenance independently every 1 minute
laddersTick();
setInterval(laddersTick, 60_000);
