// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Wykrycie aktywnego @mention w tekście względem pozycji kursora (caret).
 * Aktywne = tekst między `@` a caretem, gdzie:
 * - `@` stoi na początku LUB po białym znaku (anti-email: `a@b` nie triggeruje),
 * - po `@` do caretu nie ma białego znaku (mention kończy się spacją).
 */
export interface MentionDetection {
	/** Indeks znaku `@` w oryginalnym tekście. */
	startIndex: number;
	/** Tekst między `@` a caretem (bez `@`). Może być pusty zaraz po wpisaniu `@`. */
	query: string;
}

export function detectMentionQuery(text: string, caret: number): MentionDetection | null {
	const before = text.slice(0, caret);
	const at = before.lastIndexOf("@");
	if (at === -1) return null;

	// `@` musi być na początku lub po białym znaku — inaczej to email, nie mention.
	if (at > 0 && !/\s/.test(text[at - 1])) return null;

	const query = before.slice(at + 1);
	// Spacja/enter między `@` a caretem kończy mention.
	if (/\s/.test(query)) return null;

	return { startIndex: at, query };
}

/**
 * Wstawia `@name ` w miejsce wykrytego mentionu (od `@` do końca query),
 * ustawiając kursor tuż za spacją — gotowe do dalszego pisania.
 */
export function insertMention(
	text: string,
	detection: MentionDetection,
	name: string,
): { text: string; caret: number } {
	const before = text.slice(0, detection.startIndex);
	const tail = text.slice(detection.startIndex + 1 + detection.query.length);
	const inserted = `@${name} `;
	return {
		text: `${before}${inserted}${tail}`,
		caret: before.length + inserted.length,
	};
}

export interface TextSegment {
	text: string;
	isMention: boolean;
}

/**
 * Dzieli tekst na segmenty, oznaczając `@imię` (ciąg liter/cyfr/myślników po `@`) jako mention.
 * Używane do zielonego podświetlenia `@imię` w renderowanym komentarzu i feedzie.
 * Obsługuje polskie znaki przez `\p{L}` oraz wieloczłonowe imiona z myślnikiem (np. `@Jan-Kowalski`).
 * Negative lookbehind `(?<![\p{L}\d])` blokuje emaile: `a@b` nie jest wzmianką.
 */
export function highlightMentions(text: string): TextSegment[] {
	const segments: TextSegment[] = [];
	const regex = /(?<![\p{L}\d])@[\p{L}\d-]+/gu;
	let lastIndex = 0;
	for (const match of text.matchAll(regex)) {
		if (match.index > lastIndex) {
			segments.push({ text: text.slice(lastIndex, match.index), isMention: false });
		}
		segments.push({ text: match[0], isMention: true });
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) {
		segments.push({ text: text.slice(lastIndex), isMention: false });
	}
	return segments;
}
