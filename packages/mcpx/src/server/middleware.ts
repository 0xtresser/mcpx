import type { Request, Response, NextFunction } from 'express';
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  processPriceToAtomicAmount,
  toJsonSafe,
} from 'x402/shared';
import { getPaywallHtml } from 'x402/paywall';
import type {
  FacilitatorConfig,
  ERC20TokenAmount,
  PaymentPayload,
  PaymentRequirements,
  PaywallConfig,
  Resource,
  RoutesConfig,
} from 'x402/types';
import {
  moneySchema,
  settleResponseHeader,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
} from 'x402/types';
import { useFacilitator } from 'x402/verify';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { Address as SolanaAddress } from '@solana/kit';
import { exact } from 'x402/schemes';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { McpXServer } from './mcpXServer.js';
import type { ToolPaymentRequirements } from './types.js';

export type PaymentMode = 'payBeforeService' | 'payThenService';

export function resolvePaymentMode(config?: Pick<ToolPaymentRequirements, 'mode'>): PaymentMode {
  return config?.mode === 'payBeforeService' ? 'payBeforeService' : 'payThenService';
}

export interface X402MiddlewareOptions {
  /**
   * @deprecated Use McpXServerConfig.defaultPayTo instead
   */
  payTo?: Address | SolanaAddress;
  /**
   * @deprecated Use McpXServerConfig.defaultFacilitator instead
   */
  facilitator?: FacilitatorConfig;
  /**
   * Optional configuration for the default paywall
   */
  paywall?: PaywallConfig;
}

const paymentConfigCache = new Map<
  string,
  { config: ToolPaymentRequirements; timeout: NodeJS.Timeout }
>();

function makeCacheKey(req: Request) {
  const sessionId = req.header('mcp-session-id') ?? 'anonymous';
  const bodyKey = JSON.stringify(req.body ?? {});
  return `${sessionId}:${bodyKey}`;
}

function cachePaymentConfig(key: string, config: ToolPaymentRequirements, ttlMs = 60_000) {
  const existing = paymentConfigCache.get(key);
  if (existing) {
    clearTimeout(existing.timeout);
  }
  const timeout = setTimeout(() => {
    paymentConfigCache.delete(key);
  }, ttlMs);
  paymentConfigCache.set(key, { config, timeout });
}

function consumeCachedPaymentConfig(key: string) {
  const entry = paymentConfigCache.get(key);
  if (entry) {
    clearTimeout(entry.timeout);
    paymentConfigCache.delete(key);
    return entry.config;
  }
  return undefined;
}

function logPaymentResponseHeader(headers: [string, string | number | readonly string[]][]) {
  const header = headers.find(([k]) => k.toLowerCase() === 'x-payment-response');
  if (header && typeof header[1] === 'string') {
    try {
      const json = Buffer.from(header[1], 'base64').toString('utf-8');
      // eslint-disable-next-line no-console
      console.log('🧾 X-PAYMENT-RESPONSE (Settlement):', JSON.parse(json));
    } catch {
      // eslint-disable-next-line no-console
      console.log('🧾 X-PAYMENT-RESPONSE (Raw):', header[1]);
    }
  }
}

/**
 * Creates a payment middleware factory for Express based on x402 core package
 */
