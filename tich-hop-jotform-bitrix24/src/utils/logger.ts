import { config } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_PRIORITIES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, getCircularReplacer(), 2);
  } catch (err) {
    return `[Unserializable Object: ${(err as Error).message}]`;
  }
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}

export class Logger {
  private currentLevel: LogLevel;

  constructor(level: LogLevel = config.LOG_LEVEL) {
    this.currentLevel = level;
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public getLevel(): LogLevel {
    return this.currentLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const minPriority = LOG_PRIORITIES[this.currentLevel] ?? 1;
    const currentPriority = LOG_PRIORITIES[level] ?? 1;
    return currentPriority >= minPriority;
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (meta !== undefined && meta !== null) {
      const metaStr = typeof meta === 'object' ? safeStringify(meta) : String(meta);
      return `${prefix} ${message} ${metaStr}`;
    }
    return `${prefix} ${message}`;
  }

  public debug(message: string, meta?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  public info(message: string, meta?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  public warn(message: string, meta?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  public error(message: string, meta?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }
}

export const logger = new Logger();
