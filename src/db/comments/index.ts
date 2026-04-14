// SPDX-License-Identifier: AGPL-3.0-or-later
export type { Comment, CommentWithAuthor } from "./queries";
export {
	countCommentsByPosts,
	createComment,
	getCommentById,
	listCommentsByPost,
	softDeleteComment,
	updateCommentBody,
} from "./queries";
export { comments } from "./table";
