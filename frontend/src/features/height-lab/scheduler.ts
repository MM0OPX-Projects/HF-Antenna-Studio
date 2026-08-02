export type HeightCalculationPhase = "idle" | "debouncing" | "calculating" | "success" | "cached" | "error";

export interface HeightCalculationState<T> {
  key: string;
  phase: HeightCalculationPhase;
  result: T | null;
  error: string | null;
}

export type HeightCalculationListener<T> = (state: HeightCalculationState<T>) => void;

export class HeightLabScheduler<T> {
  private readonly cache = new Map<string, T>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  private requestId = 0;

  constructor(
    private readonly debounceMs = 450,
    private readonly maxCacheEntries = 40,
  ) {}

  schedule(
    key: string,
    request: (signal: AbortSignal) => Promise<T>,
    listener: HeightCalculationListener<T>,
  ): void {
    this.supersede();
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      listener({ key, phase: "cached", result: cached, error: null });
      return;
    }

    const requestId = this.requestId;
    listener({ key, phase: "debouncing", result: null, error: null });
    this.timer = setTimeout(async () => {
      this.timer = null;
      const controller = new AbortController();
      this.controller = controller;
      listener({ key, phase: "calculating", result: null, error: null });
      try {
        const result = await request(controller.signal);
        if (requestId !== this.requestId || controller.signal.aborted) return;
        this.remember(key, result);
        listener({ key, phase: "success", result, error: null });
      } catch (error) {
        if (requestId !== this.requestId || controller.signal.aborted) return;
        listener({
          key,
          phase: "error",
          result: null,
          error: error instanceof Error ? error.message : "The calculation failed unexpectedly.",
        });
      } finally {
        if (this.controller === controller) this.controller = null;
      }
    }, this.debounceMs);
  }

  cancel(): void {
    this.supersede();
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  private supersede(): void {
    this.requestId += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
  }

  private remember(key: string, result: T): void {
    this.cache.set(key, result);
    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
