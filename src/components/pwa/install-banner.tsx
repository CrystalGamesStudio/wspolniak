// SPDX-License-Identifier: AGPL-3.0-or-later
import { Download, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "install-banner-dismissed";

interface InstallBannerProps {
	canInstall: boolean;
	promptInstall: () => void;
}

export function InstallBanner({ canInstall, promptInstall }: InstallBannerProps) {
	const [dismissed, setDismissed] = useState(
		() => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true",
	);

	if (!canInstall || dismissed) return null;

	function handleDismiss() {
		localStorage.setItem(STORAGE_KEY, "true");
		setDismissed(true);
	}

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-2 border-t border-border bg-card p-3 shadow-lg">
			<span className="text-sm text-foreground">Zainstaluj aplikację Wspólniak</span>
			<div className="flex items-center gap-1">
				<Button size="sm" onClick={promptInstall}>
					<Download className="mr-1 h-3 w-3" />
					Instaluj
				</Button>
				<Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Zamknij">
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
