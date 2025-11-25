import {
  wrapFetchWithPayment,
  createSigner,
  decodeXPaymentResponse,
  type MultiNetworkSigner,
  type Hex,
} from 'x402-fetch';

export interface NetworkSignerConfig {
  privateKey: string;
  network?: string;
}

export interface PaymentSignerConfig {
  evm?: NetworkSignerConfig;
  svm?: NetworkSignerConfig;
}

export interface PaymentSettlementInfo {
  rawHeader: string;
  decoded: ReturnType<typeof decodeXPaymentResponse>;
  toolName?: string;
}

export interface X402FetchOptions {
  signer: PaymentSignerConfig;
  baseFetch?: typeof fetch;
  onSettlement?: (info: PaymentSettlementInfo) => void;
}

const DEFAULT_EVM_NETWORK = 'base-sepolia';
const DEFAULT_SVM_NETWORK = 'solana-devnet';

function normalizeRequestInit(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) {
    return init;
  }

  const headers =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers)
        ? Object.fromEntries(init.headers)
        : init.headers;

  return {
    ...init,
    headers,
  };
}

function extractToolName(init?: RequestInit): string | undefined {
  if (!init?.body || typeof init.body !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(init.body);
    if (parsed && typeof parsed === 'object' && parsed.method === 'tools/call') {
      const name = parsed.params?.name;
      return typeof name === 'string' ? name : undefined;
    }
  } catch {
    // ignore parse errors
  }

  return undefined;
}

async function createPaymentSigner(config: PaymentSignerConfig): Promise<MultiNetworkSigner | Awaited<ReturnType<typeof createSigner>>> {
  if (config.evm && config.svm) {
    const evmSigner = await createSigner(
      (config.evm.network || DEFAULT_EVM_NETWORK) as any,
      config.evm.privateKey as Hex,
    );
    const svmSigner = await createSigner(
      (config.svm.network || DEFAULT_SVM_NETWORK) as any,
      config.svm.privateKey,
    );
    return { evm: evmSigner, svm: svmSigner } as MultiNetworkSigner;
  }

  if (config.evm) {
    return createSigner((config.evm.network || DEFAULT_EVM_NETWORK) as any, config.evm.privateKey as Hex);
  }

  if (config.svm) {
    return createSigner((config.svm.network || DEFAULT_SVM_NETWORK) as any, config.svm.privateKey);
  }

  throw new Error('At least one signer configuration (evm or svm) must be provided');
}

export async function createX402Fetch(options: X402FetchOptions): Promise<typeof fetch> {
  const baseFetch = options.baseFetch ?? fetch;
  const signer = await createPaymentSigner(options.signer);

  const normalizedBaseFetch: typeof fetch = (input, init) => {
    const normalizedInit = normalizeRequestInit(init);
    return baseFetch(input, normalizedInit);
  };

  const wrappedFetch = wrapFetchWithPayment(normalizedBaseFetch, signer as any);

  const headerAwareFetch: typeof fetch = async (input, init) => {
    const normalizedInit = normalizeRequestInit(init);
    const response = await wrappedFetch(input as RequestInfo, normalizedInit);

    if (options.onSettlement) {
      const header = response.headers.get('x-payment-response');
      if (header) {
        try {
          const decoded = decodeXPaymentResponse(header);
          options.onSettlement({
            rawHeader: header,
            decoded,
            toolName: extractToolName(normalizedInit),
          });
        } catch (error) {
          console.warn('Failed to decode X-PAYMENT-RESPONSE header:', error);
        }
      }
    }

    return response;
  };

  return headerAwareFetch;
}

