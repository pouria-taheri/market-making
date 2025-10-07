import fetch from "node-fetch";
import { SecurityConfig } from "./config/config.js";
import { fileURLToPath } from "url";

function delay(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Cancel one or multiple orders on Mazdax
 * @param {number[]} orderIds - Array of order IDs to cancel (required)
 * @returns {Promise<{status:boolean,message:string,result:null|{failed:any[],succeeded:any[]}}>} API result
 */
export async function cancelOrders(orderIds) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array of integers");
  }
  if (!orderIds.every((id) => Number.isInteger(id) && id > 0)) {
    throw new Error("orderIds must contain only positive integers");
  }

  const base = SecurityConfig.Mazdax_config.endpoint_url_order;
  const url = `${base}/orders/cancel`;

  const tryNumber = SecurityConfig.Mazdax_config.cancelOrders_tryNumber ?? 3;
  const tryTime = SecurityConfig.Mazdax_config.cancelOrders_tryTime ?? 3;

  // Use the same token you used for placing orders
  const headers = {
    Authorization:
      "Bearer DR1bKOiWI2A7J4SUdau6naAVgf22UCLLtBngs3w9V6Oj4vin8RiJLPjr68T2ZIgut9tCN0lyMYs8sinj6bm0g48zSu4JY-cBpplZhUZHalueCv82NbMEWNZn4mYfRG9C",
    "Content-Type": "application/json",
  };

  const payload = { orderIds };

  let lastError = null;

  for (let attempt = 1; attempt <= tryNumber; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        status: true,
        message: "Cancel request processed",
        result: data,
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
      : "Cancel request failed",
    result: null,
  };
}

// CLI usage when run directly with Node: node cancel-orders.js 123 456 789
const isMain = (() => {
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  const ids = process.argv
    .slice(2)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));

  if (ids.length === 0) {
    console.log(
      "Provide at least one orderId. Example: node cancel-orders.js 123 456"
    );
    process.exit(1);
  }

  cancelOrders(ids)
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((e) => {
      console.error(String(e?.message || e));
      process.exit(1);
    });
}