export function paymentMiddleware(
  payTo: Address | SolanaAddress,
  routes: RoutesConfig,
  facilitator?: FacilitatorConfig,
  paywall?: PaywallConfig
) {
  const { verify, settle, supported } = useFacilitator(facilitator);
  const x402Version = 1;

  // Pre-compile route patterns to regex and extract verbs
  const routePatterns = computeRoutePatterns(routes);

  return async function paymentMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const matchingRoute = findMatchingRoute(routePatterns, req.path, req.method.toUpperCase());

    if (!matchingRoute) {
      return next();
    }

    const { price, network, config = {} } = matchingRoute.config;
    const mode = resolvePaymentMode(matchingRoute.config as ToolPaymentRequirements);
    const {
      description,
      mimeType,
      maxTimeoutSeconds,
      inputSchema,
      outputSchema,
      customPaywallHtml,
      resource,
      discoverable,
    } = config;

    const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
    if ('error' in atomicAmountForAsset) {
      throw new Error(atomicAmountForAsset.error);
    }
    const { maxAmountRequired, asset } = atomicAmountForAsset;

    const resourceUrl: Resource =
      resource || (`${req.protocol}://${req.headers.host}${req.path}` as Resource);

    const paymentRequirements: PaymentRequirements[] = [];

    // evm networks
    if (SupportedEVMNetworks.includes(network)) {
      paymentRequirements.push({
        scheme: 'exact',
        network,
        maxAmountRequired,
        resource: resourceUrl,
        description: description ?? '',
        mimeType: mimeType ?? '',
        payTo: getAddress(payTo as string),
        maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
        asset: getAddress(asset.address),
        outputSchema: {
          input: {
            type: 'http',
            method: req.method.toUpperCase(),
            discoverable: discoverable ?? true,
            ...inputSchema,
          },
          output: outputSchema,
        },
        extra: (asset as ERC20TokenAmount['asset']).eip712,
      });
    }
    // svm networks
    else if (SupportedSVMNetworks.includes(network)) {
      // get the supported payments from the facilitator
      const paymentKinds = await supported();

      // find the payment kind that matches the network and scheme
      let feePayer: string | undefined;
      for (const kind of paymentKinds.kinds) {
        if (kind.network === network && kind.scheme === 'exact') {
          feePayer = kind?.extra?.feePayer;
          break;
        }
      }

      // if no fee payer is found, throw an error
      if (!feePayer) {
        throw new Error(`The facilitator did not provide a fee payer for network: ${network}.`);
      }

      paymentRequirements.push({
        scheme: 'exact',
        network,
        maxAmountRequired,
        resource: resourceUrl,
        description: description ?? '',
        mimeType: mimeType ?? '',
        payTo: payTo as string,
        maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
        asset: asset.address,
        outputSchema: {
          input: {
            type: 'http',
            method: req.method.toUpperCase(),
            discoverable: discoverable ?? true,
            ...inputSchema,
          },
          output: outputSchema,
        },
        extra: {
          feePayer,
        },
      });
    } else {
      throw new Error(`Unsupported network: ${network}`);
    }

    const payment = req.header('X-PAYMENT');
    const userAgent = req.header('User-Agent') || '';
    const acceptHeader = req.header('Accept') || '';
    const isWebBrowser = acceptHeader.includes('text/html') && userAgent.includes('Mozilla');

    if (!payment) {
      if (isWebBrowser) {
        let displayAmount: number;
        if (typeof price === 'string' || typeof price === 'number') {
          const parsed = moneySchema.safeParse(price);
          if (parsed.success) {
            displayAmount = parsed.data;
          } else {
            displayAmount = Number.NaN;
          }
        } else {
          displayAmount = Number(price.amount) / 10 ** price.asset.decimals;
        }

        const html =
          customPaywallHtml ||
          getPaywallHtml({
            amount: displayAmount,
            paymentRequirements: toJsonSafe(paymentRequirements) as Parameters<
              typeof getPaywallHtml
            >[0]['paymentRequirements'],
            currentUrl: req.originalUrl,
            testnet: network === 'base-sepolia',
            cdpClientKey: paywall?.cdpClientKey,
            appName: paywall?.appName,
            appLogo: paywall?.appLogo,
            sessionTokenEndpoint: paywall?.sessionTokenEndpoint,
          });
        res.status(402).send(html);
        return;
      }
      res.status(402).json({
        x402Version,
        error: 'X-PAYMENT header is required',
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    let decodedPayment: PaymentPayload;
    try {
      decodedPayment = exact.evm.decodePayment(payment);
      decodedPayment.x402Version = x402Version;
    } catch (error) {
      console.error(error);
      res.status(402).json({
        x402Version,
        error: error || 'Invalid or malformed payment header',
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment
    );
    if (!selectedPaymentRequirements) {
      res.status(402).json({
        x402Version,
        error: 'Unable to find matching payment requirements',
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    try {
      const response = await verify(decodedPayment, selectedPaymentRequirements);
      // eslint-disable-next-line no-console
      console.log(`[${new Date().toISOString()}] 🔍 verify response:${JSON.stringify(response)}`); // to be removed
      if (!response.isValid) {
        res.status(402).json({
          x402Version,
          error: response.invalidReason,
          accepts: toJsonSafe(paymentRequirements),
          payer: response.payer,
        });
        return;
      }
    } catch (error) {
      console.error(error);
      res.status(402).json({
        x402Version,
        error,
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    if (mode === 'payBeforeService') {
      try {
        const settleResponse = await settle(decodedPayment, selectedPaymentRequirements);
        // eslint-disable-next-line no-console
        console.log(`[${new Date().toISOString()}] 🔍 settle response:${JSON.stringify(settleResponse)}`);
        const responseHeader = settleResponseHeader(settleResponse);
        res.setHeader('X-PAYMENT-RESPONSE', responseHeader);

        if (!settleResponse.success) {
          res.status(402).json({
            x402Version,
            error: settleResponse.errorReason,
            accepts: toJsonSafe(paymentRequirements),
          });
          return;
        }
      } catch (error) {
        console.error(error);
        if (!res.headersSent) {
          res.status(402).json({
            x402Version,
            error,
            accepts: toJsonSafe(paymentRequirements),
          });
          return;
        }
      }

      await next();
    } else {
      // payThenService: settle asynchronously after verify succeeds
      // This avoids blocking on MCP transport delays
      // eslint-disable-next-line no-console
      console.log(`[${new Date().toISOString()}] 🚀 Starting async settle...`);
      
      // Fire and forget - don't await
      settle(decodedPayment, selectedPaymentRequirements)
        .then((settleResponse) => {
          // eslint-disable-next-line no-console
          console.log(`[${new Date().toISOString()}] 🔍 settle response:${JSON.stringify(settleResponse)}`);
          if (!settleResponse.success) {
            console.error(`❌ Settlement failed: ${settleResponse.errorReason}`);
          }
        })
        .catch((error) => {
          console.error('❌ Settlement error:', error);
        });

      // Proceed to the next middleware or route handler immediately
      await next();
    }
  };
}

type HeaderValue = string | number | readonly string[];

/**
 * Creates an Express middleware that handles x402 payment protection for MCP tools.
 */
export function createX402Middleware(
  server: McpXServer,
  options?: X402MiddlewareOptions
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Track if next() has been called
    let nextCalled = false;
    let cacheKey: string | null = null;
    const safeNext = (err?: unknown) => {
      if (!nextCalled) {
        nextCalled = true;
        if (cacheKey) {
          consumeCachedPaymentConfig(cacheKey);
          cacheKey = null;
        }
        next(err);
      }
    };

    try {
      // 1. Parse body to check if it's a tool call
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object') {
        return safeNext();
      }

      // Check for JSON-RPC method
      const method = body.method;
      if (method !== 'tools/call') {
        return safeNext();
      }

      // 2. Get tool name
      const params = body.params as Record<string, unknown> | undefined;
      const toolName = params?.name as string | undefined;

      if (!toolName) {
        return safeNext();
      }

      // 3. Check if tool requires payment
      if (!server.requiresPayment(toolName)) {
        return safeNext();
      }

      cacheKey = makeCacheKey(req);
      let paymentConfig = paymentConfigCache.get(cacheKey)?.config;

      if (!paymentConfig) {
        const resolved = await server.resolvePaymentConfig(toolName, {
          toolName,
          request: req,
        });

        if (!resolved) {
          return safeNext();
        }

        paymentConfig = resolved;
        cachePaymentConfig(cacheKey, paymentConfig);
      }

      // 4. Determine PayTo and Facilitator
      const serverDefaults = server.getDefaultConfig();

      const payTo = paymentConfig.payTo || serverDefaults.payTo || options?.payTo;
      const facilitator =
        paymentConfig.facilitator || serverDefaults.facilitator || options?.facilitator;

      if (!payTo) {
        console.warn(`⚠️ Tool "${toolName}" requires payment but no payTo address is configured.`);
        return safeNext();
      }

      // 5. Construct dynamic payment middleware for this specific tool price
      const routeKey = `${req.method} ${req.path}`;

      const dynamicPaywall = paymentMiddleware(
        payTo,
        {
          [routeKey]: paymentConfig,
        },
        // @ts-expect-error - FacilitatorConfig type compatibility
        facilitator,
        options?.paywall
      );

      const bufferedState = {
        writeHead: null as unknown[] | null,
        writes: [] as unknown[][],
        end: null as unknown[] | null,
        endCalled: false,
        headers: [] as [string, HeaderValue][],
        statusCode: null as number | null,
      };

      const responseProxy = new Proxy(res, {
        get(target, prop, receiver) {
          if (prop === 'writeHead') {
            return (statusCode: number, ...args: unknown[]) => {
              bufferedState.statusCode = statusCode;
              bufferedState.writeHead = args;
              return responseProxy;
            };
          }
          if (prop === 'write') {
            return (...args: unknown[]) => {
              bufferedState.writes.push(args);
              return true;
            };
          }
          if (prop === 'end') {
            return (...args: unknown[]) => {
              bufferedState.end = args.length > 0 ? args : null;
              bufferedState.endCalled = true;
              return responseProxy;
            };
          }
          if (prop === 'setHeader') {
            return (name: string, value: HeaderValue) => {
              bufferedState.headers.push([name, value]);
              return responseProxy;
            };
          }
          if (prop === 'status' || prop === 'statusCode') {
            if (typeof target.status === 'function' && prop === 'status') {
              return (code: number) => {
                bufferedState.statusCode = code;
                return responseProxy;
              };
            }
            if (prop === 'statusCode') {
              return bufferedState.statusCode || target.statusCode;
            }
          }

          if (prop === 'headersSent') {
            return false;
          }

          return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
          if (prop === 'statusCode') {
            bufferedState.statusCode = value as number;
            return true;
          }
          return Reflect.set(target, prop, value, receiver);
        },
      });

      await dynamicPaywall(req, responseProxy as Response, (err) => {
        if (err) {
          safeNext(err);
        } else {
          logPaymentResponseHeader(bufferedState.headers);
          for (const [name, value] of bufferedState.headers) {
            try {
              res.setHeader(name, value);
            } catch (e) {
              console.warn(`Failed to set header ${name} from payment middleware:`, e);
            }
          }

          if (cacheKey) {
            consumeCachedPaymentConfig(cacheKey);
            cacheKey = null;
          }
          safeNext();
        }
      });

      if (!nextCalled) {
        logPaymentResponseHeader(bufferedState.headers);
        for (const [name, value] of bufferedState.headers) {
          try {
            res.setHeader(name, value);
          } catch {
            // ignore header setting errors
          }
        }

        if (bufferedState.statusCode) {
          res.statusCode = bufferedState.statusCode;
        }

        if (bufferedState.writeHead && !res.headersSent) {
          // @ts-expect-error - dynamic writeHead call
          res.writeHead(bufferedState.statusCode || res.statusCode, ...bufferedState.writeHead);
        }

        for (const args of bufferedState.writes) {
          // @ts-expect-error - dynamic write call
          res.write(...args);
        }

        if (bufferedState.endCalled) {
          if (bufferedState.end) {
            // @ts-expect-error - dynamic end call
            res.end(...bufferedState.end);
          } else {
            res.end();
          }
        }
      }
    } catch (error) {
      console.error('Error in McpX middleware:', error);
      if (!res.headersSent) {
        safeNext(error);
      }
    }
  };
}

// Store active sessions globally for the handler
const sessions = new Map<string, { server: McpXServer; transport: StreamableHTTPServerTransport }>();

/**
 * Creates a standard MCP request handler for Express.
 * Automatically manages sessions and transport connections.
 *
 * @param serverFactory A function that returns a new McpXServer instance
 */
export function createMcpRequestHandler(serverFactory: () => McpXServer) {
  return async (req: Request, res: Response) => {
    if (res.headersSent) {
      return;
    }

    const sessionIdHeader = req.header('mcp-session-id');
    let entry = sessionIdHeader ? sessions.get(sessionIdHeader) : undefined;

    if (!entry) {
      if (sessionIdHeader || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      const server = serverFactory();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => {
          const id = randomUUID();
          // eslint-disable-next-line no-console
          console.log(`🔑 Generated session ID: ${id}`);
          return id;
        },
        onsessioninitialized: async (sessionId) => {
          // eslint-disable-next-line no-console
          console.log(`📱 New session initialized: ${sessionId}`);
          sessions.set(sessionId, { server, transport });
        },
        onsessionclosed: async (sessionId) => {
          // eslint-disable-next-line no-console
          console.log(`👋 Session closed: ${sessionId}`);
          sessions.delete(sessionId);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      try {
        await server.connect(transport);
      } catch (error) {
        console.error('❌ Failed to connect server for new session:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
        return;
      }

      entry = { server, transport };
    }

    try {
      // eslint-disable-next-line no-console
      console.log(`[${new Date().toISOString()}] 🔍 handleRequest:${JSON.stringify(req.body)}`); // to be removed
      await entry.transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('❌ Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  };
}
