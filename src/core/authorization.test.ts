import { type Actor, canDeletePost, canEditPost, type PostTarget } from "./authorization";

function actor(overrides: Partial<Actor> = {}): Actor {
	return { userId: "u1", role: "member", ...overrides };
}

function post(overrides: Partial<PostTarget> = {}): PostTarget {
	return { authorId: "u1", ...overrides };
}

describe("canEditPost", () => {
	it("allows author to edit their own post", () => {
		expect(canEditPost(actor({ userId: "u1" }), post({ authorId: "u1" }))).toBe(true);
	});

	it("allows admin to edit any post", () => {
		expect(canEditPost(actor({ userId: "u2", role: "admin" }), post({ authorId: "u1" }))).toBe(
			true,
		);
	});

	it("denies non-author member", () => {
		expect(canEditPost(actor({ userId: "u2", role: "member" }), post({ authorId: "u1" }))).toBe(
			false,
		);
	});
});

describe("canDeletePost", () => {
	it("allows author to delete their own post", () => {
		expect(canDeletePost(actor({ userId: "u1" }), post({ authorId: "u1" }))).toBe(true);
	});

	it("allows admin to delete any post", () => {
		expect(canDeletePost(actor({ userId: "u2", role: "admin" }), post({ authorId: "u1" }))).toBe(
			true,
		);
	});

	it("denies non-author member", () => {
		expect(canDeletePost(actor({ userId: "u2", role: "member" }), post({ authorId: "u1" }))).toBe(
			false,
		);
	});
});
