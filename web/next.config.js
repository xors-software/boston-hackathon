/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Same-origin proxy to the Elysia backend. Browsers (Safari, Brave,
  // Chrome incognito, Firefox-strict) drop third-party Set-Cookie when
  // the web and API live on different sites — `*.up.railway.app` is a
  // public suffix, so subdomain splits count as cross-site. Routing
  // /api/* through Next.js makes the browser see one origin; the
  // xors_session cookie sticks under SameSite=Lax.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://localhost:3001"}/:path*`,
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [],
  },
}

module.exports = nextConfig
