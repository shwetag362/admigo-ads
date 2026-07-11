// lib/meta/apiClient.js
// Meta API Wrapper with Retry Logic
// ============================================

import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';
import { logger } from '@/lib/logger';
import { RETRY_CONFIG } from './constants.js';
import { rateLimiter } from './rateLimiter.js';

export class MetaApiClient {
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async withRetry(fn, context = {}) {
    const { accountId, operation } = context;
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
      try {
        // Check rate limit before making call
        if (accountId) {
          const limitCheck = await rateLimiter.checkLimit(accountId);
          
          if (!limitCheck.allowed) {
            logger.warn(`Rate limit reached for account ${accountId}. Reset in ${Math.ceil(limitCheck.waitTime / 1000)}s`);
            throw new Error(`RATE_LIMIT_EXCEEDED:${limitCheck.waitTime}`);
          }

          // Adaptive delay based on usage
          const delay = rateLimiter.getAdaptiveDelay(accountId);
          if (delay > 0) {
            await this.sleep(delay);
          }
        }

        const result = await fn();
        
        // Record successful call
        if (accountId) {
          rateLimiter.recordCall(accountId);
        }
        
        return result;
      } catch (error) {
        const errorCode = error.code || error.error_subcode;
        const isRateLimit = 
          RETRY_CONFIG.RATE_LIMIT_CODES.includes(errorCode) ||
          error.message?.includes('rate limit') ||
          error.message?.includes('RATE_LIMIT');

        const isTokenError = RETRY_CONFIG.TOKEN_ERROR_CODES.includes(errorCode);

        // Don't retry token errors - need user intervention
        if (isTokenError) {
          logger.error(`Token error (${errorCode}) for ${operation}`, error);
          throw {
            code: 'TOKEN_ERROR',
            message: 'Access token expired or invalid',
            needsReauth: true,
            originalError: error,
          };
        }

        // Retry rate limit errors
        if (isRateLimit && attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
          const backoffDelay = RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1);
          logger.warn(`Rate limit hit for ${operation}. Retry ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS} in ${backoffDelay}ms`);
          await this.sleep(backoffDelay);
          continue;
        }

        // Last attempt or non-retryable error
        if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
          logger.error(`Failed after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts: ${operation}`, error);
        }
        
        throw error;
      }
    }
  }

  static init(accessToken) {
    FacebookAdsApi.init(accessToken);
  }
}
