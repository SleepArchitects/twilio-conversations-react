import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

// Check if we're in debug/development mode
const isDebugMode = process.env.OPEN_NEXT_DEBUG === 'true';

const config = {
  default: {
    // Minify handlers in production for smaller bundles and faster cold starts
    // Disabled in debug mode (OPEN_NEXT_DEBUG=true) to preserve source maps
    minify: !isDebugMode,
    
    // Override configuration for multi-zone deployment
    override: {
      // Wrapper for the Next.js server handler
      wrapper: "aws-lambda-streaming",
      
      // Since we use basePath: "/outreach", ensure assets are correctly resolved
      // The assetPrefix in next.config.mjs handles the static asset path
    },
  },
  
  // Middleware configuration (if you use Next.js middleware)
  middleware: {
    external: true,
  },
  
  // Image optimization configuration
  imageOptimization: {
    arch: "x64",
    memory: 1536,
  },
  
  // Warmer configuration for keeping Lambda functions warm (optional)
  // warmer: {
  //   invokeFunction: "concurrently"
  // },
} satisfies OpenNextConfig;

export default config;
