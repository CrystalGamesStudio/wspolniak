// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

/**
 * Pojedyncza @mention wybrana z dropdown. userId pochodzi z kliknięcia (NIE z
 * parsowania imienia) — jedyne wiarygodne źródło powiadomienia. name jest
 * zapamiętywane po stronie klienta tylko do wstawienia `@imię` w tekst.
 * Współdzielone przez komentarze, odpowiedzi i opisy postów.
 */
export const mentionSchema = z.object({
	userId: z.string().min(1, "userId jest wymagane"),
	name: z.string().min(1, "name jest wymagane"),
});

export type Mention = z.infer<typeof mentionSchema>;
