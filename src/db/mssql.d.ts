declare module 'mssql' {
  export interface ConnectionPool {
    request(): Request;
    close(): Promise<void>;
  }
  export interface Request {
    input(name: string, type: unknown, value: unknown): Request;
    query(command: string): Promise<unknown>;
  }
  export const MAX: number;
  export const Int: unknown;
  export function NVarChar(length?: number): unknown;
  export function connect(connectionString: string): Promise<ConnectionPool>;
}
