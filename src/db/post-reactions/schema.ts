// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { reactionTypes } from "./table";

export const reactionTypeEnum = z.enum(reactionTypes);

export const upsertReactionSchema = z.object({
	reactionType: reactionTypeEnum,
});

export type UpsertReactionRequest = z.infer<typeof upsertReactionSchema>;
