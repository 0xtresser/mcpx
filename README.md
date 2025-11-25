# @0xtresser/mcpx

> Model Context Protocol server toolkit with first-class x402 payments

[![npm version](https://img.shields.io/npm/v/%400xtresser%2Fmcpx.svg?color=blue)](https://www.npmjs.com/package/@0xtresser/mcpx) [![CI](https://github.com/0xtresser/mcpx/actions/workflows/ci.yml/badge.svg)](https://github.com/0xtresser/mcpx/actions/workflows/ci.yml)

## Highlights

- ⚡ Drop-in Model Context Protocol server helpers with HTTP streaming transport.
- 💰 First-class [x402](https://github.com/coinbase/x402) payment middleware for both static and dynamic pricing.
- 🛠️ Works with any Express-compatible server and exposes a batteries-included MCP client fetch wrapper.
- ✅ TypeScript-first API surface, strict types, shipped declarations.
- 🧪 Tested with Vitest, linted with ESLint + Prettier.

## Installation

```bash
npm install @0xtresser/mcpx express
```

The package ships pure ESM. Ensure your runtime targets Node.js 18+ (or Bun 1.1+).

## Quick Start

### Server

```ts
import express from 'express';
import { McpXServer, createMcpRequestHandler, createX402Middleware } from '@0xtresser/mcpx';

const server = new McpXServer({
  name: 'demo-server',
  version: '1.0.0',
  defaultPayTo: '0xYourAddress',
});

server.registerTool(
  'hello_world',
  { description: 'Greets back' },
  { price: '$0.001', network: 'base' },
  async () => ({ content: [{ type: 'text', text: 'Hello from MCP!' }] }),
);

const app = express();
app.use(express.json());
app.post(
  '/mcp',
  createX402Middleware(server),
  createMcpRequestHandler(() => server),
);

app.listen(3000, () => console.log('Server ready on http://localhost:3000/mcp'));
```

### Client Fetch Helper

```ts
import { createX402Fetch } from '@0xtresser/mcpx';

const fetchWithPayments = await createX402Fetch({
  signer: {
    evm: {
      privateKey: process.env.X402_EVM_PRIVATE_KEY!,
      network: 'base-sepolia',
    },
  },
  onSettlement(info) {
    console.log('Settlement result:', info.decoded);
  },
});
```

## Payment Modes

| Mode | Flow | When to use |
| --- | --- | --- |
| `payBeforeService` | verify ➜ settle ➜ tool executes | Expensive / irreversible workloads |
| `payThenService` (default) | verify ➜ tool executes ➜ settle | Low-latency flows |

⚠️ **Important**: When using **payThenService**, you must plan for partial failures: verification may succeed while settlement fails (network congestion, balance changes, etc.). Record the tool request ID and replay settlement (or roll back side effects) to keep accounting consistent.

## Scripts

| Command | Description |
| --- | --- |
| `npm run lint` | ESLint with TypeScript support |
| `npm run test` | Vitest unit tests |
| `npm run build` | Emits ESM output to `dist` |
| `npm run check` | lint + test + build |

## Examples

The repository ships ready-to-run samples inside `examples/`:

- `basic-server` – MCP server with free and paid tools (both payment modes)
- `basic-client` – MCP client with automatic payment handling

Each example README explains prerequisites, commands, and troubleshooting tips.

## FAQ

**Q: Does the middleware handle caching payment config per session?**  
A: Yes. It stores resolved tool payment requirements per MCP session ID/body payload for 60 seconds to avoid recomputation.

**Q: How do I customize the paywall UI?**  
A: Pass `customPaywallHtml` through the tool config or provide `options.paywall` when wiring `createX402Middleware`.

**Q: How do I test settlement errors?**  
A: Mock the facilitator using `useFacilitator` test doubles or inject a fake resolver into `createX402Middleware`.

## Roadmap / TODO

- Multiple facilitator fallbacks per tool.
- Built-in retry queue for failed settlements.
- CLI to scaffold new MCP servers.

Track progress on GitHub Projects or open an issue with suggestions.

## License

MIT © 0xtresser
