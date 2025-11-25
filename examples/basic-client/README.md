# Basic MCP Client Example

A minimal MCP client demonstrating x402 payment support for calling paid tools.

## Prerequisites

- Node.js 18+ or Bun 1.1+
- An EVM wallet with USDC (set `X402_EVM_PRIVATE_KEY`)

## Setup

1. Install dependencies:

   ```bash
   npm install
   # or
   bun install
   ```

2. Set your private key:

   ```bash
   export X402_EVM_PRIVATE_KEY=0x...
   export X402_EVM_NETWORK=base-sepolia  # or 'base' for mainnet
   ```

## Usage

```bash
bun run client.ts <server-url> <tool-name> [arguments-json]
```

### Examples

```bash
# Call free tool
bun run client.ts http://localhost:3000/mcp echo '{"message": "Hello"}'

# Call paid tool (payThenService mode)
bun run client.ts http://localhost:3000/mcp premium_echo '{"message": "Hello"}'

# Call paid tool (payBeforeService mode)
bun run client.ts http://localhost:3000/mcp secure_echo '{"message": "Hello"}'

# List available tools only
bun run client.ts http://localhost:3000/mcp list
```

## How It Works

1. The client connects to the MCP server
2. For paid tools, the server returns a 402 response with payment requirements
3. The client automatically signs and attaches the x402 payment header
4. The server verifies/settles the payment and executes the tool
5. The client receives the result and settlement confirmation

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_EVM_PRIVATE_KEY` | Wallet private key for signing payments | Test key (not for production) |
| `X402_EVM_NETWORK` | Network to use | `base-sepolia` |

## Troubleshooting

- **402 Payment Required in loop**: Check that your private key is correctly set
- **Insufficient balance**: Ensure your wallet has USDC on the target network
- **Network mismatch**: Verify `X402_EVM_NETWORK` matches the server's expected network

