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
