// src/utils/uuid-generator.ts

export class Utils {
  static generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static generateDeterministicUUID(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex.slice(0,8)}-${hex.slice(0,4)}-4${hex.slice(4,7)}-${(parseInt(hex.slice(6,7), 16) | 8).toString(16)}${hex.slice(7,11)}-${hex.padEnd(16, '0').slice(0,12)}`;
  }

  static validateNamespace(ns: string): boolean {
    return /^[a-z0-9_-]+$/.test(ns);
  }

  static parseId(fullId: string): { namespace: string; name: string } | null {
    const [ns, name] = fullId.split(':');
    if (!ns || !name) return null;
    return { namespace: ns, name };
  }
}
