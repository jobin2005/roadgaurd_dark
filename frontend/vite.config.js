import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        // Serve index.html for all routes (SPA fallback)
        historyApiFallback: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    appType: 'spa',
});
