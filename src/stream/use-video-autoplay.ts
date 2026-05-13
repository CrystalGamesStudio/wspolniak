// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from "react";

export interface VideoAutoplayResult {
	canAutoplay: boolean;
	effectiveType: string | null;
}

// Network Information API types (missing in lib.dom.d.ts)
interface NetworkConnection {
	effectiveType: string;
	addEventListener: (type: string, listener: () => void) => void;
	removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithConnection extends Navigator {
	connection?: NetworkConnection;
}

export function useVideoAutoplay(): VideoAutoplayResult {
	const [canAutoplay, setCanAutoplay] = useState(false);
	const [effectiveType, setEffectiveType] = useState<string | null>(null);

	useEffect(() => {
		const nav = window.navigator as NavigatorWithConnection;
		const connection = nav.connection;

		// Network Information API unavailable → no autoplay
		if (!connection) {
			setCanAutoplay(false);
			setEffectiveType(null);
			return;
		}

		// Check for prefers-reduced-motion
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReducedMotion) {
			setCanAutoplay(false);
			setEffectiveType(connection.effectiveType || null);
			return;
		}

		// Autoplay only on 4g
		const canPlay = connection.effectiveType === "4g";
		setCanAutoplay(canPlay);
		setEffectiveType(connection.effectiveType);

		// Listen for network changes
		const handleNetworkChange = () => {
			const newCanPlay = connection.effectiveType === "4g";
			setCanAutoplay(newCanPlay);
			setEffectiveType(connection.effectiveType);
		};

		connection.addEventListener("change", handleNetworkChange);

		return () => {
			connection.removeEventListener("change", handleNetworkChange);
		};
	}, []);

	return { canAutoplay, effectiveType };
}
