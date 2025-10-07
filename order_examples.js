import { setOrderLimit } from "./set-order-limit.js";

/**
 * Comprehensive examples for different order types on Mazdax
 */

// Example 1: Basic Limit Order
export async function createLimitOrder() {
  const order = {
    symbol: "AHRM1IRR", // Trading symbol
    side: "BUY", // Order side
    orderType: "limit", // Order type
    market: "IRR", // Market identifier
    amount: 100, // Amount in base asset
    price: 50000, // Limit price
    source: "market-making-bot", // Client identifier
  };

  return await setOrderLimit(order);
}

// Example 2: Market Buy Order (using totalAmount)
export async function createMarketBuyOrder() {
  const order = {
    symbol: "AHRM1IRR",
    side: "BUY",
    orderType: "market",
    market: "IRR",
    totalAmount: 1000000, // Total amount in quote asset (IRR)
    source: "market-making-bot",
  };

  return await setOrderLimit(order);
}

// Example 3: Market Sell Order (using amount)
export async function createMarketSellOrder() {
  const order = {
    symbol: "AHRM1IRR",
    side: "SELL",
    orderType: "market",
    market: "IRR",
    amount: 50, // Amount in base asset
    source: "market-making-bot",
  };

  return await setOrderLimit(order);
}

// Example 4: Stop Limit Order
export async function createStopLimitOrder() {
  const order = {
    symbol: "AHRM1IRR",
    side: "SELL",
    orderType: "stopLimit",
    market: "IRR",
    amount: 100,
    price: 48000, // Limit price
    stopPrice: 49000, // Stop price
    source: "risk-management",
  };

  return await setOrderLimit(order);
}

// Example 5: OCO (One-Cancels-Other) Order
export async function createOCOOrder() {
  const order = {
    symbol: "AHRM1IRR",
    side: "BUY",
    orderType: "OCO",
    market: "IRR",
    amount: 100,
    price: 45000, // Take profit price
    stopPrice: 46000, // Stop loss price
    pairOrder: {
      // Pair order for OCO
      side: "SELL",
      amount: 100,
      price: 55000,
    },
    source: "trading-bot",
  };

  return await setOrderLimit(order);
}

// Example 6: Order with additional metadata
export async function createOrderWithMetadata() {
  const order = {
    symbol: "ROBA1IRR",
    side: "BUY",
    orderType: "limit",
    market: "IRR",
    amount: 200,
    price: 25000,
    originatedFrom: "strategy-001",
    source: "automated-trader",
    sourceData: JSON.stringify({
      strategy: "mean-reversion",
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    }),
  };

  return await setOrderLimit(order);
}

// Example 7: Batch order creation
export async function createBatchOrders() {
  const symbols = ["AHRM1IRR", "ROBA1IRR", "KARF1IRR"];
  const orders = [];

  for (const symbol of symbols) {
    const order = {
      symbol,
      side: "BUY",
      orderType: "limit",
      market: "IRR",
      amount: 50,
      price: 50000,
      source: "batch-trader",
    };

    try {
      const result = await setOrderLimit(order);
      orders.push({ symbol, result });
    } catch (error) {
      orders.push({ symbol, error: error.message });
    }
  }

  return orders;
}

// Example 8: Error handling wrapper
export async function createOrderWithErrorHandling(orderParams) {
  try {
    const result = await setOrderLimit(orderParams);

    if (result.status) {
      console.log(`Order created successfully:`, result.order);
      return result;
    } else {
      console.error(`Order creation failed:`, result.message);
      return result;
    }
  } catch (error) {
    console.error(`Validation error:`, error.message);
    return {
      status: false,
      message: error.message,
      order: null,
    };
  }
}

// CLI usage examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Order Examples - Choose an example to run:");
  console.log("1. createLimitOrder()");
  console.log("2. createMarketBuyOrder()");
  console.log("3. createMarketSellOrder()");
  console.log("4. createStopLimitOrder()");
  console.log("5. createOCOOrder()");
  console.log("6. createOrderWithMetadata()");
  console.log("7. createBatchOrders()");
  console.log("\nRunning example 1 (Limit Order)...\n");

  createLimitOrder()
    .then((result) => {
      console.log("Limit Order Result:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
