const fs = require('fs');
const path = require('path');

// Read the daily snapshots data
const snapshotsPath = path.join(__dirname, '../data/daily-snapshots.json');
const snapshots = JSON.parse(fs.readFileSync(snapshotsPath, 'utf8'));

// Find snapshots before and after October 17, 2025
const targetDate = new Date('2025-10-17');
let beforeSnapshot = null;
let afterSnapshot = null;

for (const snapshot of snapshots) {
  const snapshotDate = new Date(snapshot.timestamp);
  if (snapshotDate < targetDate && (!beforeSnapshot || snapshotDate > new Date(beforeSnapshot.timestamp))) {
    beforeSnapshot = snapshot;
  }
  if (snapshotDate > targetDate && (!afterSnapshot || snapshotDate < new Date(afterSnapshot.timestamp))) {
    afterSnapshot = snapshot;
  }
}

if (!beforeSnapshot || !afterSnapshot) {
  console.error('Could not find snapshots before and after October 17, 2025');
  process.exit(1);
}

console.log('Before snapshot (October 16):', beforeSnapshot.timestamp);
console.log('After snapshot (October 18):', afterSnapshot.timestamp);

// Calculate the time difference in hours
const beforeTime = new Date(beforeSnapshot.timestamp).getTime();
const afterTime = new Date(afterSnapshot.timestamp).getTime();
const targetTime = targetDate.getTime();
const totalTime = afterTime - beforeTime;
const targetOffset = targetTime - beforeTime;
const ratio = targetOffset / totalTime;

console.log(`Time ratio: ${ratio.toFixed(4)}`);

// Interpolate values
function interpolateValue(before, after, ratio) {
  return before + (after - before) * ratio;
}

// Interpolate market prices
function interpolateMarketPrices(beforePrices, afterPrices, ratio) {
  const interpolated = {};
  
  // Get all unique symbols from both snapshots
  const symbols = new Set([...Object.keys(beforePrices), ...Object.keys(afterPrices)]);
  
  for (const symbol of symbols) {
    if (beforePrices[symbol] !== undefined && afterPrices[symbol] !== undefined) {
      interpolated[symbol] = interpolateValue(beforePrices[symbol], afterPrices[symbol], ratio);
    } else if (beforePrices[symbol] !== undefined) {
      interpolated[symbol] = beforePrices[symbol];
    } else {
      interpolated[symbol] = afterPrices[symbol];
    }
  }
  
  return interpolated;
}

// Create the inferred snapshot for October 17
const inferredSnapshot = {
  timestamp: new Date('2025-10-17T12:00:00.000Z').toISOString(),
  portfolio_value: interpolateValue(beforeSnapshot.portfolio_value, afterSnapshot.portfolio_value, ratio),
  stock_value: interpolateValue(beforeSnapshot.stock_value, afterSnapshot.stock_value, ratio),
  crypto_value: interpolateValue(beforeSnapshot.crypto_value, afterSnapshot.crypto_value, ratio),
  cash_value: interpolateValue(beforeSnapshot.cash_value, afterSnapshot.cash_value, ratio),
  market_prices: interpolateMarketPrices(beforeSnapshot.market_prices, afterSnapshot.market_prices, ratio)
};

console.log('\nInferred snapshot for October 17, 2025:');
console.log(JSON.stringify(inferredSnapshot, null, 2));

// Add the inferred snapshot to the array
snapshots.push(inferredSnapshot);

// Sort snapshots by timestamp
snapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

// Write back to file
fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2));
console.log('\nSuccessfully added inferred snapshot to daily-snapshots.json');