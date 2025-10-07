import fetch from "node-fetch";
import { SecurityConfig } from "./config/config.js";
import { fileURLToPath } from "url";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

/**
 * Creates an order on Mazdax exchange
 * @param {Object} orderParams - Order parameters
 * @param {string} orderParams.symbol - Trading symbol (required)
 * @param {string} orderParams.side - Order side: "BUY" or "SELL" (required)
 * @param {string} orderParams.orderType - Order type: "market", "limit", "stopLimit", "OCO" (required)
 * @param {string} orderParams.market - Market identifier (required)
 * @param {number} [orderParams.amount] - Amount in base asset (for limit/stopLimit/SELL market orders)
 * @param {number} [orderParams.totalAmount] - Total amount in quote asset (for BUY market orders only)
 * @param {number} [orderParams.price] - Price for limit orders
 * @param {number} [orderParams.stopPrice] - Stop price for stopLimit and OCO orders
 * @param {Object} [orderParams.pairOrder] - Pair order for OCO orders
 * @param {string} [orderParams.originatedFrom] - Origin identifier
 * @param {string} [orderParams.source] - Client type
 * @param {string} [orderParams.sourceData] - Arbitrary JSON data
 * @returns {Promise<Object>} Order response
 */
export async function setOrderLimit(orderParams) {
  const {
    symbol,
    side,
    orderType,
    market,
    amount,
    totalAmount,
    price,
    stopPrice,
    pairOrder,
    originatedFrom,
    source,
    sourceData,
  } = orderParams;

  // Validation
  if (!symbol || !side || !orderType || !market) {
    throw new Error(
      "Missing required parameters: symbol, side, orderType, market"
    );
  }

  if (!["BUY", "SELL"].includes(side)) {
    throw new Error("side must be 'BUY' or 'SELL'");
  }

  if (!["market", "limit", "stopLimit", "OCO"].includes(orderType)) {
    throw new Error(
      "orderType must be 'market', 'limit', 'stopLimit', or 'OCO'"
    );
  }

  // Validate amount vs totalAmount
  if (orderType === "market" && side === "BUY") {
    if (!totalAmount) {
      throw new Error("totalAmount is required for market BUY orders");
    }
    if (amount) {
      throw new Error(
        "amount cannot be used with totalAmount for market BUY orders"
      );
    }
  } else {
    if (!amount) {
      throw new Error("amount is required for this order type");
    }
    if (totalAmount) {
      throw new Error("totalAmount can only be used with market BUY orders");
    }
  }

  // Validate OCO orders
  if (orderType === "OCO" && !pairOrder) {
    throw new Error("pairOrder is required for OCO orders");
  }

  // Validate stop orders
  if ((orderType === "stopLimit" || orderType === "OCO") && !stopPrice) {
    throw new Error("stopPrice is required for stopLimit and OCO orders");
  }

  // Validate limit orders
  if (orderType === "limit" && !price) {
    throw new Error("price is required for limit orders");
  }

  const base = SecurityConfig.Mazdax_config.endpoint_url_order;
  const url = `${base}/orders`;

  const tryNumber = SecurityConfig.Mazdax_config.sendOrder_tryNumber;
  const tryTime = SecurityConfig.Mazdax_config.sendOrder_tryTime;

  // Build request payload
  const payload = {
    symbol,
    side,
    orderType,
    market,
  };

  if (amount) payload.amount = amount;
  if (totalAmount) payload.totalAmount = totalAmount;
  if (price) payload.price = price;
  if (stopPrice) payload.stopPrice = stopPrice;
  if (pairOrder) payload.pairOrder = pairOrder;
  if (originatedFrom) payload.originatedFrom = originatedFrom;
  if (source) payload.source = source;
  if (sourceData) payload.sourceData = sourceData;

  let lastError = null;

  for (let attempt = 1; attempt <= tryNumber; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization:
            "Bearer DR1bKOiWI2A7J4SUdau6naAVgf22UCLLtBngs3w9V6Oj4vin8RiJLPjr68T2ZIgut9tCN0lyMYs8sinj6bm0g48zSu4JY-cBpplZhUZHalueCv82NbMEWNZn4mYfRG9C",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        status: true,
        message: "Order created successfully",
        order: data,
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
      : "Order creation failed",
    order: null,
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
  // Example usage
  const exampleOrder = {
    symbol: "AHRM1IRR",
    side: "BUY",
    orderType: "limit",
    market: "IRR",
    amount: 100,
    price: 50000,
    source: "market-making-bot",
  };

  console.log("Creating example order:", exampleOrder);

  setOrderLimit(exampleOrder)
    .then((result) => {
      console.log("Order result:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
