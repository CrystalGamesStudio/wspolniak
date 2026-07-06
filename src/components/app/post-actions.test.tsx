// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { vi } from "vitest";

// PostActions calls useNavigate (TanStack Router); stub it so we can render without a RouterProvider.
vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-router")>();
	return { ...actual, useNavigate: () => () => {} };
});

import { PostActions } from "./post-actions";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

// Radix DropdownMenu needs PointerEvent + pointer-capture APIs, which jsdom lacks.
beforeEach(() => {
	window.PointerEvent = window.MouseEvent as never;
	Element.prototype.hasPointerCapture = () => false;
	Element.prototype.setPointerCapture = () => {};
	Element.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
	cleanup();
});

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "Opcje posta" }));
}

describe("PostActions pin menu", () => {
	it("shows 'Przypnij post' for admin", async () => {
		const user = userEvent.setup();
		render(<PostActions postId="post-1" description={null} isAdmin pinned={false} />, {
			wrapper: createWrapper(),
		});
		await openMenu(user);

		expect(screen.getByText("Przypnij post")).toBeDefined();
	});

	it("does not show pin action for non-admin", async () => {
		const user = userEvent.setup();
		render(<PostActions postId="post-1" description={null} isAdmin={false} pinned={false} />, {
			wrapper: createWrapper(),
		});
		await openMenu(user);

		expect(screen.queryByText("Przypnij post")).toBeNull();
		expect(screen.queryByText("Odepnij post")).toBeNull();
	});

	it("shows 'Odepnij post' when already pinned", async () => {
		const user = userEvent.setup();
		render(<PostActions postId="post-1" description={null} isAdmin pinned={true} />, {
			wrapper: createWrapper(),
		});
		await openMenu(user);

		expect(screen.getByText("Odepnij post")).toBeDefined();
	});
});
