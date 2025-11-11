export type ConnectivityTestPayload = {
  endpointUrl: string;
  modelName: string;
  apiKey?: string;
  timeoutMs?: number;
};

export interface ConnectivityTester {
  test(payload: ConnectivityTestPayload): Promise<void>;
}

function normalizeBaseUrl(raw: string): URL {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('Only http/https endpoints are supported');
  }
  url.hash = '';
  url.search = '';
  return url;
}

function buildModelsUrl(base: URL): string {
  const url = new URL(base.toString());
  const trimmedPath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');

  if (!trimmedPath) {
    url.pathname = '/models';
  } else if (trimmedPath.endsWith('/models')) {
    url.pathname = trimmedPath;
  } else {
    url.pathname = `${trimmedPath}/models`;
  }

  return url.toString();
}

export class FetchConnectivityTester implements ConnectivityTester {
  async test(payload: ConnectivityTestPayload): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), payload.timeoutMs ?? 30_000);

    try {
      const baseUrl = normalizeBaseUrl(payload.endpointUrl);
      const attempts: Array<{ url: string; method: 'GET' | 'HEAD' }> = [
        { url: buildModelsUrl(baseUrl), method: 'GET' },
        { url: baseUrl.toString(), method: 'HEAD' },
      ];

      let lastError: Error | null = null;

      for (const attempt of attempts) {
        try {
          const response = await fetch(attempt.url, {
            method: attempt.method,
            signal: controller.signal,
            headers: payload.apiKey
              ? {
                  Authorization: `Bearer ${payload.apiKey}`,
                }
              : undefined,
          });

          if (response.ok) {
            return;
          }

          lastError = new Error(`接続テストに失敗しました (status: ${response.status})`);
        } catch (error) {
          if (error instanceof Error) {
            lastError = new Error(`接続テストに失敗しました (${error.message})`);
          } else {
            lastError = new Error('接続テストに失敗しました');
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      throw new Error('接続テストに失敗しました');
    } finally {
      clearTimeout(timeout);
    }
  }
}
