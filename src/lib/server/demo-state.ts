import type { NextRequest, NextResponse } from 'next/server';

// DEMO=1 keeps each visitor's edits and settings apart: a random cookie names the visitor, and their
// changes live in memory under that name. Nobody else sees them, and they expire after DEMO_RESET_MIN.

export const isDemo = () => process.env.DEMO === '1' || process.env.DEMO === 'true';
export const DEMO_RESET_MIN = 30;
const MAX_VISITORS = 2000; // past this, the oldest visitors' changes are dropped first

const COOKIE = 'abod_demo';
const ID = /^[0-9a-f-]{36}$/;

interface Entry<T> { value: T; at: number }
// On globalThis so every route bundle shares one store.
const g = globalThis as typeof globalThis & { __abodDemo?: Record<string, Map<string, Entry<unknown>>> };

export function demoState<T>(name: string) {
  const store = ((g.__abodDemo ??= {})[name] ??= new Map()) as Map<string, Entry<T>>;
  return {
    get(visitor: string | undefined): T | undefined {
      const e = visitor ? store.get(visitor) : undefined;
      return e && Date.now() - e.at < DEMO_RESET_MIN * 60_000 ? e.value : undefined;
    },
    set(visitor: string, value: T) {
      store.delete(visitor); // re-insert so the Map's order stays oldest-first
      store.set(visitor, { value, at: Date.now() });
      for (const k of store.keys()) {
        if (store.size <= MAX_VISITORS) break;
        store.delete(k);
      }
    },
    delete(visitor: string | undefined) {
      if (visitor) store.delete(visitor);
    },
  };
}

// The visitor named by the request's cookie (demo only).
export function demoVisitor(req: NextRequest): string | undefined {
  if (!isDemo()) return undefined;
  const v = req.cookies.get(COOKIE)?.value;
  return v && ID.test(v) ? v : undefined;
}

// For writes: the visitor's name, or a new one (send it back with withVisitor).
export function claimVisitor(req: NextRequest): string | undefined {
  return isDemo() ? demoVisitor(req) ?? crypto.randomUUID() : undefined;
}

export function withVisitor<T extends NextResponse>(res: T, visitor: string | undefined): T {
  if (visitor) res.cookies.set(COOKIE, visitor, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: DEMO_RESET_MIN * 60 });
  return res;
}
