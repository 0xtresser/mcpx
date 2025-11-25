import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import type {
  ToolPaymentRequirements,
  McpXServerConfig,
  ToolPaymentDefinition,
  ToolPaymentResolver,
  DynamicPaymentContext,
} from './types.js';

type ToolPaymentEntry =
  | { kind: 'static'; config: ToolPaymentRequirements }
  | { kind: 'dynamic'; resolver: ToolPaymentResolver };

export class McpXServer extends McpServer {
  private toolPayments = new Map<string, ToolPaymentEntry>();
  private config: McpXServerConfig;

  constructor(config: McpXServerConfig, options?: ConstructorParameters<typeof McpServer>[1]) {
    super(config, options);
    this.config = config;
  }

  /**
   * Registers a tool with optional payment requirements.
   *
   * @param name The name of the tool
   * @param config Tool configuration (input/output schema, description, etc.)
   * @param payment Optional payment requirements for x402 protocol
   * @param cb The callback function to execute when the tool is called
   */
  // @ts-expect-error - Overriding method signature slightly for payment support
  registerTool<InputArgs extends ZodRawShape, OutputArgs extends ZodRawShape>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: InputArgs;
      outputSchema?: OutputArgs;
      annotations?: ToolAnnotations;
      _meta?: Record<string, unknown>;
    },
    payment: ToolPaymentDefinition | undefined,
    cb: ToolCallback<InputArgs>
  ) {
    if (payment) {
      if (typeof payment === 'function') {
        this.toolPayments.set(name, { kind: 'dynamic', resolver: payment });
      } else {
        this.toolPayments.set(name, { kind: 'static', config: payment });
      }
    }

    const appliedMeta =
      payment === undefined
        ? config._meta
        : {
            ...(config._meta ?? {}),
            payment:
              typeof payment === 'function'
                ? { dynamic: true }
                : {
                    dynamic: false,
                    price: payment.price,
                    network: payment.network,
                    payTo: payment.payTo ?? this.config.defaultPayTo,
                    facilitator: payment.facilitator ?? this.config.defaultFacilitator,
                    mode: payment.mode,
                  },
          };

    const appliedConfig = {
      ...config,
      _meta: appliedMeta,
    };

    return super.registerTool(name, appliedConfig, cb);
  }

  /**
   * Retrieves the payment requirements for a specific tool.
   */
  getToolPaymentDefinition(name: string): ToolPaymentEntry | undefined {
    return this.toolPayments.get(name);
  }

  /**
   * Checks if a tool requires payment.
   */
  requiresPayment(name: string): boolean {
    return this.toolPayments.has(name);
  }

  /**
   * Gets the default payment configuration.
   */
  getDefaultConfig() {
    return {
      payTo: this.config.defaultPayTo,
      facilitator: this.config.defaultFacilitator,
    };
  }

  /**
   * Resolves the payment configuration for a tool, applying defaults.
   */
  async resolvePaymentConfig(
    name: string,
    context: DynamicPaymentContext,
  ): Promise<ToolPaymentRequirements | undefined> {
    const entry = this.toolPayments.get(name);
    if (!entry) {
      return undefined;
    }

    let config: ToolPaymentRequirements | undefined;
    if (entry.kind === 'dynamic') {
      config = await entry.resolver(context);
    } else {
      config = entry.config;
    }

    if (!config) {
      return undefined;
    }

    return {
      ...config,
      payTo: config.payTo ?? this.config.defaultPayTo,
      facilitator: config.facilitator ?? this.config.defaultFacilitator,
    };
  }
}
