/**
 * Build information utilities
 * Automatically generated at build time - no manual updates needed!
 */

export interface BuildInfo {
  version: string;
  buildNumber: number;
  commitHash: string;
  commitDate: string;
  branch: string;
  buildDate: string;
  fullVersion: string;
  displayVersion: string;
}

let cachedBuildInfo: BuildInfo | null = null;

/**
 * Get build information
 * Falls back to default values if build info is not available
 */
export async function getBuildInfo(): Promise<BuildInfo> {
  if (cachedBuildInfo) {
    return cachedBuildInfo;
  }

  try {
    // Try to fetch from public folder
    const response = await fetch("/build-info.json");
    if (response.ok) {
      cachedBuildInfo = await response.json();
      return cachedBuildInfo as BuildInfo;
    }
  } catch (error) {
    console.warn("Failed to load build info:", error);
  }

  // Fallback for development
  const fallback: BuildInfo = {
    version: "0.1.0",
    buildNumber: 0,
    commitHash: "dev",
    commitDate: new Date().toISOString().split("T")[0],
    branch: "development",
    buildDate: new Date().toISOString(),
    fullVersion: "0.1.0.0",
    displayVersion: "v0.1.0 (Development)",
  };

  return fallback;
}

// Note: A synchronous, server-only variant previously lived here but was removed
// to keep this module client-safe (avoids bundling Node fs/path when imported
// by client components). If a server-only sync helper is needed, create a
// separate server module (e.g., buildInfo.server.ts) and ensure it is only
// imported from server components/routes.
