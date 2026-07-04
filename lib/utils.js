import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}





// ============================================================================
// FILE: lib/utils.js
// Complete utility functions for Meta Ads Campaign Management
// ============================================================================

/**
 * Convert date string to ISO 8601 format (required by Meta API)
 * Meta API requires: YYYY-MM-DDTHH:mm:ss+0000 or YYYY-MM-DDTHH:mm:ssZ
 * 
 * @param {string|Date} dateStr - Date string or Date object
 * @returns {string|null} ISO formatted date string or null
 * 
 * @example
 * toISOString("2026-01-20T10:00:00") → "2026-01-20T10:00:00Z"
 * toISOString("2026-01-20T10:00:00Z") → "2026-01-20T10:00:00Z"
 * toISOString(null) → null
 */
export const toISOString = (dateStr) => {
  if (!dateStr) return null;
  
  // If already a Date object
  if (dateStr instanceof Date) {
    return dateStr.toISOString();
  }
  
  // If string already has timezone (Z or +/-HH:mm)
  if (dateStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Add Z to indicate UTC timezone
  return `${dateStr}Z`;
};

/**
 * Convert dollar amount to cents (required by Meta API)
 * Meta API requires budget/bid amounts in cents (integer)
 * 
 * @param {number} amount - Amount in dollars
 * @returns {number} Amount in cents (rounded)
 * 
 * @example
 * convertToCents(50.00) → 5000
 * convertToCents(49.99) → 4999
 * convertToCents(100.50) → 10050
 */
export const convertToCents = (amount) => {
  return Math.round(amount * 100);
};

/**
 * Convert cents to dollars
 * 
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 * 
 * @example
 * convertToDollars(5000) → 50.00
 * convertToDollars(4999) → 49.99
 */
export const convertToDollars = (cents) => {
  return cents / 100;
};

/**
 * Create error with custom status code
 * 
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 500)
 * @returns {Error} Error object with status property
 * 
 * @example
 * throw createError("Campaign not found", 404);
 * throw createError("Invalid input", 400);
 */
export function createError(message, statusCode = 500, metadata = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  
  // Attach all metadata to the error object
  Object.keys(metadata).forEach(key => {
    error[key] = metadata[key];
  });
  
  return error;
}

/**
 * Validate URL format
 * 
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 * 
 * @example
 * validateUrl("https://example.com") → true
 * validateUrl("not-a-url") → false
 */
export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate email format
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sleep/delay function for rate limiting
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Resolves after delay
 * 
 * @example
 * await sleep(1000); // Wait 1 second
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 * Useful for handling Meta API rate limits
 * 
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise} Result of function
 * 
 * @example
 * const result = await retryWithBackoff(
 *   () => metaAPI.createCampaign(data),
 *   3,
 *   1000
 * );
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Wait with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Chunk array into smaller arrays
 * Useful for batch processing
 * 
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array[]} Array of chunks
 * 
 * @example
 * chunkArray([1,2,3,4,5], 2) → [[1,2], [3,4], [5]]
 */
export const chunkArray = (array, size) => {
  return Array.from(
    { length: Math.ceil(array.length / size) },
    (_, i) => array.slice(i * size, i * size + size)
  );
};

/**
 * Format number with commas
 * 
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 * 
 * @example
 * formatNumber(1234567) → "1,234,567"
 */
export const formatNumber = (num) => {
  return num.toLocaleString();
};

/**
 * Format currency (USD)
 * 
 * @param {number} amount - Amount in dollars
 * @returns {string} Formatted currency
 * 
 * @example
 * formatCurrency(1234.56) → "$1,234.56"
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/**
 * Format percentage
 * 
 * @param {number} value - Decimal value (0.0 - 1.0)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted percentage
 * 
 * @example
 * formatPercentage(0.1567) → "15.67%"
 * formatPercentage(0.1567, 1) → "15.7%"
 */
export const formatPercentage = (value, decimals = 2) => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Calculate percentage change
 * 
 * @param {number} oldValue - Old value
 * @param {number} newValue - New value
 * @returns {number} Percentage change
 * 
 * @example
 * calculatePercentageChange(100, 150) → 50 (50% increase)
 * calculatePercentageChange(100, 75) → -25 (25% decrease)
 */
export const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

/**
 * Sanitize string for Meta API
 * Remove special characters that might cause issues
 * 
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = (str) => {
  if (!str) return "";
  return str
    .trim()
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control characters
};

/**
 * Generate unique ID (UUID v4)
 * 
 * @returns {string} UUID
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Deep clone object
 * 
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Safely parse JSON
 * 
 * @param {string} jsonString - JSON string
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed object or default value
 */
