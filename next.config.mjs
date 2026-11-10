/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["firebase-admin"],
  transpilePackages: ["sanitize-html", "htmlparser2"]
};
export default nextConfig;
