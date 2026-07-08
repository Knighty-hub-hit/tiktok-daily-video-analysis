declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    [key: string]: unknown;
  };
}

interface D1Database {
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  dump(): Promise<ArrayBuffer>;
  exec(query: string): Promise<D1ExecResult>;
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  all<T = unknown>(): Promise<D1Result<T>>;
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = Record<string, unknown>> {
  error?: string;
  meta: Record<string, unknown>;
  results?: T[];
  success: boolean;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
