import { setOrderLimit } from "./set-order-limit.js";

async function sendMarketSellOrder() {
  const order = {
    symbol: "AHRM1IRR",
    side: "SELL",
    orderType: "market",
    market: "IRR",
    amount: 100, // Amount in base asset (you can change this)
    source: "manual-order",
  };

  console.log("Sending market sell order:", order);

  try {
    const result = await setOrderLimit(order);

    if (result.status) {
      console.log("✅ Order created successfully!");
      console.log("Order details:", result.order);
    } else {
      console.log("❌ Order failed:", result.message);
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

sendMarketSellOrder();
