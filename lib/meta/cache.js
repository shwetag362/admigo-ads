// ============================================
// lib/meta/cache.js
// In-Memory Cache (No Redis)
// ============================================

class InMemoryCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  }

  set(key, value, ttl = this.DEFAULT_TTL) {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now() + ttl);
  }

  get(key) {
    const expiry = this.timestamps.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.timestamps.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }
}

export const cache = new InMemoryCache();

// Cleanup every 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000);