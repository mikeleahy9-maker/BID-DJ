/**
 * Utility functions for API responses.
 * Use this in Route Handlers for consistent response formatting.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function apiError(error: string, message?: string): ApiResponse<null> {
  return {
    success: false,
    error,
    message: message || error,
  };
}
