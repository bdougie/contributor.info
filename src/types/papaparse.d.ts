/**
 * Type declarations for papaparse
 * Inline declarations to ensure consistent builds across all environments
 */

declare module 'papaparse' {
  export interface UnparseConfig {
    quotes?: boolean | boolean[];
    quoteChar?: string;
    escapeChar?: string;
    delimiter?: string;
    header?: boolean;
    newline?: string;
    skipEmptyLines?: boolean | 'greedy';
    columns?: string[];
  }

  export function unparse<T>(
    data: T[] | { fields: string[]; data: T[] },
    config?: UnparseConfig
  ): string;

  export interface ParseConfig<T = unknown> {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    transformHeader?: (header: string, index: number) => string;
    dynamicTyping?: boolean | { [key: string]: boolean };
    preview?: number;
    comments?: boolean | string;
    step?: (results: ParseResult<T>, parser: Parser) => void;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: ParseError) => void;
    download?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    fastMode?: boolean;
    withCredentials?: boolean;
    transform?: (value: string, field: string | number) => unknown;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
  }

  export interface Parser {
    abort: () => void;
    pause: () => void;
    resume: () => void;
  }

  export function parse<T>(
    input: string | File | NodeJS.ReadableStream,
    config?: ParseConfig<T>
  ): ParseResult<T>;
}
