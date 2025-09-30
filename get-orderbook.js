async function getOrderBook(symbol, limit) {
  const url = `https://api.mazdax.ir/market/order?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
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

  const data = await response.json();
  return data;
}

// Example usage:

getOrderBook('ROBA1IRR', 10)
  .then(data => {
    console.log('Orderbook: ROBA1IRR', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });


getOrderBook('AHRM1IRR', 10)
  .then(data => {
    console.log('Orderbook: AHRM1IRR', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });

  
getOrderBook('KARF1IRR', 10)
  .then(data => {
    console.log('Orderbook: KARF1IRR', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });


getOrderBook('GOLDBIRR', 10)
  .then(data => {
    console.log('Orderbook: GOLDBIRR', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });


getOrderBook('SILVRIRR', 10)
  .then(data => {
    console.log('Orderbook: SILVRIRR', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });