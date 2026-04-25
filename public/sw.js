// Service worker for Wspólniak — handles web push notifications.
// Registered manually from src/components/pwa/pwa-shell.tsx.

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

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
