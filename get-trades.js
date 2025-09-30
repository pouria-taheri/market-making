// get-trades.js
function toUnixTimestamp(dateString) {
  return Math.floor(new Date(dateString).getTime() / 1000); // seconds
}

async function getTrades({
  operation,
  tradeType,
  fromTimestamp,
  toTimestamp,
  perPage = 50,
  page = 1,
  sortBy = "id"
} = {}) {
  const params = new URLSearchParams();

  if (operation) params.append("operation", operation);
  if (tradeType) params.append("trade_type", tradeType);
  if (fromTimestamp) params.append("$fromtimestamp.timestamp", toUnixTimestamp(fromTimestamp));
  if (toTimestamp) params.append("$totimestamp.timestamp", toUnixTimestamp(toTimestamp));
  if (perPage) params.append("$perpage", perPage);
  if (page) params.append("$page", page);
  if (sortBy) params.append("$sortby", sortBy);

  const url = `https://api.mazdax.ir/trades?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ULRdBoxPmCzrokZtpX2tOB-WBj1YT3JK-ne8kaB02Ys2zbiGuaOgnqDPXsbGEhrWPHZcKfviWTfRR4XrZKYSZAOBzp8AFXW4cKwb9-SEkCj8vhLmwrGHQIsBfTLr6pwj',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}\n${errorText}`);
  }

  return await response.json();
}

// Example usage:
(async () => {
  try {
    const trades = await getTrades({
      operation: "BUY",
      tradeType: "limit",
      fromTimestamp: "2025-07-01T00:00:00Z",
      toTimestamp: "2025-09-30T23:59:59Z",
      perPage: 10,
      page: 1
    });

    console.log("Trades (BUY, limit):", trades);
  } catch (err) {
    console.error("Error fetching trades:", err);
  }
})();
