# Mazdax Order API Usage

This module provides a comprehensive interface for creating orders on the Mazdax exchange.

## Main Function

### `setOrderLimit(orderParams)`

Creates an order on Mazdax exchange with full validation and retry logic.

## Order Types Supported

1. **Market Orders**

   - `BUY`: Use `totalAmount` (quote asset)
   - `SELL`: Use `amount` (base asset)

2. **Limit Orders**

   - Use `amount` and `price`

3. **Stop Limit Orders**

   - Use `amount`, `price`, and `stopPrice`

4. **OCO Orders**
   - Use `amount`, `price`, `stopPrice`, and `pairOrder`

## Required Parameters

- `symbol`: Trading symbol (e.g., "AHRM1IRR")
- `side`: "BUY" or "SELL"
- `orderType`: "market", "limit", "stopLimit", or "OCO"
- `market`: Market identifier (e.g., "IRR")

## Optional Parameters

- `amount`: Amount in base asset
- `totalAmount`: Total amount in quote asset (market BUY only)
- `price`: Price for limit orders
- `stopPrice`: Stop price for stop orders
- `pairOrder`: Pair order for OCO orders
- `originatedFrom`: Origin identifier
- `source`: Client type
- `sourceData`: Arbitrary JSON data

## Usage Examples

### Basic Limit Order

```javascript
import { setOrderLimit } from "./set-order-limit.js";

const order = {
  symbol: "AHRM1IRR",
  side: "BUY",
  orderType: "limit",
  market: "IRR",
  amount: 100,
  price: 50000,
  source: "my-bot",
};

const result = await setOrderLimit(order);
```

### Market Buy Order

```javascript
const marketBuyOrder = {
  symbol: "AHRM1IRR",
  side: "BUY",
  orderType: "market",
  market: "IRR",
  totalAmount: 1000000, // 1M IRR
  source: "my-bot",
};

const result = await setOrderLimit(marketBuyOrder);
```

### OCO Order

```javascript
const ocoOrder = {
  symbol: "AHRM1IRR",
  side: "BUY",
  orderType: "OCO",
  market: "IRR",
  amount: 100,
  price: 45000,
  stopPrice: 46000,
  pairOrder: {
    side: "SELL",
    amount: 100,
    price: 55000,
  },
  source: "my-bot",
};

const result = await setOrderLimit(ocoOrder);
```

## Response Format

```javascript
{
  status: true,           // boolean
  message: "Order created successfully",
  order: {               // Order details from API
    id: 12345,
    symbol: "AHRM1IRR",
    side: "buy",
    orderType: ["limit"],
    amount: 100,
    price: 50000,
    status: 1,           // 1=open, 2=partially filled, 3=fulfilled, 4=canceled, etc.
    createdAt: "2024-01-01T00:00:00Z",
    // ... other order fields
  }
}
```

## Error Handling

The function includes comprehensive validation and will throw errors for:

- Missing required parameters
- Invalid parameter values
- Incorrect amount/totalAmount usage
- Missing OCO pair orders
- Missing stop prices for stop orders

## Testing

Run the test file to see examples of all order types:

```bash
node test_set_order.js
```

Run the examples file for more detailed usage:

```bash
node order_examples.js
```

## Configuration

The function uses retry logic configured in `config/security_config.json`:

- `sendOrder_tryNumber`: Number of retry attempts (default: 20)
- `sendOrder_tryTime`: Delay between retries in seconds (default: 3)
