/**
 * Basic MCP Client Example with x402 Payment Support
 *
 * Usage:
 *   bun run client.ts <server-url> <tool-name> [arguments-json]
 *
 * Examples:
 *   bun run client.ts http://localhost:3000/mcp echo '{"message": "Hello"}'
 *   bun run client.ts http://localhost:3000/mcp premium_echo '{"message": "Hello"}'
 */

import {
  createMcpXClient,
  createX402Fetch,
  type PaymentSignerConfig,
  type PaymentSettlementInfo,
  type McpXClientHandle,
} from '@0xtresser/mcpx';

// Default test private key (DO NOT USE IN PRODUCTION)
const DEFAULT_PRIVATE_KEY = process.env.X402_EVM_PRIVATE_KEY;

function getSignerConfig(): PaymentSignerConfig {
  const privateKey = process.env.X402_EVM_PRIVATE_KEY || DEFAULT_PRIVATE_KEY;
  const network = process.env.X402_EVM_NETWORK || 'base-sepolia';

  return {
    evm: {
      privateKey,
      network,
    },
  };
}

function onSettlement(info: PaymentSettlementInfo) {
  const context = info.toolName ? ` for tool "${info.toolName}"` : '';
  if (info.decoded.success) {
    console.log(`✅ Payment settled${context}`);
    console.log(`   Network: ${info.decoded.network}`);
    console.log(`   Transaction: ${info.decoded.transaction}`);
  } else {
    console.warn(`⚠️ Payment settlement failed${context}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: bun run client.ts <server-url> <tool-name> [arguments-json]');
    console.error('');
    console.error('Examples:');
    console.error('  bun run client.ts http://localhost:3000/mcp echo \'{"message": "Hello"}\'');
    console.error('  bun run client.ts http://localhost:3000/mcp premium_echo \'{"message": "Hello"}\'');
    process.exit(1);
  }

  const serverUrl = args[0];
  const toolName = args[1];
  let toolArgs: Record<string, unknown> = {};

  if (args[2]) {
    try {
      toolArgs = JSON.parse(args[2]);
    } catch (e) {
      console.error(`Failed to parse arguments JSON: ${args[2]}`);
      process.exit(1);
    }
  }

  console.log('🚀 Basic MCP Client\n');
  console.log(`Server: ${serverUrl}`);
  console.log(`Tool: ${toolName}`);
  if (Object.keys(toolArgs).length > 0) {
    console.log(`Arguments: ${JSON.stringify(toolArgs)}`);
  }
  console.log('');

  let handle: McpXClientHandle | null = null;

  try {
    // Create fetch with payment support
    const fetchWithPayment = await createX402Fetch({
      signer: getSignerConfig(),
      onSettlement,
    });

    // Create MCP client
    handle = await createMcpXClient({
      serverUrl,
      fetch: fetchWithPayment,
      clientInfo: { name: 'basic-mcp-client', version: '1.0.0' },
    });

    // List available tools
    const tools = await handle.listTools();
    console.log('Available tools:');
    for (const tool of tools.tools || []) {
      const payment = tool._meta?.payment as { price?: string; dynamic?: boolean } | undefined;
      let priceInfo = '(free)';
      if (payment) {
        priceInfo = payment.dynamic ? '(dynamic pricing)' : `(${payment.price || 'paid'})`;
      }
      console.log(`  - ${tool.name} ${priceInfo}`);
    }
    console.log('');

    // Call the tool
    console.log(`Calling ${toolName}...`);
    const result = await handle.callTool(toolName, toolArgs);

    if (result.isError) {
      console.error('❌ Tool execution failed:');
      if (Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            console.error(item.text);
          }
        }
      }
      process.exit(1);
    }

    console.log('✅ Tool result:');
    if (result.structuredContent) {
      console.log(JSON.stringify(result.structuredContent, null, 2));
    } else if (Array.isArray(result.content)) {
      for (const item of result.content) {
        if (item.type === 'text') {
          console.log(item.text);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (handle) {
      await handle.close();
    }
  }
}

main();

