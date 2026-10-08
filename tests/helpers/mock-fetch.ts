/**
 * Test-only helper: install a mocked global fetch for one module's tests.
 *
 * The provider transport reads its endpoint and key from environment
 * variables, so tests exercise the real HTTP code path against a local mock
 * — no external service is contacted and no API key is required.
 */

export type MockResponse =
  | { status: number; body: string; contentType?: string }
  | { throws: Error };

export type FetchLog = Array<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}>;

/**
 * Replace global fetch with a stub. Returns the log of received requests and
 * a restore function.
 */
export function mockFetch(respond: (req: Request) => MockResponse) {
  const log: FetchLog = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as string | URL, init);
    log.push({
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: req.body ? undefined : undefined,
    });

    // Parse the body for assertions without consuming it.
    try {
      const cloned = req.clone();
      const text = await cloned.text();
      log[log.length - 1].body = text ? JSON.parse(text) : null;
    } catch {
      log[log.length - 1].body = "<unreadable>";
    }

    const spec = respond(req);
    if ("throws" in spec) throw spec.throws;

    return new Response(spec.body, {
      status: spec.status,
      headers: { "content-type": spec.contentType ?? "application/json" },
    });
  }) as typeof fetch;

  return {
    log,
    restore() {
      globalThis.fetch = original;
    },
  };
}

/**
 * Capture env vars, run the callback (sync or async), then restore them.
 * Awaits the callback so cleanup never races ahead of an async test body.
 */
export async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => T | Promise<T>
): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
