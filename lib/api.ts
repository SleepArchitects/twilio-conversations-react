/**
 * Lambda API Client Utilities
 * Typed fetch wrapper for calling backend APIs
 */

// For server-side Lambda API calls, use the backend API URL
// For client-side calls, we always use relative paths to our local Next.js proxy routes
// to avoid CORS issues and leverage the server-side auth context.
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
    : "";

/**
 * Module-level flag to prevent multiple concurrent logout attempts on 401
 */
let isLoggingOut = false;

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
 * Handle 401 Unauthorized response by redirecting to logout
 */
function handleUnauthorized(): void {
  if (typeof window === "undefined" || isLoggingOut) return;
  isLoggingOut = true;
  window.location.href = "/auth/logout";
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
 * Build a URL path from segments, ensuring proper slash handling.
 * Use this instead of string template concatenation for paths.
 *
 * @example
 * buildPath('/outreach', 'conversations', conversationId) // => '/outreach/conversations/abc123'
 * buildPath('/outreach', 'conversations', conversationId, 'messages') // => '/outreach/conversations/abc123/messages'
 */
export function buildPath(...segments: (string | number)[]): string {
  return segments
    .map((segment, index) => {
      const str = String(segment);
      // Remove leading slash except for first segment
      const withoutLeading = index === 0 ? str : str.replace(/^\/+/, "");
      // Remove trailing slashes
      return withoutLeading.replace(/\/+$/, "");
    })
    .filter((segment) => segment.length > 0)
    .join("/");
}

function isClientSideApiRoute(path: string): boolean {
  return typeof window !== "undefined" && path.startsWith("/api/");
}

function buildRelativeUrlForProxy(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const fullPath = basePath ? `${basePath}${path}` : path;
  const url = new URL(fullPath, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.pathname + url.search;
}

function buildFullUrlForDirectCall(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const baseUrl =
    API_BASE_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3001");

  let finalUrl: string;
  if (API_BASE_URL) {
    const base = new URL(API_BASE_URL);
    const basePath = base.pathname.replace(/\/$/, "");
    const pathSegment = path.startsWith("/") ? path : `/${path}`;
    base.pathname = `${basePath}${pathSegment}`;
    finalUrl = base.toString();
  } else {
    const url = new URL(path, baseUrl);
    finalUrl = url.toString();
  }

  const url = new URL(finalUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if (isClientSideApiRoute(path)) {
    return buildRelativeUrlForProxy(path, params);
  }
  return buildFullUrlForDirectCall(path, params);
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
 * Get a cookie value by name (client-side only)
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// Decode JWT payload safely (no signature verification, just base64 decode)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (err) {
    console.warn("[API] Failed to decode user context token", err);
    return null;
  }
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

  console.log("[API] Request:", method, url);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(customHeaders as Record<string, string>),
  };

  // Log custom headers being passed in
  if (customHeaders) {
    console.log("[API] Custom headers received:", Object.keys(customHeaders));
    if ((customHeaders as Record<string, string>)["Authorization"]) {
      console.log("[API] Authorization header present in custom headers: YES");
      const authHeader = (customHeaders as Record<string, string>)[
        "Authorization"
      ];
      console.log(
        "[API] Authorization header value (first 20 chars):",
        authHeader?.substring(0, 20),
      );
    } else {
      console.log("[API] Authorization header present in custom headers: NO");
    }
  }

  // Add user context headers from the SleepConnect-issued JWT cookie
  // Lambdas expect tenant/practice/coordinator identifiers either as headers or query params
  if (typeof window !== "undefined") {
    const userContext = getCookie("x-sax-user-context");
    if (userContext) {
      headers["x-sax-user-context"] = userContext;
      const claims = decodeJwtPayload(userContext);
      if (claims) {
        const saxId = (claims as any).sax_id || (claims as any).saxId;
        const tenantId = (claims as any).tenant_id || (claims as any).tenantId;
        const practiceId =
          (claims as any).practice_id || (claims as any).practiceId;
        if (saxId) headers["x-coordinator-sax-id"] = String(saxId);
        if (tenantId) headers["x-tenant-id"] = String(tenantId);
        if (practiceId) headers["x-practice-id"] = String(practiceId);
      }
      console.log("[API] Added user context headers from cookie");
    }
  }

  // Log final headers before sending request
  console.log("[API] Final headers being sent:", Object.keys(headers));
  if (headers["Authorization"]) {
    console.log("[API] Authorization header in final headers: YES");
    console.log(
      "[API] Authorization header value (first 20 chars):",
      headers["Authorization"]?.substring(0, 20),
    );
  } else if (headers["authorization"]) {
    console.log("[API] authorization header (lowercase) in final headers: YES");
    console.log(
      "[API] authorization header value (first 20 chars):",
      headers["authorization"]?.substring(0, 20),
    );
  } else {
    console.log("[API] Authorization header in final headers: NO");
  }

  const config: RequestInit = {
    method,
    headers,
    cache: "no-store",
    ...restOptions,
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
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
