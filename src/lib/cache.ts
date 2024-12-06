class StorageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private removalCounts: Map<string, number> = new Map();
  private logTimeout: NodeJS.Timeout | null = null;

  remove(key: string) {
    this.cache.delete(key);
    // Count removals by key
    const count = (this.removalCounts.get(key) || 0) + 1;
    this.removalCounts.set(key, count);

    // Debounce log output
    if (this.logTimeout) {
      clearTimeout(this.logTimeout);
    }
    this.logTimeout = setTimeout(() => {
      this.logRemovals();
    }, 1000); // Wait 1 second before logging

    return true;
  }

  private logRemovals() {
    this.removalCounts.forEach((count, key) => {
      console.log(`Cache removed: ${key} (${count} times)`);
    });
    this.removalCounts.clear();
    this.logTimeout = null;
  }

  // ... existing code ...
} 