/**
 * 简单的日志记录工具
 */
export interface Logger {
  log: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

/**
 * 创建一个带有前缀的日志记录器
 */
export function createLogger(prefix: string): Logger {
  const timestamp = () => new Date().toISOString();
  
  return {
    log: (message: string) => {
      console.error(`[${timestamp()}] [${prefix}] [INFO] ${message}`);
    },
    error: (message: string) => {
      console.error(`[${timestamp()}] [${prefix}] [ERROR] ${message}`);
    },
    warn: (message: string) => {
      console.error(`[${timestamp()}] [${prefix}] [WARN] ${message}`);
    }
  };
} 