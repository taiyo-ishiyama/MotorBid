/** @type {import('next').NextConfig} */
const nextConfig = {
    logging: {
        fetches: {
            fullUrl: true
        }
    },
    images: {
        remotePatterns: [
            {protocol: 'https', hostname: '**'}
        ]
    },
    output: 'standalone'
};

export default nextConfig;
