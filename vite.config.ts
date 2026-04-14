import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
	plugins: [
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart({
			srcDirectory: "src",
			start: { entry: "./start.tsx" },
			server: { entry: "./server.ts" },
		}),
		viteReact(),
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
		VitePWA({
			registerType: "prompt",
			includeAssets: ["favicon.ico", "logo192.png", "logo512.png"],
			manifest: {
				name: "Wspólniak",
				short_name: "Wspólniak",
				description: "Prywatne udostępnianie zdjęć dla rodziny",
				theme_color: "#18181b",
				background_color: "#ffffff",
				display: "standalone",
				start_url: "/app",
				icons: [
					{
						src: "logo192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "logo512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "logo512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				navigateFallback: null,
				importScripts: ["push-sw.js"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/imagedelivery\.net\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "cloudflare-images",
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 365 * 24 * 60 * 60,
							},
						},
					},
					{
						urlPattern: /\/api\/.*\/?$/i,
						method: "GET",
						handler: "NetworkFirst",
						options: {
							cacheName: "api-feed",
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 24 * 60 * 60,
							},
							networkTimeoutSeconds: 5,
						},
					},
				],
			},
		}),
	],
});

export default config;
