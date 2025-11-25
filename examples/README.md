# MCPX Examples

This directory contains example implementations demonstrating how to use MCPX.

## Examples

| Example | Description |
|---------|-------------|
| [basic-server](./basic-server/) | MCP server with free and paid tools |
| [basic-client](./basic-client/) | MCP client with automatic payment handling |

## Quick Start

### 1. Start the Server

```bash
cd basic-server
bun install
bun run server.ts
```

The server will start at `http://localhost:3000/mcp`.

> **Note**: Bun automatically loads `.env` files from the current working directory. Make sure the `.env` file is in the same directory where you run the command. Shell `export` variables are NOT automatically inherited by Bun.

### 2. Run the Client

In a new terminal:

```bash
cd basic-client
bun install

# Option 1: Use a .env file (Bun auto-loads it from the current directory)
echo 'X402_EVM_PRIVATE_KEY=0x...' > .env

# Option 2: Inline environment variable
X402_EVM_PRIVATE_KEY=0x... bun run client.ts http://localhost:3000/mcp echo '{"message": "Hello"}'

# Call a free tool
bun run client.ts http://localhost:3000/mcp echo '{"message": "Hello"}'

# Call a paid tool
bun run client.ts http://localhost:3000/mcp premium_echo '{"message": "Hello"}'
```

> **Note**: Bun automatically loads `.env` files from the current working directory. Make sure the `.env` file is in the same directory where you run the command. Shell `export` variables are NOT automatically inherited by Bun.

## Payment Modes

### payThenService (Default)

- Payment is verified before execution
- Settlement happens after execution
- Lower latency, but requires handling settlement failures

```ts
server.registerTool(
  'my_tool',
  { description: '...' },
  { price: '$0.001', network: 'base' }, // mode defaults to 'payThenService'
  async () => ({ content: [{ type: 'text', text: 'Done' }] })
);
```

### payBeforeService

- Payment is verified AND settled before execution
- Higher latency, but safer for expensive operations

```ts
server.registerTool(
  'expensive_tool',
  { description: '...' },
  { price: '$0.01', network: 'base', mode: 'payBeforeService' },
  async () => ({ content: [{ type: 'text', text: 'Done' }] })
);
```

## Testing on Testnet

For development, use Base Sepolia:

1. Get testnet USDC from a faucet
2. Set `network: 'base-sepolia'` in your tool config
3. Set `X402_EVM_NETWORK=base-sepolia` for the client

## Troubleshooting

See individual example READMEs for specific troubleshooting steps.

