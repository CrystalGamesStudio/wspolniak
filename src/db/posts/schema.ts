// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const createPostSchema = z.object({
	description: z
		.string()
		.max(2000)
		.nullish()
		.transform((v) => v ?? null),
	cfImageIds: z.array(z.string().min(1)).min(1).max(10),
});

export type CreatePostRequest = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
	description: z
		.string()
		.max(2000)
		.nullish()
		.transform((v) => v ?? null),
});

export type UpdatePostRequest = z.infer<typeof updatePostSchema>;
