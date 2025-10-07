import { getOrderBook } from "./get-orderbook.js";
import { setOrderLimit } from "./set-order-limit.js";
import { getCurrentPrice } from "./get-current-price-mazdax.js";

/**
 * Place a series of buy limit orders based on the gap between current price and top bid.
 * Rules:
 * - If gap <= 1: do nothing
 * - If 1 < gap < 10: place `gap` orders at price = currentPrice - 1, amount = 50
 * - If gap >= 10: place 10 orders with prices currentPrice - 1, -2, ..., -10, amount = 50
 * @param {string} symbol
 * @returns {Promise<{placed:number, gap:number, orders:Array}>}
 */
export async function placeBuyLadderBasedOnGap(
  symbol = "AHRM1IRR",
  deps = { getCurrentPrice, getOrderBook, setOrderLimit }
) {
  const priceRes = await deps.getCurrentPrice(symbol);
  if (!priceRes.status) {
    return { placed: 0, gap: 0, orders: [], error: priceRes.message };
  }

  const currentPrice = Math.floor(parseFloat(priceRes.lastPrice));
  const ob = await deps.getOrderBook(symbol, 1);
  const topBid =
    Array.isArray(ob?.bids) && ob.bids.length > 0
      ? Math.floor(parseFloat(ob.bids[0][0]))
      : null;
  if (!topBid || Number.isNaN(topBid)) {
    return { placed: 0, gap: 0, orders: [], error: "invalid orderbook bids" };
  }
  const rawGap = Math.abs(currentPrice - topBid);

  const ordersToPlace = [];
  if (rawGap <= 1) {
    for (let i = 1; i <= 10; i++) {
      ordersToPlace.push(currentPrice - i);
    }
  } else if (rawGap < 10) {
    for (let i = 0; i < rawGap; i++) {
      ordersToPlace.push(currentPrice - 1);
    }
  } else {
    for (let i = 1; i <= 10; i++) {
      ordersToPlace.push(currentPrice - i);
    }
  }

  const placedOrders = [];
  const failedOrders = [];
  for (const price of ordersToPlace) {
    const order = {
      symbol,
      side: "BUY",
      orderType: "limit",
      market: "IRR",
      amount: 50,
      price,
      source: "short-mechanism-ladder",
    };
    const res = await deps.setOrderLimit(order);
    if (res?.status) {
      console.log(`[ladder-buy] placed @ ${price}`);
      placedOrders.push(res.order);
    } else {
      console.log(
        `[ladder-buy] failed @ ${price}: ${res?.message || "unknown"}`
      );
      failedOrders.push({ price, error: res?.message });
    }
  }

  return {
    placed: placedOrders.length,
    failed: failedOrders.length,
    gap: rawGap,
    orders: placedOrders,
    failures: failedOrders,
  };
}

/**
 * Place a series of SELL limit orders based on gap between top ask and current price.
 * Same rules as buy ladder but prices increase by 1:
 * - If gap <= 1: no orders
 * - If 1 < gap < 10: place `gap` orders all at price = currentPrice + 1
 * - If gap >= 10: place 10 orders at prices currentPrice + 1 .. currentPrice + 10
 * @param {string} symbol
 * @param {object} deps
 */
