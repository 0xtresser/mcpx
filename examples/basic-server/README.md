# Basic MCP Server Example

A minimal MCP server demonstrating x402 payment integration with different payment modes.

## Features

- **Free tool**: `echo` - no payment required
- **payThenService**: `premium_echo` - verify first, settle after execution
- **payBeforeService**: `secure_echo` - settle before execution (safer for expensive operations)
- **Dynamic pricing**: `dynamic_echo` - price calculated at runtime based on input

## Prerequisites

- Node.js 18+ or Bun 1.1+
- An EVM wallet with USDC on Base (or Base Sepolia for testing)

## Setup

1. Install dependencies:

   ```bash
   npm install
   # or
   bun install
   ```

2. Set environment variables (optional):

   ```bash
   export PORT=3000
   export PAY_TO_ADDRESS=0xYourAddress
   export FACILITATOR_URL=https://facilitator.payai.network
   ```

## Running

```bash
# With Bun (recommended)
bun run server.ts

# With Node.js
npm start
```

The server will start at `http://localhost:3000/mcp`.

## Testing with the Client

Use the basic-client example or any MCP-compatible client:

```bash
cd ../basic-client
bun run client.ts http://localhost:3000/mcp echo '{"message": "Hello"}'
```

## Payment Modes Explained

### payThenService (default)

1. Client sends payment signature
2. Server verifies the payment is valid
3. Server executes the tool
4. Server settles the payment

⚠️ **Important**: If settlement fails after execution, you need to handle this case (retry, rollback, etc.).

### payBeforeService

1. Client sends payment signature
2. Server verifies the payment
3. Server settles the payment (on-chain)
4. Server executes the tool

This mode is safer for expensive or irreversible operations since payment is confirmed before execution.

## Troubleshooting

- **402 Payment Required**: Ensure your client has sufficient USDC balance
- **Invalid payment**: Check that the payment signature matches the expected amount/network
- **Settlement failed**: The facilitator may be unreachable; check network connectivity

