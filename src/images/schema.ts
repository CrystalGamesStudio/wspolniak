// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

/**
 * Walidacja body dla `POST /api/app/images/upload-urls` (batch, issue #95).
 * `count` = nieujemna liczba całkowita par do pobrania (0 → pusta odpowiedź).
 */
export const batchUploadUrlSchema = z.object({
	count: z.number().int().nonnegative(),
});

export type BatchUploadUrlRequest = z.infer<typeof batchUploadUrlSchema>;
