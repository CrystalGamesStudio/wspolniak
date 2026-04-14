import { Download, RefreshCw, WifiOff } from "lucide-react";
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
	const [needRefresh, setNeedRefresh] = useState(false);
	const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

	useEffect(() => {
		setIOSSafari(isIOSSafari());
		setStandalone(isStandalone());
	}, []);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		navigator.serviceWorker.ready.then((registration) => {
			setSwRegistration(registration);

			registration.addEventListener("updatefound", () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener("statechange", () => {
					if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
						setNeedRefresh(true);
					}
				});
			});
		});
	}, []);

	function handleUpdate() {
		swRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
		window.location.reload();
	}

	return (
		<>
			{children}

			{!online && (
				<div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive p-2 text-destructive-foreground">
					<WifiOff className="h-4 w-4" />
					<span className="text-sm font-medium">Brak połączenia</span>
				</div>
			)}

			{needRefresh && (
				<div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-card p-3 shadow-lg">
					<span className="text-sm text-foreground">Dostępna nowa wersja aplikacji</span>
					<Button size="sm" onClick={handleUpdate}>
						<RefreshCw className="mr-1 h-3 w-3" />
						Odśwież
					</Button>
				</div>
			)}

			{canInstall && !needRefresh && (
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
