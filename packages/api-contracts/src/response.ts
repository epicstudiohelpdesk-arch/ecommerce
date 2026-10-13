export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    correlationId?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export function createSuccessResponse<T>(data: T, correlationId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {}),
    },
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  correlationId?: string,
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(correlationId ? { correlationId } : {}),
      timestamp: new Date().toISOString(),
    },
  };
}
