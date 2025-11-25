import type { RouteConfig, FacilitatorConfig } from 'x402/types';
import type { Address } from 'viem';
import type { Address as SolanaAddress } from '@solana/kit';
import type { Request } from 'express';

// Re-export types for convenience
export type { FacilitatorConfig, RouteConfig, SolanaAddress };

export interface ToolPaymentRequirements extends RouteConfig {
  /**
   * The address to receive payments for this specific tool.
   * Can be an EVM address (0x...) or Solana address.
   */
  payTo?: Address | SolanaAddress;

  /**
   * Optional facilitator configuration for this specific tool.
   */
  facilitator?: FacilitatorConfig;

  /**
   * Payment mode:
   * - 'payBeforeService': Server requires client to pay (verify + settle) before processing request
   * - 'payThenService': Server verifies payment, processes request, then settles (default)
   */
  mode?: 'payBeforeService' | 'payThenService';
}

export interface McpXServerConfig {
  name: string;
  version: string;
  /**
   * Default payment receiver address.
   * Used if a tool requires payment but doesn't specify a payTo address.
   */
  defaultPayTo?: Address | SolanaAddress;
  /**
   * Default facilitator configuration.
   */
  defaultFacilitator?: FacilitatorConfig;
}

export interface DynamicPaymentContext {
  toolName: string;
  request: Request;
}

export type ToolPaymentResolver = (
  context: DynamicPaymentContext,
) => Promise<ToolPaymentRequirements> | ToolPaymentRequirements;

export type ToolPaymentDefinition = ToolPaymentRequirements | ToolPaymentResolver;
