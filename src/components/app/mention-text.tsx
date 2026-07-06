// SPDX-License-Identifier: AGPL-3.0-or-later
import { highlightMentions } from "./mentions-text";

/**
 * Renderuje tekst z `@imię` podświetlonym kolorem marki (zielonym).
 * Współdzielone przez komentarze i opisy postów.
 */
export function MentionText({ text, className }: { text: string; className?: string }) {
	return (
		<p className={className}>
			{highlightMentions(text).map((segment, index) =>
				segment.isMention ? (
					<span key={`m-${segment.text}-${index}`} className="font-medium text-primary">
						{segment.text}
					</span>
				) : (
					<span key={`t-${segment.text}-${index}`}>{segment.text}</span>
				),
			)}
		</p>
	);
}
