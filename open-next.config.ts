import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

// Check if we're in debug/development mode
const isDebugMode = process.env.OPEN_NEXT_DEBUG === 'true';

const config = {
  default: {
    // Disable minification to avoid pnpm module resolution issues in Lambda
    // When minified, OpenNext doesn't properly flatten pnpm's nested structure
    // Note: This keeps source maps available for production debugging
    minify: false,
    
    // Override configuration for multi-zone deployment
    override: {
      // Wrapper for the Next.js server handler
      // Using standard wrapper instead of streaming for CloudFront compatibility
      wrapper: "aws-lambda",
      
      // CloudFront handles /outreach routing, assets use /outreach-static prefix
      // The assetPrefix in next.config.mjs handles the static asset path
      
      // Include source maps in the build for production debugging
      // Since minify is false, esbuild will preserve source maps
      generateDockerfile: false,
    },
  },
  
  // Middleware configuration (if you use Next.js middleware)
  middleware: {
    external: true,
  },
  
  // Image optimization configuration
  imageOptimization: {
    // @ts-ignore
    arch: "x64",
    memory: 1536,
  },
  
  // Warmer configuration for keeping Lambda functions warm (optional)
  // warmer: {
  //   invokeFunction: "concurrently"
  // },
} satisfies OpenNextConfig;

export default config;
