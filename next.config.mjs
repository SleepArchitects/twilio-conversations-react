/** @type {import('next').NextConfig} */
const nextConfig = {
	// Output standalone for OpenNext deployment
	output: "standalone",

	// Multi-zone configuration for sleepconnect integration
	basePath: "/outreach",
	assetPrefix: "/outreach-static",

	// Disable ESLint during builds (we run separately)
	eslint: {
		ignoreDuringBuilds: true,
	},

	// Disable TypeScript errors during builds (we run separately)
	typescript: {
		ignoreBuildErrors: false,
	},

	// Webpack configuration to handle optional ws dependencies
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
