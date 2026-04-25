/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Prevent Next from picking up /Users/alam/package-lock.json as workspace root
    root: __dirname,
  },
}

module.exports = nextConfig