export async function placeSellLadderBasedOnGap(
  symbol = "AHRM1IRR",
  deps = { getCurrentPrice, getOrderBook, setOrderLimit }
) {
  const priceRes = await deps.getCurrentPrice(symbol);
  if (!priceRes.status) {
    return { placed: 0, gap: 0, orders: [], error: priceRes.message };
  }

  const currentPrice = Math.floor(parseFloat(priceRes.lastPrice));
  const ob = await deps.getOrderBook(symbol, 1);
  const topAsk =
    Array.isArray(ob?.asks) && ob.asks.length > 0
      ? Math.floor(parseFloat(ob.asks[0][0]))
      : null; // conditions
  if (!topAsk || Number.isNaN(topAsk)) {
    return { placed: 0, gap: 0, orders: [], error: "invalid orderbook asks" };
  }

  const rawGap = Math.abs(topAsk - currentPrice);

  const prices = [];
  if (rawGap <= 1) {
    prices.push(currentPrice + 1);
  } else if (rawGap < 10) {
    for (let i = 0; i < rawGap; i++) prices.push(currentPrice + 1);
  } else {
    for (let i = 1; i <= 10; i++) prices.push(currentPrice + i);
  }

  const placedOrders = [];
  const failedOrders = [];
  for (const price of prices) {
    const order = {
      symbol,
      side: "SELL",
      orderType: "limit",
      market: "IRR",
      amount: 50,
      price,
      source: "short-mechanism-sell-ladder",
    };
    const res = await deps.setOrderLimit(order);
    if (res?.status) {
      console.log(`[ladder-sell] placed @ ${price}`);
      placedOrders.push(res.order);
    } else {
      console.log(
        `[ladder-sell] failed @ ${price}: ${res?.message || "unknown"}`
      );
      failedOrders.push({ price, error: res?.message });
    }
  }

  return {
    placed: placedOrders.length,
    failed: failedOrders.length,
    gap: rawGap,
    orders: placedOrders,
    failures: failedOrders,
  };
}

/**
 * Place BUY and SELL ladders concurrently.
 * @param {string} symbol
 * @param {object} deps
 * @returns {Promise<{buy:any,sell:any}>}
 */
export async function placeBothLadders(
  symbol = "AHRM1IRR",
  deps = { getCurrentPrice, getOrderBook, setOrderLimit }
) {
  const [buy, sell] = await Promise.all([
    placeBuyLadderBasedOnGap(symbol, deps),
    placeSellLadderBasedOnGap(symbol, deps),
  ]);
  return { buy, sell };
}

/**
 * Calculate target price for short mechanism
 * Formula: (1% * sahra_last_price) + sahra_last_price
 * @param {number} sahraLastPrice - The last price from Sahra
 * @returns {number} Target price
 */
export function calculateTargetPrice(sahraLastPrice) {
  if (typeof sahraLastPrice !== "number" || sahraLastPrice <= 0) {
    throw new Error("Invalid sahra last price");
  }

  const onePercent = sahraLastPrice * 0.01; // 1% of sahra last price
  return onePercent + sahraLastPrice;
}

/**
 * Calculate long-side target price: 1% below Sahra last price
 * @param {number} sahraLastPrice
 */
export function calculateLongTargetPrice(sahraLastPrice) {
  if (typeof sahraLastPrice !== "number" || sahraLastPrice <= 0) {
    throw new Error("Invalid sahra last price");
  }
  const onePercent = sahraLastPrice * 0.01;
  return sahraLastPrice - onePercent;
}

/**
 * Analyze orderbook bids to calculate total amount for short mechanism
 * Sums amounts from all bid layers where price > target_price
 * @param {Array} bids - Array of [price, amount] pairs from orderbook
 * @param {number} targetPrice - Target price to compare against
 * @returns {number} Total amount from qualifying bid layers
 */
export function calculateTotalAmountFromBids(bids, targetPrice) {
  if (!Array.isArray(bids)) {
    throw new Error("Bids must be an array");
  }

  let totalAmount = 0;
  let foundExactMatch = false;
  let needsBuyOrder = false;

  for (const bid of bids) {
    if (!Array.isArray(bid) || bid.length < 2) {
      continue; // Skip invalid bid format
    }

    const [price, amount] = bid;
    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);

    if (isNaN(priceNum) || isNaN(amountNum)) {
      continue; // Skip invalid numeric values
    }

    // If price > target_price, add to total amount
    if (priceNum > targetPrice) {
      totalAmount += amountNum;
    }
    // If price = target_price, add to total and stop
    else if (priceNum === targetPrice) {
      totalAmount += amountNum;
      foundExactMatch = true;
      break;
    }
    // If price < target_price, we need to place a buy order
    else if (priceNum < targetPrice) {
      needsBuyOrder = true;
      break;
    }
  }

  // If we need a buy order, add the buy amount to total amount
  const finalTotalAmount = needsBuyOrder ? totalAmount + 50 : totalAmount;

  return {
    totalAmount: finalTotalAmount,
    needsBuyOrder: !foundExactMatch && needsBuyOrder,
    buyOrderPrice: targetPrice,
    buyOrderAmount: 50,
  };
}

