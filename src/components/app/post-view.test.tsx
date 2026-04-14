// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { PostView } from "./post-view";

describe("PostView", () => {
	it("renders post with author, description, and images", () => {
		const now = new Date().toISOString();
		const post = {
			id: "post-1",
			authorId: "u1",
			description: "Wakacje nad morzem",
			createdAt: now,
			updatedAt: now,
			author: { id: "u1", name: "Tomek" },
			images: [
				{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
				{ id: "img-2", postId: "post-1", cfImageId: "cf-bbb", displayOrder: 1, createdAt: now },
			],
		};

		render(<PostView post={post} imageAccountHash="hash-1" />);

		expect(screen.getByText("Tomek")).toBeDefined();
		expect(screen.getByText("Wakacje nad morzem")).toBeDefined();
		const images = screen.getAllByRole("img");
		expect(images).toHaveLength(2);
	});

	it("renders post without description", () => {
		const now = new Date().toISOString();
		const post = {
			id: "post-1",
			authorId: "u1",
			description: null,
			createdAt: now,
			updatedAt: now,
			author: { id: "u1", name: "Kasia" },
			images: [
				{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
			],
		};

		render(<PostView post={post} imageAccountHash="hash-1" />);

		expect(screen.getByText("Kasia")).toBeDefined();
		expect(screen.getAllByRole("img")).toHaveLength(1);
	});
});
