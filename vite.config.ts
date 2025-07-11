import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		rollupOptions: {
			output: {
				// Bessere Cache-Busting durch längere Hashes
				chunkFileNames: '_app/immutable/chunks/[name]-[hash].js',
				assetFileNames: '_app/immutable/assets/[name]-[hash].[ext]'
			}
		}
	},
	server: {
		// Entwicklungs-Cache-Kontrolle
		headers: {
			'Cache-Control': 'no-cache'
		}
	}
});
