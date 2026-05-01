// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "@tanstack/react-router";
import { Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { FeedbackButton } from "@/components/app/feedback-button";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
	role?: string;
}

export function MobileNav({ role }: MobileNavProps) {
	return (
		<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe sm:hidden">
			<div className="flex items-center justify-around px-2 py-3">
				{role === "admin" && (
					<Link to="/app/admin" className="flex flex-col items-center gap-1.5 rounded-md p-1.5">
						<SlidersHorizontal className="h-6 w-6 text-foreground" />
						<span className="text-xs text-muted-foreground">Admin</span>
					</Link>
				)}

				<button
					type="button"
					onClick={() => window.location.reload()}
					className="flex flex-col items-center gap-1.5 rounded-md p-1.5"
					aria-label="Odśwież"
				>
					<RefreshCw className="h-6 w-6 text-foreground" />
					<span className="text-xs text-muted-foreground">Odśwież</span>
				</button>

				<Link to="/app/new" className="flex flex-col items-center gap-1.5">
					<Button size="lg" className="h-14 w-14 rounded-full px-0">
						<Plus className="h-6 w-6" />
					</Button>
					<span className="text-xs text-muted-foreground">Dodaj</span>
				</Link>

				<div className="flex flex-col items-center gap-1.5">
					<ThemeToggle size="sm" />
					<span className="text-xs text-muted-foreground">Tryb</span>
				</div>

				<div className="flex flex-col items-center gap-1.5">
					<FeedbackButton variant="ghost" size="icon" className="size-11 rounded-full" />
					<span className="text-xs text-muted-foreground">Feedback</span>
				</div>
			</div>
		</nav>
	);
}
