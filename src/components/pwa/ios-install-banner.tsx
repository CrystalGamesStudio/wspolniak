// SPDX-License-Identifier: AGPL-3.0-or-later
import { Plus, Share, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ios-install-banner-dismissed";

interface IOSInstallBannerProps {
	isIOSSafari: boolean;
	isStandalone: boolean;
}

export function IOSInstallBanner({ isIOSSafari, isStandalone }: IOSInstallBannerProps) {
	const [dismissed, setDismissed] = useState(
		() => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true",
	);

	if (!isIOSSafari || isStandalone || dismissed) return null;

	function handleDismiss() {
		localStorage.setItem(STORAGE_KEY, "true");
		setDismissed(true);
	}

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-lg">
			<div className="mx-auto flex max-w-md items-start gap-3">
				<div className="flex-1 space-y-2">
					<p className="font-semibold text-foreground">Dodaj do ekranu głównego</p>
					<p className="text-sm text-muted-foreground">
						Aby zainstalować aplikację, naciśnij ikonę{" "}
						<Share className="inline-block h-4 w-4" aria-hidden="true" /> Udostępnij, a następnie
						wybierz <Plus className="inline-block h-4 w-4" aria-hidden="true" /> Dodaj do ekranu
						głównego.
					</p>
				</div>
				<Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Zamknij">
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
