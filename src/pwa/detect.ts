/**
 * Detects iOS Safari (not Chrome/Firefox/etc. on iOS).
 * Accepts optional UA string for testability; defaults to navigator.userAgent.
 */
export function isIOSSafari(ua?: string): boolean {
	const userAgent = ua ?? navigator.userAgent;
	const isIOS = /iPhone|iPad|iPod/.test(userAgent);
	const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|OPiOS/.test(userAgent);
	return isIOS && isSafari;
}

/**
 * Detects standalone display mode (installed PWA).
 * Accepts optional matchMedia for testability.
 */
export function isStandalone(
	matchMediaFn?: (query: string) => Pick<MediaQueryList, "matches">,
): boolean {
	const mql = matchMediaFn ?? window.matchMedia;
	return mql("(display-mode: standalone)").matches;
}
