import Redis from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared Redis connection for BullMQ workers to prevent connection exhaustion
// Especially important for Upstash which has strict connection limits
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

connection.on('connect', () => console.log('Worker connected to Redis'));
connection.on('error', (err) => console.error('Worker Redis error:', err));