export const safeJsonParse = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

/**
 * Check if object is empty
 * 
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

/**
 * Remove null/undefined values from object
 * 
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
export const removeEmpty = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  );
};

/**
 * Validate Meta campaign name
 * Max 400 characters, no empty
 * 
 * @param {string} name - Campaign name
 * @returns {boolean} True if valid
 */
export const validateCampaignName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 400;
};

/**
 * Validate budget amount
 * Must be at least $1.00
 * 
 * @param {number} amount - Budget amount in dollars
 * @returns {boolean} True if valid
 */
export const validateBudget = (amount) => {
  return typeof amount === 'number' && amount >= 1;
};

/**
 * Validate date range
 * End must be after start
 * 
 * @param {string|Date} startTime - Start date
 * @param {string|Date} endTime - End date
 * @returns {boolean} True if valid
 */
export const validateDateRange = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return end > start;
};

/**
 * Format date for display
 * 
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date (e.g., "Jan 20, 2026")
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format datetime for display
 * 
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted datetime (e.g., "Jan 20, 2026, 10:30 AM")
 */
export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get relative time (e.g., "2 hours ago")
 * 
 * @param {string|Date} date - Date
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'just now';
};

/**
 * Truncate string with ellipsis
 * 
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export const truncate = (str, maxLength = 100) => {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 * 
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convert snake_case to Title Case
 * 
 * @param {string} str - Snake case string
 * @returns {string} Title case string
 * 
 * @example
 * snakeToTitle("link_click") → "Link Click"
 */
export const snakeToTitle = (str) => {
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
};

/**
 * Parse Meta API error
 * 
 * @param {Error} error - Error object from Meta API
 * @returns {Object} Parsed error details
 */
export const parseMetaError = (error) => {
  return {
    code: error?.response?.error?.code || error?.body?.error?.code || 0,
    subcode: error?.response?.error?.error_subcode || error?.body?.error?.error_subcode,
    message: error?.response?.error?.message || error?.body?.error?.message || error?.message,
    type: error?.response?.error?.type || error?.body?.error?.type,
    userMessage: error?.response?.error?.error_user_msg || error?.body?.error?.error_user_msg,
    fbTraceId: error?.response?.error?.fbtrace_id || error?.body?.error?.fbtrace_id || 'N/A'
  };
};

/**
 * Check if error is rate limit error
 * 
 * @param {Error} error - Error object
 * @returns {boolean} True if rate limit error
 */
export const isRateLimitError = (error) => {
  const parsed = parseMetaError(error);
  return [4, 17, 32, 613, 80004].includes(parsed.code);
};

/**
 * Check if error is auth error
 * 
 * @param {Error} error - Error object
 * @returns {boolean} True if auth error
 */
export const isAuthError = (error) => {
  const parsed = parseMetaError(error);
  return [190, 102, 104, 190].includes(parsed.code);
};


// Format Meta error for API response
export function formatMetaErrorResponse(error) {
  const response = {
    success: false,
    error: {
      message: error.message,
      statusCode: error.statusCode || 500,
    }
  };

  // Add Meta-specific error details if they exist
  if (error.code) response.error.code = error.code;
  if (error.subcode) response.error.subcode = error.subcode;
  if (error.type) response.error.type = error.type;
  if (error.fbtraceId) response.error.fbtraceId = error.fbtraceId;
  if (error.userTitle) response.error.userTitle = error.userTitle;
  if (error.userMessage) response.error.userMessage = error.userMessage;
  if (error.parameter) response.error.parameter = error.parameter;
  if (error.actionRequired) response.error.actionRequired = error.actionRequired;
  
  // Add retry information if available
  if (error.retryAfter) response.error.retryAfter = error.retryAfter;

  return response;
}

// Export all utilities
export default {
  toISOString,
  convertToCents,
  convertToDollars,
  createError,
  validateUrl,
  validateEmail,
  sleep,
  retryWithBackoff,
  chunkArray,
  formatNumber,
  formatCurrency,
  formatPercentage,
  calculatePercentageChange,
  sanitizeString,
  generateUUID,
  deepClone,
  safeJsonParse,
  isEmpty,
  removeEmpty,
  validateCampaignName,
  validateBudget,
  validateDateRange,
  formatDate,
  formatDateTime,
  getRelativeTime,
  truncate,
  capitalize,
  snakeToTitle,
  parseMetaError,
  isRateLimitError,
  isAuthError,
  formatMetaErrorResponse
};