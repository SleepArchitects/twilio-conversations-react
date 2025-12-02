/**
 * Lambda API Client Utilities
 * Typed fetch wrapper for calling backend APIs
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, message: string, code: string = "UNKNOWN_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Response shape for error responses from the API
 */
interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
}

/**
 * Options for API requests
 */
interface RequestOptions extends Omit<RequestInit, "method" | "body"> {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build URL with query parameters
 */
function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(path, API_BASE_URL || window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Parse error response from API
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  let errorMessage = `Request failed with status ${response.status}`;
  let errorCode = "REQUEST_FAILED";

  try {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const errorData: ApiErrorResponse = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code || errorCode;
    } else {
      const text = await response.text();
      if (text) {
        errorMessage = text;
      }
    }
  } catch {
    // Use default error message if parsing fails
  }

  return new ApiError(response.status, errorMessage, errorCode);
}

/**
 * Core fetch wrapper with error handling
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: customHeaders, ...restOptions } = options;

  const url = buildUrl(path, params);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...customHeaders,
  };

  const config: RequestInit = {
    method,
    headers,
    ...restOptions,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  // Handle empty responses (204 No Content)
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return undefined as T;
  }

  // Parse JSON response
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  // Return text for non-JSON responses
  return response.text() as unknown as T;
}

/**
 * API client with typed methods for HTTP operations
 */
export const api = {
  /**
   * Perform a GET request
   * @param path - API endpoint path
   * @param options - Request options including query params
   */
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  /**
   * Perform a POST request
   * @param path - API endpoint path
   * @param body - Request body (will be JSON stringified)
   * @param options - Request options
   */
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  /**
   * Perform a PATCH request
   * @param path - API endpoint path
   * @param body - Request body (will be JSON stringified)
   * @param options - Request options
   */
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  /**
   * Perform a DELETE request
   * @param path - API endpoint path
   * @param options - Request options
   */
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },
};

export default api;
