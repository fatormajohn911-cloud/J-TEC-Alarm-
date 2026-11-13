import { Redis } from '@upstash/redis';

export const QUOTA_LIMITS = {
  chatPerInstallPerDay: 40,
  speakPerInstallPerDay: 15,
  requestsPerIpPerDay: 150,
  registerPerIpPerDay: 20,
} as const;

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  reason?: string;
}

function getUtcDayWindow(): {
  dayKey: string;
  ttlSeconds: number;
  resetAt: string;
} {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
  const ttlSeconds = Math.max(
    1,
    Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000)
  );
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
  return {
    dayKey,
    ttlSeconds,
    resetAt: nextMidnight.toISOString(),
  };
}

export class QuotaService {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  private async incrementWithDailyExpiry(
    key: string,
    ttlSeconds: number
  ): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  async checkRegisterQuota(ip: string): Promise<QuotaCheckResult> {
    const { dayKey, ttlSeconds, resetAt } = getUtcDayWindow();
    const key = `aiwake:q:reg:${dayKey}:${ip}`;
    const count = await this.incrementWithDailyExpiry(key, ttlSeconds);
    const remaining = Math.max(0, QUOTA_LIMITS.registerPerIpPerDay - count);

    if (count > QUOTA_LIMITS.registerPerIpPerDay) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        reason: 'Daily device registration limit reached for this network.',
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }

  async checkAiRequestQuota(
    kind: 'chat' | 'speak',
    installId: string,
    ip: string
  ): Promise<QuotaCheckResult> {
    const { dayKey, ttlSeconds, resetAt } = getUtcDayWindow();
    const ipKey = `aiwake:q:ip:${dayKey}:${ip}`;
    const installKey = `aiwake:q:${kind}:${dayKey}:${installId}`;
    const installLimit =
      kind === 'chat'
        ? QUOTA_LIMITS.chatPerInstallPerDay
        : QUOTA_LIMITS.speakPerInstallPerDay;

    const [ipCount, installCount] = await Promise.all([
      this.incrementWithDailyExpiry(ipKey, ttlSeconds),
      this.incrementWithDailyExpiry(installKey, ttlSeconds),
    ]);

    const installRemaining = Math.max(0, installLimit - installCount);

    if (ipCount > QUOTA_LIMITS.requestsPerIpPerDay) {
      return {
        allowed: false,
        remaining: installRemaining,
        resetAt,
        reason: 'Daily network request limit reached. Resets at UTC midnight.',
      };
    }

    if (installCount > installLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        reason:
          kind === 'chat'
            ? 'Daily chat limit (40) reached. Resets at UTC midnight.'
            : 'Daily voice limit (15) reached. Resets at UTC midnight.',
      };
    }

    return {
      allowed: true,
      remaining: installRemaining,
      resetAt,
    };
  }
}
