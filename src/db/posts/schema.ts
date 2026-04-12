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
