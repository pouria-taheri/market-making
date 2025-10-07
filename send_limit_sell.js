import { setOrderLimit } from "./set-order-limit.js";

async function sendLimitSellOrder() {
  const order = {
    symbol: "AHRM1IRR",
    side: "SELL",
    orderType: "limit",
    market: "IRR",
    amount: 100, // Amount in base asset (you can change this)
    price: 21249, // Your specified price
    source: "manual-order",
  };

  console.log("Sending limit sell order:", order);

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

sendLimitSellOrder();
