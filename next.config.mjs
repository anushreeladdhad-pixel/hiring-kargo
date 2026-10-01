/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'pdfjs-dist'],
    // pdfjs-dist's worker script is loaded dynamically at runtime, which
    // Next's build-time file tracer can't discover on its own — without
    // this, the worker file is silently left out of the deployed
    // serverless function and PDF parsing fails in production only.
    outputFileTracingIncludes: {
      '/api/upload': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    },
  },
};

export default nextConfig;
