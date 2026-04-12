import { render, screen } from "@testing-library/react";
import { Feed } from "./feed";

describe("Feed", () => {
	it("renders posts with author name and description", () => {
		const now = new Date().toISOString();
		const posts = [
			{
				id: "post-1",
				authorId: "u1",
				description: "Wakacje nad morzem",
				createdAt: now,
				updatedAt: now,
				author: { id: "u1", name: "Tomek" },
				images: [
					{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
				],
			},
			{
				id: "post-2",
				authorId: "u2",
				description: "Urodziny babci",
				createdAt: now,
				updatedAt: now,
				author: { id: "u2", name: "Kasia" },
				images: [
					{ id: "img-2", postId: "post-2", cfImageId: "cf-bbb", displayOrder: 0, createdAt: now },
				],
			},
		];

		render(<Feed posts={posts} imageAccountHash="hash-1" />);

		expect(screen.getByText("Tomek")).toBeDefined();
		expect(screen.getByText("Wakacje nad morzem")).toBeDefined();
		expect(screen.getByText("Kasia")).toBeDefined();
		expect(screen.getByText("Urodziny babci")).toBeDefined();
	});

	it("renders empty state when no posts", () => {
		render(<Feed posts={[]} imageAccountHash="hash-1" />);

		expect(screen.getByText(/brak postów/i)).toBeDefined();
	});

	it("renders image thumbnails", () => {
		const now = new Date().toISOString();
		const posts = [
			{
				id: "post-1",
				authorId: "u1",
				description: null,
				createdAt: now,
				updatedAt: now,
				author: { id: "u1", name: "Tomek" },
				images: [
					{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
					{ id: "img-2", postId: "post-1", cfImageId: "cf-bbb", displayOrder: 1, createdAt: now },
				],
			},
		];

		render(<Feed posts={posts} imageAccountHash="hash-1" />);

		const images = screen.getAllByRole("img");
		expect(images).toHaveLength(2);
		expect(images[0]?.getAttribute("src")).toContain("cf-aaa");
		expect(images[1]?.getAttribute("src")).toContain("cf-bbb");
	});
});
