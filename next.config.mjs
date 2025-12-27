/** @type {import('next').NextConfig} */
const nextConfig = {
	// Output standalone for OpenNext deployment
	output: "standalone",

	// Multi-zone configuration for sleepconnect integration
	// basePath restored - CloudFront now forwards /outreach/* AS-IS to Lambda
	// CloudFront Function 'strip-outreach-prefix' must be removed from /outreach/* behavior
	// Use /outreach-static for assets (handled by CloudFront S3 origin)
	basePath: "/outreach",
	assetPrefix: process.env.NODE_ENV === "production" ? "/outreach-static" : "/outreach",

	// Disable ESLint during builds (we run separately)
	eslint: {
		ignoreDuringBuilds: true,
	},

	// Disable TypeScript errors during builds (we run separately)
	typescript: {
		ignoreBuildErrors: false,
	},

	// Webpack configuration to handle optional ws dependencies and Web Workers
	webpack: (config, { isServer }) => {
		// These are optional native modules used by the ws package (via Twilio)
		// They provide performance optimizations but are not required
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				bufferutil: false,
				"utf-8-validate": false,
			};
		}

		return config;
	},
};

export default nextConfig;
