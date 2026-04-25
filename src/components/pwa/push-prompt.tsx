// SPDX-License-Identifier: AGPL-3.0-or-later
import { Bell, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/pwa/use-push-subscription";

const STORAGE_KEY = "push-prompt-dismissed";

interface PushPromptProps {
	isStandalone: boolean;
}

export function PushPrompt({ isStandalone }: PushPromptProps) {
	const { permission, isSubscribed, subscribe } = usePushSubscription();
	const [dismissed, setDismissed] = useState(
		() => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true",
	);

	if (!isStandalone) return null;
	if (permission === "unsupported" || permission === "denied") return null;
	if (isSubscribed) return null;
	if (dismissed) return null;

	function handleDismiss() {
		localStorage.setItem(STORAGE_KEY, "true");
		setDismissed(true);
	}

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-2 border-t border-border bg-card p-3 shadow-lg">
			<div className="flex items-center gap-2">
				<Bell className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm text-foreground">Włącz powiadomienia o nowych zdjęciach</span>
			</div>
			<div className="flex items-center gap-1">
				<Button size="sm" onClick={subscribe}>
					Włącz
				</Button>
				<Button variant="ghost" size="icon" onClick={handleDismiss} aria-label="Zamknij">
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
