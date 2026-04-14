import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/pwa/use-push-subscription";

interface PushPromptProps {
	isStandalone: boolean;
}

export function PushPrompt({ isStandalone }: PushPromptProps) {
	const { permission, isSubscribed, subscribe } = usePushSubscription();

	if (!isStandalone) return null;
	if (permission === "unsupported" || permission === "denied") return null;
	if (isSubscribed) return null;

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-card p-3 shadow-lg">
			<div className="flex items-center gap-2">
				<Bell className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm text-foreground">Włącz powiadomienia o nowych zdjęciach</span>
			</div>
			<Button size="sm" onClick={subscribe}>
				Włącz
			</Button>
		</div>
	);
}
