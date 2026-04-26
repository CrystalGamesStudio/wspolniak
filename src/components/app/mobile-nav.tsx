// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "@tanstack/react-router";
import { Plus, RefreshCw, Users } from "lucide-react";
import { FeedbackButton } from "@/components/app/feedback-button";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

interface MobileNavProps {
	role?: string;
}

export function MobileNav({ role }: MobileNavProps) {
	return (
		<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe sm:hidden">
			<div className="flex items-center justify-around px-2 py-2">
				{role === "admin" && (
					<Link to="/app/admin" className="flex flex-col items-center gap-1">
						<Users className="h-5 w-5 text-foreground" />
						<span className="text-[10px] text-muted-foreground">Rodzina</span>
					</Link>
				)}

				<button
					type="button"
					onClick={() => window.location.reload()}
					className="flex flex-col items-center gap-1"
					aria-label="Odśwież"
				>
					<RefreshCw className="h-5 w-5 text-foreground" />
					<span className="text-[10px] text-muted-foreground">Odśwież</span>
				</button>

				<Link to="/app/new" className="flex flex-col items-center gap-1">
					<Button size="lg" className="h-12 w-12 rounded-full px-0">
						<Plus className="h-7 w-7" />
					</Button>
					<span className="text-[10px] text-muted-foreground">Dodaj</span>
				</Link>

				<div className="flex flex-col items-center gap-1">
					<ThemeToggle size="sm" />
					<span className="text-[10px] text-muted-foreground">Tryb</span>
				</div>

				<div className="flex flex-col items-center gap-1">
					<FeedbackButton variant="ghost" size="icon" className="size-10 rounded-full" />
					<span className="text-[10px] text-muted-foreground">Feedback</span>
				</div>
			</div>
		</nav>
	);
}
