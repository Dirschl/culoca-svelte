import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

const config = {
	plugins: [sveltekit()],
	test: {
		// Historical source snapshots are reference material, not executable test suites.
		exclude: [...configDefaults.exclude, 'src-backup-*/**']
	},
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
		},
		port: 5173,
		strictPort: true,
		fs: {
			// Erlaube Zugriff auf static Verzeichnis für Favicon
			allow: ['..']
		}
	}
};

export default defineConfig(config);
