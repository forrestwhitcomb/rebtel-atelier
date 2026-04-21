/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@rebtel-atelier/spec",
    "@rebtel-atelier/rebtel-ds",
    "@rebtel-atelier/renderer",
  ],
  webpack: (config) => {
    // Workspace packages import internal modules with `.js` extensions
    // (NodeNext style, compatible with tsc and vitest). Tell webpack to
    // resolve those to `.ts`/`.tsx` sources.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
