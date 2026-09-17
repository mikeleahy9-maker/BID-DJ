/**
 * Utility functions for API responses.
 * Use this in Route Handlers for consistent response formatting.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: ApiErrorMeta;
}

export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export interface ApiErrorMeta {
  [key: string]: unknown;
}

export function apiError(
  error: string,
  message?: string,
  meta?: ApiErrorMeta
): ApiResponse<null> {
  return {
    success: false,
    error,
    message: message || error,
    ...(meta ? { meta } : {}),
  };
}
