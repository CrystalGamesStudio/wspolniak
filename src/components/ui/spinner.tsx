// SPDX-License-Identifier: AGPL-3.0-or-later
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_MIN_MS = 1500;

/** Shows while `loading` is true, then stays visible for at least `minMs` total */
export function useMinDisplay(loading: boolean, minMs: number = DEFAULT_MIN_MS): boolean {
	const [visible, setVisible] = useState(false);
	const startRef = useRef(0);

	useEffect(() => {
		if (loading) {
			setVisible(true);
			if (startRef.current === 0) startRef.current = Date.now();
			return;
		}

		if (startRef.current === 0) return;

		const elapsed = Date.now() - startRef.current;
		const remaining = Math.max(0, minMs - elapsed);

		const timer = setTimeout(() => {
			setVisible(false);
			startRef.current = 0;
		}, remaining);

		return () => clearTimeout(timer);
	}, [loading, minMs]);

	return visible;
}

interface SpinnerProps {
	loading?: boolean;
	size?: number;
	minMs?: number;
	className?: string;
}

export function Spinner({
	loading = true,
	size = 8,
	minMs = DEFAULT_MIN_MS,
	className,
}: SpinnerProps) {
	const visible = useMinDisplay(loading, minMs);
	if (!visible) return null;
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
	minMs?: number;
	className?: string;
}

export function LoaderIcon({ loading = true, minMs = DEFAULT_MIN_MS, className }: LoaderIconProps) {
	const visible = useMinDisplay(loading, minMs);
	if (!visible) return null;
	return <LoaderCircle className={cn("animate-spin", className)} />;
}
