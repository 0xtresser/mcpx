/**
 * Basic MCP Server Example with Payment Support
 *
 * This example demonstrates:
 * - Creating an MCP server with x402 payment integration
 * - Registering tools with different payment modes
 * - Setting up Express middleware for payment processing
 *
 * Run with: bun run server.ts (or npm start)
 */

import express from 'express';
import { z } from 'zod';
import { McpXServer, createX402Middleware, createMcpRequestHandler } from '@0xtresser/mcpx';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '127.0.0.1';
const PAY_TO = process.env.PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.payai.network';

function createServer(): McpXServer {
  const server = new McpXServer(
    {
      name: 'basic-mcp-server',
      version: '1.0.0',
      defaultPayTo: PAY_TO,
      defaultFacilitator: { url: FACILITATOR_URL },
    },
    {
      capabilities: { tools: {} },
    }
  );

  // Free tool - no payment required
  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Echoes back the input message (free)',
      inputSchema: {
        message: z.string().describe('Message to echo'),
      },
    },
    undefined, // No payment
    async (args) => ({
      content: [{ type: 'text', text: `Echo: ${args.message}` }],
    })
  );

  // payThenService mode (default) - verify first, settle after execution
  server.registerTool(
    'premium_echo',
    {
      title: 'Premium Echo',
      description: 'Premium echo with fancy formatting ($0.001, payThenService)',
      inputSchema: {
        message: z.string().describe('Message to echo'),
      },
    },
    {
      price: '$0.001',
      network: 'base',
      // mode: 'payThenService' is the default
    },
    async (args) => ({
      content: [{ type: 'text', text: `✨ Premium Echo ✨\n\n${args.message}\n\n🎉` }],
    })
  );

  // payBeforeService mode - settle before execution
  server.registerTool(
    'secure_echo',
    {
      title: 'Secure Echo',
      description: 'Secure echo that requires payment before execution ($0.002, payBeforeService)',
      inputSchema: {
        message: z.string().describe('Message to echo'),
      },
    },
    {
      price: '$0.002',
      network: 'base',
      mode: 'payBeforeService',
    },
    async (args) => ({
      content: [{ type: 'text', text: `🔐 Secure Echo 🔐\n\n${args.message}\n\n✅ Payment settled before execution` }],
    })
  );

  // Dynamic pricing example
  server.registerTool(
    'dynamic_echo',
    {
      title: 'Dynamic Echo',
      description: 'Echo with dynamic pricing based on message length',
      inputSchema: {
        message: z.string().describe('Message to echo'),
      },
    },
    async ({ request }) => {
      const body = request.body as { params?: { arguments?: { message?: string } } };
      const message = body.params?.arguments?.message || '';
      const price = 0.0001 * message.length; // $0.0001 per character
      return {
        price: `$${price.toFixed(4)}`,
        network: 'base',
        mode: 'payThenService',
      };
    },
    async (args) => ({
      content: [{ type: 'text', text: `📊 Dynamic Echo (${args.message.length} chars)\n\n${args.message}` }],
    })
  );

  return server;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// Create the MCP server for middleware reference
const definitionServer = createServer();

// Apply x402 payment middleware
const x402Middleware = createX402Middleware(definitionServer);

// Create MCP request handler
const mcpHandler = createMcpRequestHandler(createServer);

// MCP endpoint
app.post('/mcp', x402Middleware, mcpHandler);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
app.listen(PORT, HOST, () => {
  console.log(`🚀 Basic MCP Server started on http://${displayHost}:${PORT}/mcp`);
  console.log(`💰 Payment receiver (payTo): ${PAY_TO || '(not configured)'}`);
  console.log(`🏦 Facilitator: ${FACILITATOR_URL}`);
  console.log('\nAvailable tools:');
  console.log('  - echo (free)');
  console.log('  - premium_echo ($0.001, payThenService, base)');
  console.log('  - secure_echo ($0.002, payBeforeService, base)');
  console.log('  - dynamic_echo (dynamic pricing, base)');
  console.log('\nPress Ctrl+C to stop');
});

