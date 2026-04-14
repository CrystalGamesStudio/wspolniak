// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Feed } from "./feed";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

const defaultProps = {
	imageAccountHash: "hash-1",
	currentUserId: "u1",
	currentUserRole: "member",
};

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

		render(<Feed posts={posts} {...defaultProps} />, { wrapper: createWrapper() });

		expect(screen.getByText("Tomek")).toBeDefined();
		expect(screen.getByText("Wakacje nad morzem")).toBeDefined();
		expect(screen.getByText("Kasia")).toBeDefined();
		expect(screen.getByText("Urodziny babci")).toBeDefined();
	});

	it("renders empty state when no posts", () => {
		render(<Feed posts={[]} {...defaultProps} />, { wrapper: createWrapper() });

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

		render(<Feed posts={posts} {...defaultProps} />, { wrapper: createWrapper() });

		const images = screen.getAllByRole("img");
		expect(images).toHaveLength(2);
		expect(images[0]?.getAttribute("src")).toContain("cf-aaa");
		expect(images[1]?.getAttribute("src")).toContain("cf-bbb");
	});

	it("shows 'koniec' message when hasNextPage is false and posts exist", () => {
		const now = new Date().toISOString();
		const posts = [
			{
				id: "post-1",
				authorId: "u1",
				description: "Test",
				createdAt: now,
				updatedAt: now,
				author: { id: "u1", name: "Tomek" },
				images: [
					{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
				],
			},
		];

		render(<Feed posts={posts} {...defaultProps} hasNextPage={false} />, {
			wrapper: createWrapper(),
		});

		expect(screen.getByText(/koniec/i)).toBeDefined();
	});

	it("does not show 'koniec' when there are more pages", () => {
		const now = new Date().toISOString();
		const posts = [
			{
				id: "post-1",
				authorId: "u1",
				description: "Test",
				createdAt: now,
				updatedAt: now,
				author: { id: "u1", name: "Tomek" },
				images: [
					{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
				],
			},
		];

		render(<Feed posts={posts} {...defaultProps} hasNextPage={true} />, {
			wrapper: createWrapper(),
		});

		expect(screen.queryByText(/koniec/i)).toBeNull();
	});

	it("shows loading indicator when fetching next page", () => {
		const now = new Date().toISOString();
		const posts = [
			{
				id: "post-1",
				authorId: "u1",
				description: "Test",
				createdAt: now,
				updatedAt: now,
				author: { id: "u1", name: "Tomek" },
				images: [
					{ id: "img-1", postId: "post-1", cfImageId: "cf-aaa", displayOrder: 0, createdAt: now },
				],
			},
		];

		render(<Feed posts={posts} {...defaultProps} hasNextPage={true} isFetchingNextPage={true} />, {
			wrapper: createWrapper(),
		});

		expect(screen.getByText(/ładowanie/i)).toBeDefined();
	});
});
