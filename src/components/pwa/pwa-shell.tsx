// SPDX-License-Identifier: AGPL-3.0-or-later

import { Download, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIOSSafari, isStandalone } from "@/pwa/detect";
import { useInstallPrompt } from "@/pwa/use-install-prompt";
import { useOnlineStatus } from "@/pwa/use-online-status";
import { IOSInstallBanner } from "./ios-install-banner";
import { PushPrompt } from "./push-prompt";

export function PwaShell({ children }: { children: React.ReactNode }) {
	const online = useOnlineStatus();
	const { canInstall, promptInstall } = useInstallPrompt();
	const [iosSafari, setIOSSafari] = useState(false);
	const [standalone, setStandalone] = useState(false);

	useEffect(() => {
		setIOSSafari(isIOSSafari());
		setStandalone(isStandalone());
	}, []);

	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch((error) => {
			// biome-ignore lint/suspicious/noConsole: surface SW registration failures for PWA push diagnosis
			console.error("[pwa] SW register failed", error);
		});
	}, []);

	return (
		<>
			{children}

			{!online && (
				<div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive p-2 text-destructive-foreground">
					<WifiOff className="h-4 w-4" />
					<span className="text-sm font-medium">Brak połączenia</span>
				</div>
			)}

			{canInstall && (
				<div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-card p-3 shadow-lg">
					<span className="text-sm text-foreground">Zainstaluj aplikację Wspólniak</span>
					<Button size="sm" onClick={promptInstall}>
						<Download className="mr-1 h-3 w-3" />
						Instaluj
					</Button>
				</div>
			)}

			<IOSInstallBanner isIOSSafari={iosSafari} isStandalone={standalone} />

			<PushPrompt isStandalone={standalone} />
		</>
	);
}
