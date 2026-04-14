// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
	const [canInstall, setCanInstall] = useState(false);
	const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

	useEffect(() => {
		function onBeforeInstall(e: Event) {
			e.preventDefault();
			deferredPrompt.current = e as BeforeInstallPromptEvent;
			setCanInstall(true);
		}

		function onInstalled() {
			deferredPrompt.current = null;
			setCanInstall(false);
		}

		window.addEventListener("beforeinstallprompt", onBeforeInstall);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onBeforeInstall);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	const promptInstall = useCallback(async () => {
		if (!deferredPrompt.current) return;
		await deferredPrompt.current.prompt();
		deferredPrompt.current = null;
		setCanInstall(false);
	}, []);

	return { canInstall, promptInstall };
}
