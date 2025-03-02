// Debug utility to control console output based on DEBUG_MODE environment variable

// Check if debug mode is enabled (defaults to false)
const isDebugMode = process.env.DEBUG_MODE === 'true';

// Define a type for log parameters
type LogMessage = string | number | boolean | null | undefined | unknown;

/**
 * Debug log function that only outputs in debug mode
 * Use this for development-only logging
 */
export const debugLog = (...args: LogMessage[]) => {
  if (isDebugMode) {
    console.log('[DEBUG]', ...args);
  }
};

/**
 * Info log function that only outputs in debug mode
 * Use this for development-only information
 */
export const infoLog = (...args: LogMessage[]) => {
  if (isDebugMode) {
    console.info('[INFO]', ...args);
  }
};

/**
 * Warning log function that always outputs
 * Use this for important warnings that should be visible in production
 */
export const warnLog = (...args: LogMessage[]) => {
  console.warn('[WARN]', ...args);
};

/**
 * Error log function that always outputs
 * Use this for critical errors that should be visible in production
 */
export const errorLog = (...args: LogMessage[]) => {
  console.error('[ERROR]', ...args);
}; 