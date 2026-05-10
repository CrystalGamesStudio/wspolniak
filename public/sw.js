// Service worker for Wspólniak — handles web push notifications and asset caching.
// Registered manually from src/components/pwa/pwa-shell.tsx.

const CACHE_NAME = "wspolniak-v1";

const PRECACHE_URLS = ["/", "/app", "/manifest.webmanifest", "/logo192.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
			),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Only cache same-origin GET requests
	if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

	// Skip API calls — they need fresh data
	if (url.pathname.startsWith("/api/")) return;

	// Static assets: cache-first strategy
	if (isStaticAsset(url.pathname)) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				if (cached) return cached;
				return fetch(event.request).then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
					}
					return response;
				});
			}),
		);
		return;
	}

	// HTML navigation: stale-while-revalidate
	if (event.request.mode === "navigate") {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				const fetchPromise = fetch(event.request).then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
					}
					return response;
				});
				return cached || fetchPromise;
			}),
		);
	}
});

function isStaticAsset(pathname) {
	return /\.(js|css|png|jpg|jpeg|svg|gif|ico|woff2?|ttf|eot|webp|avif)$/i.test(pathname);
}

self.addEventListener("push", (event) => {
	if (!event.data) return;

	let payload;
	try {
		payload = event.data.json();
	} catch {
		return;
	}

	const { title, body, icon, url } = payload;

	event.waitUntil(
		self.registration.showNotification(title, {
			body: body || "",
			icon: icon || "/logo192.png",
			data: { url: url || "/app" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const url = event.notification.data?.url || "/app";

	event.waitUntil(
		clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
			for (const client of windowClients) {
				if (client.url.includes(url) && "focus" in client) {
					return client.focus();
				}
			}
			return clients.openWindow(url);
		}),
	);
});
