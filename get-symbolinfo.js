// getSymbol.js
async function getSymbolByName(symbol) {
  const url = `https://api.mazdax.ir/market/symbols/symbol/${encodeURIComponent(symbol)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ULRdBoxPmCzrokZtpX2tOB-WBj1YT3JK-ne8kaB02Ys2zbiGuaOgnqDPXsbGEhrWPHZcKfviWTfRR4XrZKYSZAOBzp8AFXW4cKwb9-SEkCj8vhLmwrGHQIsBfTLr6pwj',
      'Content-Type': 'application/json',
      'Accept-Language': 'en' // or 'fa' if you want Persian translations
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
getSymbolByName('AHRM1IRR')
  .then(data => {
    console.log('Symbol Info: AHRM1IRR', data);
  })
  .catch(err => {
    console.error('Error:', err);
  });

// getSymbolByName('ROBA1IRR')
//   .then(data => {
//     console.log('Symbol Info: ROBA1IRR', data);
//   })
//   .catch(err => {
//     console.error('Error:', err);
//   });

module.exports = getSymbolByName;
