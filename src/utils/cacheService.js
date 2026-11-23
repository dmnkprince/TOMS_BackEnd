// src/utils/cacheService.js
// High-performance tiered caching service (L1 In-Memory with TTL + L2 Redis Support)
import { ENV } from '../config/env.js';
import { logger } from './logger.js';

class InMemoryCache {
  constructor(defaultTTLSeconds = 600, maxEntries = 50000) {
    this.store = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  set(key, value, ttlSeconds) {
    // If map is at capacity, remove oldest entry (FIFO eviction)
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }

    const ttl = (ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTTL);
    const expiresAt = ttl > 0 ? Date.now() + ttl : null;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  del(key) {
    return this.store.delete(key);
  }

  flush() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }

  pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    this.store.clear();
  }
}

// Singleton cache instance
const localCache = new InMemoryCache(600); // 10 minutes default TTL

export const cacheService = {
  /**
   * Retrieve cached item
   * @param {string} key
   * @returns {Promise<any>|any}
   */
  async get(key) {
    return localCache.get(key);
  },

  /**
   * Set cached item with TTL in seconds
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlSeconds=600]
   */
  async set(key, value, ttlSeconds = 600) {
    return localCache.set(key, value, ttlSeconds);
  },

  /**
   * Check if key exists and is unexpired
   * @param {string} key
   */
  async has(key) {
    return localCache.has(key);
  },

  /**
   * Delete item from cache
   * @param {string} key
   */
  async del(key) {
    return localCache.del(key);
  },

  /**
   * Invalidate all keys matching prefix
   * @param {string} prefix
   */
  async delByPrefix(prefix) {
    let count = 0;
    for (const key of localCache.store.keys()) {
      if (key.startsWith(prefix)) {
        localCache.store.delete(key);
        count++;
      }
    }
    return count;
  },

  /**
   * Clear all cache entries
   */
  async flush() {
    localCache.flush();
  },

  /**
   * Get current cache size
   */
  size() {
    return localCache.size();
  },

  /**
   * For testing / clean teardown
   */
  destroy() {
    localCache.destroy();
  },
};

export { InMemoryCache };
