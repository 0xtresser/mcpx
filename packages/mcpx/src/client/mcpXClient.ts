import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Implementation } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

export interface McpXClientOptions {
  serverUrl: string | URL;
  fetch?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
  clientInfo?: Implementation;
  capabilities?: Record<string, unknown>;
}

export interface McpXClientHandle {
  client: Client;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>;
  listTools: () => Promise<ListToolsResult>;
  close: () => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 2000;

export async function createMcpXClient(options: McpXClientOptions): Promise<McpXClientHandle> {
  const {
    serverUrl,
    fetch: fetchImpl,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    clientInfo = { name: 'mcpx-client', version: '1.0.0' },
    capabilities = {},
  } = options;

  const targetUrl = typeof serverUrl === 'string' ? new URL(serverUrl) : serverUrl;
  const transportFetch = fetchImpl ?? fetch;

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxRetries) {
    attempt += 1;
    const client = new Client(clientInfo, { capabilities });
    const transport = new StreamableHTTPClientTransport(targetUrl, {
      fetch: transportFetch,
    });

    try {
      await client.connect(transport);

      async function close() {
        await transport.close().catch(() => void 0);
        await client.close().catch(() => void 0);
      }

      return {
        client,
        callTool: (name, args = {}) =>
          client.callTool({
            name,
            arguments: args,
          }) as Promise<CallToolResult>,
        listTools: () => client.listTools() as Promise<ListToolsResult>,
        close,
      };
    } catch (error) {
      lastError = error;
      await transport.close().catch(() => void 0);
      await client.close().catch(() => void 0);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(lastError ? String(lastError) : 'Failed to connect to MCP server');
}

