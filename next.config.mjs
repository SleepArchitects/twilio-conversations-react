/** @type {import('next').NextConfig} */
const nextConfig = {
	// Output standalone for OpenNext deployment
	output: "standalone",

	// Multi-zone configuration for sleepconnect integration
	basePath: "/outreach",
	assetPrefix: "/outreach",

	// Disable ESLint during builds (we run separately)
	eslint: {
		ignoreDuringBuilds: true,
	},

	// Disable TypeScript errors during builds (we run separately)
	typescript: {
		ignoreBuildErrors: false,
	},
};

export default nextConfig;
