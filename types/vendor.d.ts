declare module "vt-pbf" {
  const vtpbf: {
    fromGeojsonVt: (
      layerMap: Record<string, unknown>,
      options?: { version?: number; extent?: number },
    ) => Uint8Array;
  };
  export default vtpbf;
}

declare module "sql.js" {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export interface Database {
    run(sql: string): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    run(params?: unknown[]): void;
    free(): void;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