/**
 * Analyze orderbook asks to calculate total units we can buy up to target price
 * Sums amounts from all ask layers where price < target_price; includes exact match
 * @param {Array} asks - Array of [price, amount]
 * @param {number} targetPrice
 * @returns {{totalUnits:number}}
 */
export function calculateTotalUnitsFromAsks(asks, targetPrice) {
  if (!Array.isArray(asks)) {
    throw new Error("Asks must be an array");
  }

  let totalUnits = 0;
  let totalQuote = 0;
  let foundExactMatch = false;
  let needsTopUp = false;

  for (const ask of asks) {
    if (!Array.isArray(ask) || ask.length < 2) continue;
    const [price, amount] = ask;
    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);
    if (Number.isNaN(priceNum) || Number.isNaN(amountNum)) continue;

    // If price < target_price, accumulate
    if (priceNum < targetPrice) {
      totalUnits += amountNum;
      totalQuote += priceNum * amountNum;
    }
    // If price == target_price, include and stop
    else if (priceNum === targetPrice) {
      totalUnits += amountNum;
      totalQuote += priceNum * amountNum;
      foundExactMatch = true;
      break;
    }
    // If price > target_price, we need a top-up at target
    else if (priceNum > targetPrice) {
      needsTopUp = true;
      break;
    }
  }

  // If we need a top-up, add 50 units at target price
  if (!foundExactMatch && needsTopUp) {
    totalUnits += 50;
    totalQuote += 50 * targetPrice;
  }

  return {
    totalUnits,
    totalQuote,
    needsTopUp,
    foundExactMatch,
  };
}

/**
 * Place a buy limit order at target price with amount 50
 * @param {number} targetPrice - The target price to place the buy order
 * @param {string} symbol - Trading symbol (default: AHRM1IRR)
 * @returns {Object} Result of the buy limit order placement
 */
export async function placeBuyLimitOrder(targetPrice, symbol = "AHRM1IRR") {
  try {
    console.log(`Placing buy limit order at target price: ${targetPrice}`);

    const order = {
      symbol: symbol,
      side: "BUY",
      orderType: "limit",
      market: "IRR",
      amount: Math.ceil(100000 / targetPrice), // Calculate minimum amount to meet 100,000 IRR requirement
      price: targetPrice,
      source: "short-mechanism-buyback",
    };

    const result = await setOrderLimit(order);

    if (result.status) {
      console.log("✅ Buy limit order placed successfully!");
      console.log("Buy order details:", result.order);

      const calculatedAmount = Math.ceil(100000 / targetPrice);
      return {
        success: true,
        message: "Buy limit order placed successfully",
        targetPrice,
        amount: calculatedAmount,
        totalValue: calculatedAmount * targetPrice,
        order: result.order,
      };
    } else {
      const calculatedAmount = Math.ceil(100000 / targetPrice);
      return {
        success: false,
        message: `Buy limit order failed: ${result.message}`,
        targetPrice,
        amount: calculatedAmount,
        totalValue: calculatedAmount * targetPrice,
        orderError: result.message,
      };
    }
  } catch (error) {
    console.error("❌ Buy limit order error:", error.message);
    const calculatedAmount = Math.ceil(100000 / targetPrice);
    return {
      success: false,
      message: `Buy limit order failed: ${error.message}`,
      targetPrice,
      amount: calculatedAmount,
      totalValue: calculatedAmount * targetPrice,
      error: error.message,
    };
  }
}

/**
 * Monitor AHRM1IRR price continuously until it reaches target price, then place buy limit order
 * @param {number} targetPrice - The target price for the buy limit order
 * @param {number} initialPrice - The initial price when short was executed
 * @param {string} symbol - Trading symbol (default: AHRM1IRR)
 * @param {number} checkInterval - How often to check price in seconds (default: 10)
 * @param {number} maxWaitTime - Maximum time to wait in minutes (default: 30)
 * @returns {Object} Result of the price monitoring and order placement
 */
