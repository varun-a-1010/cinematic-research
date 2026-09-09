const transientStatuses = new Set([429, 500, 502, 503, 504]);

export function modelChain(primary: string, fallbacks = process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.7-flash,gemini-3.6-flash") {
  return [...new Set([primary, ...fallbacks.split(",")].map(s => s.trim()).filter(Boolean))];
}

function isTransient(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: number; cause?: unknown };
  return transientStatuses.has(e.status ?? e.code ?? 0);
}

export async function withModelFallback<T>(
  models: string[],
  operation: (model: string) => Promise<T>,
  sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await operation(model);
      } catch (error) {
        if (!isTransient(error)) throw error;
        lastError = error;
        console.warn("[research] Gemini transient failure", { model, attempt: attempt + 1 });
        if (attempt === 0) await sleep(1000 + Math.random() * 1000);
      }
    }
  }
  throw lastError ?? new Error("No Gemini models configured.");
}
