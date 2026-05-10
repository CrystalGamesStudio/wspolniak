// SPDX-License-Identifier: AGPL-3.0-or-later
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
	loading?: boolean;
	size?: number;
	className?: string;
}

export function Spinner({ loading = true, size = 8, className }: SpinnerProps) {
	if (!loading) return null;
	return (
		<div
			className={cn(
				"animate-spin rounded-full border-2 border-muted-foreground border-t-transparent",
				className,
			)}
			style={{ width: size * 4, height: size * 4 }}
		/>
	);
}

interface LoaderIconProps {
	loading?: boolean;
	className?: string;
}

export function LoaderIcon({ loading = true, className }: LoaderIconProps) {
	if (!loading) return null;
	return <LoaderCircle className={cn("animate-spin", className)} />;
}