export async function monitorPriceUntilTargetAndPlaceBuyOrder(
  targetPrice,
  initialPrice,
  symbol = "AHRM1IRR",
  checkInterval = 10, // Check every 10 seconds
  maxWaitTime = 30 // Wait maximum 30 minutes
) {
  try {
    console.log(`Starting continuous price monitoring for ${symbol}...`);
    console.log(`Initial price: ${initialPrice}`);
    console.log(`Target price for buy order: ${targetPrice}`);
    console.log(`Check interval: ${checkInterval} seconds`);
    console.log(`Max wait time: ${maxWaitTime} minutes`);

    const startTime = Date.now();
    const maxWaitMs = maxWaitTime * 60 * 1000; // Convert to milliseconds
    let checkCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      checkCount++;
      console.log(`\n--- Price Check #${checkCount} ---`);

      // Check current price
      const priceResult = await getCurrentPrice(symbol);

      if (!priceResult.status) {
        console.log(`❌ Failed to get current price: ${priceResult.message}`);
        await new Promise((resolve) =>
          setTimeout(resolve, checkInterval * 1000)
        );
        continue;
      }

      const currentPrice = parseFloat(priceResult.lastPrice);
      console.log(`Current price: ${currentPrice}`);
      console.log(`Target price: ${targetPrice}`);

      // Check if price has reached or dropped below target price
      if (currentPrice <= targetPrice) {
        console.log(
          `✅ Target price reached! Current: ${currentPrice} <= Target: ${targetPrice}`
        );

        // Place buy limit order
        const buyResult = await placeBuyLimitOrder(targetPrice, symbol);

        return {
          success: buyResult.success,
          message: buyResult.message,
          currentPrice,
          targetPrice,
          initialPrice,
          priceDrop: ((initialPrice - currentPrice) / initialPrice) * 100,
          checkCount,
          waitTime: Math.round((Date.now() - startTime) / 1000),
          buyOrder: buyResult,
        };
      } else {
        const priceDiff = currentPrice - targetPrice;
        const priceDiffPercent =
          ((currentPrice - targetPrice) / targetPrice) * 100;
        console.log(
          `Price still above target. Difference: ${priceDiff.toFixed(
            2
          )} (${priceDiffPercent.toFixed(2)}%)`
        );
        console.log(`Waiting ${checkInterval} seconds before next check...`);

        await new Promise((resolve) =>
          setTimeout(resolve, checkInterval * 1000)
        );
      }
    }

    // Timeout reached
    console.log(`⏰ Timeout reached after ${maxWaitTime} minutes`);
    return {
      success: false,
      message: `Timeout: Price did not reach target ${targetPrice} within ${maxWaitTime} minutes`,
      currentPrice: null,
      targetPrice,
      initialPrice,
      checkCount,
      waitTime: Math.round((Date.now() - startTime) / 1000),
    };
  } catch (error) {
    console.error("❌ Price monitoring error:", error.message);
    return {
      success: false,
      message: `Price monitoring failed: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Monitor AHRM1IRR price and place buy limit order when price dumps (legacy function)
 * @param {number} targetPrice - The target price for the buy limit order
 * @param {number} initialPrice - The initial price when short was executed
 * @param {string} symbol - Trading symbol (default: AHRM1IRR)
 * @param {number} dumpThreshold - Percentage drop to consider as "dump" (default: 2%)
 * @returns {Object} Result of the price monitoring and order placement
 */
export async function monitorPriceAndPlaceBuyOrder(
  targetPrice,
  initialPrice,
  symbol = "AHRM1IRR",
  dumpThreshold = 0.02 // 2% drop
) {
  try {
    console.log(`Starting price monitoring for ${symbol}...`);
    console.log(`Initial price: ${initialPrice}`);
    console.log(`Target price for buy order: ${targetPrice}`);
    console.log(`Dump threshold: ${(dumpThreshold * 100).toFixed(1)}%`);

    // Check current price
    const priceResult = await getCurrentPrice(symbol);

    if (!priceResult.status) {
      return {
        success: false,
        message: `Failed to get current price: ${priceResult.message}`,
        currentPrice: null,
      };
    }

    const currentPrice = parseFloat(priceResult.lastPrice);
    console.log(`Current price: ${currentPrice}`);

    // Calculate price drop percentage
    const priceDrop = (initialPrice - currentPrice) / initialPrice;
    console.log(`Price drop: ${(priceDrop * 100).toFixed(2)}%`);

    // Check if price has dumped enough
    if (priceDrop >= dumpThreshold) {
      console.log(
        `✅ Price dump detected! Drop: ${(priceDrop * 100).toFixed(2)}% >= ${(
          dumpThreshold * 100
        ).toFixed(1)}%`
      );

      // Place buy limit order
      const buyResult = await placeBuyLimitOrder(targetPrice, symbol);

      return {
        success: buyResult.success,
        message: buyResult.message,
        currentPrice,
        priceDrop: priceDrop * 100,
        dumpThreshold: dumpThreshold * 100,
        buyOrder: buyResult,
      };
    } else {
      console.log(
        `Price drop not significant enough. Drop: ${(priceDrop * 100).toFixed(
          2
        )}% < ${(dumpThreshold * 100).toFixed(1)}%`
      );

      return {
        success: false,
        message: `Price drop not significant enough. Drop: ${(
          priceDrop * 100
        ).toFixed(2)}% < ${(dumpThreshold * 100).toFixed(1)}%`,
        currentPrice,
        priceDrop: priceDrop * 100,
        dumpThreshold: dumpThreshold * 100,
      };
    }
  } catch (error) {
    console.error("❌ Price monitoring error:", error.message);
    return {
      success: false,
      message: `Price monitoring failed: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Execute short mechanism: analyze orderbook, place market sell order, monitor for target price
 * @param {number} sahraLastPrice - Last price from Sahra
 * @param {string} symbol - Trading symbol (default: AHRM1IRR)
 * @param {number} targetPrice - Pre-calculated target price (calculated when threshold triggered)
 * @returns {Object} Result of the short mechanism execution
 */
export async function executeShortMechanism(
  sahraLastPrice,
  symbol = "AHRM1IRR",
  targetPrice = null
) {
  try {
    console.log(`Starting short mechanism for ${symbol}...`);
    console.log(`Sahra last price: ${sahraLastPrice}`);

    // Step 1: Use provided target price or calculate if not provided
    const finalTargetPrice =
      targetPrice || calculateTargetPrice(sahraLastPrice);
    console.log(
      `Target price: ${finalTargetPrice} ${
        targetPrice ? "(provided)" : "(calculated)"
      }`
    );

    // Step 2: Get orderbook
    console.log("Fetching orderbook...");
    const orderbook = await getOrderBook(symbol, 20); // Get more levels for better analysis

    if (!orderbook || !Array.isArray(orderbook.bids)) {
      throw new Error("Invalid orderbook data received");
    }

    console.log(`Orderbook bids:`, orderbook.bids);

    // Step 3: Calculate total amount from qualifying bids
    const bidAnalysis = calculateTotalAmountFromBids(
      orderbook.bids,
      finalTargetPrice
    );
    const totalAmount = bidAnalysis.totalAmount;
    console.log(`Total amount from qualifying bids: ${totalAmount}`);

    if (!totalAmount || totalAmount <= 0) {
      return {
        success: false,
        message: "No qualifying bids found (no bids with price > target price)",
        targetPrice: finalTargetPrice,
        totalAmount: 0,
      };
    }

    // Step 4: Place market sell order
    console.log(`Placing market sell order for amount: ${totalAmount}`);
    const order = {
      symbol: symbol,
      side: "SELL",
      orderType: "market",
      market: "IRR",
      amount: totalAmount,
      source: "short-mechanism",
    };

    const result = await setOrderLimit(order);

    if (result.status) {
      console.log("✅ Short mechanism executed successfully!");
      console.log("Order details:", result.order);

      // Get current AHRM1IRR price for monitoring
      const currentPriceResult = await getCurrentPrice(symbol);
      const currentPrice = currentPriceResult.status
        ? parseFloat(currentPriceResult.lastPrice)
        : null;

      console.log(`Current AHRM1IRR price: ${currentPrice}`);
      console.log(`Target price for buy limit order: ${finalTargetPrice}`);

      // After sell, place both buy and sell ladders based on gaps
      const ladders = await placeBothLadders(symbol);
      console.log("Ladders result:", ladders);

      // Monitor price continuously until it reaches target price
      let buyOrderResult = null;
      if (currentPrice) {
        console.log(
          "Starting continuous price monitoring until target price is reached..."
        );
        buyOrderResult = await monitorPriceUntilTargetAndPlaceBuyOrder(
          finalTargetPrice,
          currentPrice,
          symbol,
          10, // Check every 10 seconds
          30 // Wait maximum 30 minutes
        );
      }

      return {
        success: true,
        message: "Short mechanism executed successfully",
        targetPrice: finalTargetPrice,
        totalAmount,
        order: result.order,
        currentPrice,
        buyOrderResult,
      };
    } else {
      return {
        success: false,
        message: `Order failed: ${result.message}`,
        targetPrice: finalTargetPrice,
        totalAmount,
        orderError: result.message,
      };
    }
  } catch (error) {
    console.error("❌ Short mechanism error:", error.message);
    return {
      success: false,
      message: `Short mechanism failed: ${error.message}`,
      targetPrice: finalTargetPrice,
      error: error.message,
    };
  }
}

/**
 * Execute long mechanism: analyze orderbook, place limit buy at target price
 * @param {number} sahraLastPrice
 * @param {string} symbol
 * @param {number|null} targetPrice
 */
export async function executeLongMechanism(
  sahraLastPrice,
  symbol = "AHRM1IRR",
  targetPrice = null
) {
  try {
    const finalTargetPrice =
      targetPrice || calculateLongTargetPrice(sahraLastPrice);

    const orderbook = await getOrderBook(symbol, 20);
    if (!orderbook || !Array.isArray(orderbook.asks)) {
      throw new Error("Invalid orderbook data received");
    }

    const askAnalysis = calculateTotalUnitsFromAsks(
      orderbook.asks,
      finalTargetPrice
    );
    const totalUnits = askAnalysis.totalUnits;
    const totalQuote = askAnalysis.totalQuote;
    if (!totalUnits || totalUnits <= 0 || !totalQuote || totalQuote <= 0) {
      return {
        success: false,
        message:
          "No qualifying asks found (no asks with price <= target price)",
        targetPrice: finalTargetPrice,
        totalUnits: 0,
      };
    }

    // Place market BUY using total quote amount (mirrors short-side market SELL)
    const order = {
      symbol,
      side: "BUY",
      orderType: "market",
      market: "IRR",
      totalAmount: Math.round(totalQuote),
      source: "long-mechanism",
    };

    const result = await setOrderLimit(order);

    if (result.status) {
      return {
        success: true,
        message: "Long mechanism executed successfully",
        targetPrice: finalTargetPrice,
        totalUnits,
        totalQuote,
        needsTopUp: askAnalysis.needsTopUp,
        foundExactMatch: askAnalysis.foundExactMatch,
        order: result.order,
      };
    }

    return {
      success: false,
      message: `Order failed: ${result.message}`,
      targetPrice: finalTargetPrice,
      totalUnits,
      totalQuote,
      needsTopUp: askAnalysis.needsTopUp,
      foundExactMatch: askAnalysis.foundExactMatch,
      orderError: result.message,
    };
  } catch (error) {
    return {
      success: false,
      message: `Long mechanism failed: ${error.message}`,
      targetPrice: targetPrice || null,
      error: error.message,
    };
  }
}
