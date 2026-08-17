import { AppError } from "../errors.js";

interface Bucket {
  startedAt: number;
  count: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, amount = 1): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.startedAt >= this.windowMs) {
      this.buckets.set(key, { startedAt: now, count: amount });
      return;
    }
    bucket.count += amount;
    if (bucket.count > this.limit) {
      throw new AppError(
        "RATE_LIMITED",
        "Muitas ações em pouco tempo; aguarde um instante",
        429,
      );
    }
  }
}
