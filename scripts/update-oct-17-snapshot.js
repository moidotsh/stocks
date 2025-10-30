const fs = require('fs');
const path = require('path');

// Read the necessary data files
const snapshotsPath = path.join(__dirname, '../data/daily-snapshots.json');
const holdingsPath = path.join(__dirname, '../holdings.csv');
const marketPricesPath = path.join(__dirname, '../data/market-prices.json');

const snapshots = JSON.parse(fs.readFileSync(snapshotsPath, 'utf8'));
const marketPrices = JSON.parse(fs.readFileSync(marketPricesPath, 'utf8'));

// Parse holdings CSV
const holdingsData = fs.readFileSync(holdingsPath, 'utf8');
const holdingsLines = holdingsData.split('\n');
const holdings = {};

for (let i = 1; i < holdingsLines.length; i++) {
  const line = holdingsLines[i].trim();
  if (line) {
    const [ticker, shares] = line.split(',');
    holdings[ticker] = parseFloat(shares);
  }
}

// Find the October 17 snapshot
const oct17Snapshot = snapshots.find(s => s.timestamp.startsWith('2025-10-17'));

if (!oct17Snapshot) {
  console.error('Could not find October 17 snapshot');
  process.exit(1);
}

console.log('Found October 17 snapshot:', oct17Snapshot.timestamp);

// Calculate stock value using current market prices
let stockValue = 0;
const updatedMarketPrices = { ...oct17Snapshot.market_prices };

// Update stock prices
for (const [ticker, shares] of Object.entries(holdings)) {
  if (marketPrices.stocks[ticker]) {
    updatedMarketPrices[ticker] = marketPrices.stocks[ticker];
    stockValue += shares * marketPrices.stocks[ticker];
    console.log(`${ticker}: ${shares} shares × $${marketPrices.stocks[ticker]} = $${(shares * marketPrices.stocks[ticker]).toFixed(2)}`);
  } else {
    console.log(`Warning: No market price found for ${ticker}`);
  }
}

// Calculate crypto value using current market prices
let cryptoValue = 0;
for (const [symbol, price] of Object.entries(marketPrices.crypto)) {
  if (updatedMarketPrices[symbol] !== undefined) {
    updatedMarketPrices[symbol] = price;
    // Need to get crypto holdings from crypto_entries.json
  }
}

// Read crypto entries (trade history)
const cryptoEntriesPath = path.join(__dirname, '../data/crypto_entries.json');
const cryptoEntries = JSON.parse(fs.readFileSync(cryptoEntriesPath, 'utf8'));

// Calculate current crypto holdings from trade history
const cryptoHoldings = {};

// Process all trades up to October 17
for (const weekEntry of cryptoEntries) {
  const weekDate = new Date(weekEntry.week_start);
  if (weekDate > new Date('2025-10-17')) break;
  
  for (const trade of weekEntry.trades) {
    if (!cryptoHoldings[trade.ticker]) {
      cryptoHoldings[trade.ticker] = 0;
    }
    
    if (trade.action === 'buy') {
      cryptoHoldings[trade.ticker] += trade.qty;
    } else if (trade.action === 'sell') {
      cryptoHoldings[trade.ticker] -= trade.qty;
    }
  }
}

// Calculate crypto value
for (const [ticker, shares] of Object.entries(cryptoHoldings)) {
  if (marketPrices.crypto[ticker]) {
    cryptoValue += shares * marketPrices.crypto[ticker];
    console.log(`${ticker}: ${shares.toFixed(4)} shares × $${marketPrices.crypto[ticker]} = $${(shares * marketPrices.crypto[ticker]).toFixed(2)}`);
  }
}

// Update the snapshot with new values
oct17Snapshot.stock_value = stockValue;
oct17Snapshot.crypto_value = cryptoValue;
oct17Snapshot.portfolio_value = stockValue + cryptoValue + oct17Snapshot.cash_value;
oct17Snapshot.market_prices = updatedMarketPrices;

console.log('\nUpdated October 17 snapshot:');
console.log(`Stock value: $${stockValue.toFixed(2)}`);
console.log(`Crypto value: $${cryptoValue.toFixed(2)}`);
console.log(`Cash value: $${oct17Snapshot.cash_value.toFixed(2)}`);
console.log(`Total portfolio value: $${oct17Snapshot.portfolio_value.toFixed(2)}`);

// Write back to file
fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2));
console.log('\nSuccessfully updated October 17 snapshot with current market prices');