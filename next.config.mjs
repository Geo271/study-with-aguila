/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increases the upload limit to 10MB
    },
  },
};

export default nextConfig;