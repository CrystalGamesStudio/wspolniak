// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const createCalendarEventSchema = z.object({
	title: z.string().trim().min(1, "Tytuł jest wymagany"),
	description: z
		.string()
		.max(2000)
		.nullish()
		.transform((v) => (v?.trim() ? v.trim() : null)),
	day: z.number().int().min(1).max(31),
	month: z.number().int().min(1).max(12),
});

export type CreateCalendarEventRequest = z.infer<typeof createCalendarEventSchema>;
