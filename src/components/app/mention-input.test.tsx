// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useState } from "react";
import { type Mention, MentionInput } from "./mention-input";

function createWrapper() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

function mockFetchUsers(data: Array<{ id: string; name: string }>) {
	return vi.fn().mockImplementation((url: string) => {
		if (url.includes("/api/app/users")) {
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
		}
		return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
	});
}

/** Rodzic trzymający stan wartości — tak jak comment-section w produkcji. */
function TestHost({
	onMentionsChange,
	currentUserId,
}: {
	onMentionsChange?: (mentions: Mention[]) => void;
	currentUserId?: string;
}) {
	const [value, setValue] = useState("");
	return (
		<MentionInput
			value={value}
			onChange={setValue}
			onMentionsChange={onMentionsChange}
			currentUserId={currentUserId}
		/>
	);
}

describe("MentionInput", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("typing @ with query opens dropdown of matching users", async () => {
		vi.stubGlobal(
			"fetch",
			mockFetchUsers([
				{ id: "u2", name: "Ania" },
				{ id: "u3", name: "Andrzej" },
			]),
		);
		const user = userEvent.setup();
		render(<TestHost />, { wrapper: createWrapper() });

		await user.type(screen.getByRole("textbox"), "Hej @An");

		expect(await screen.findByText("Ania")).toBeDefined();
		expect(screen.getByText("Andrzej")).toBeDefined();
	});

	it("clicking a user inserts @name into the field and registers the mention", async () => {
		vi.stubGlobal("fetch", mockFetchUsers([{ id: "u2", name: "Ania" }]));
		const onMentionsChange = vi.fn();
		const user = userEvent.setup();
		render(<TestHost onMentionsChange={onMentionsChange} />, { wrapper: createWrapper() });

		await user.type(screen.getByRole("textbox"), "Hej @An");
		const option = await screen.findByText("Ania");
		await user.click(option);

		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
		expect(textarea.value).toContain("@Ania");
		expect(onMentionsChange).toHaveBeenCalledWith([
			{ userId: "u2", name: "Ania" } satisfies Mention,
		]);
	});

	it("closes the dropdown on Escape", async () => {
		vi.stubGlobal("fetch", mockFetchUsers([{ id: "u2", name: "Ania" }]));
		const user = userEvent.setup();
		render(<TestHost />, { wrapper: createWrapper() });

		await user.type(screen.getByRole("textbox"), "Hej @An");
		await screen.findByText("Ania");
		await user.type(screen.getByRole("textbox"), "{Escape}");

		expect(screen.queryByText("Ania")).toBeNull();
	});

	it("closes the dropdown when the query is broken by a space", async () => {
		vi.stubGlobal("fetch", mockFetchUsers([{ id: "u2", name: "Ania" }]));
		const user = userEvent.setup();
		render(<TestHost />, { wrapper: createWrapper() });

		await user.type(screen.getByRole("textbox"), "Hej @An");
		await screen.findByText("Ania");
		await user.type(screen.getByRole("textbox"), " ");

		expect(screen.queryByText("Ania")).toBeNull();
	});

	it("excludes the current user from the dropdown (self-mention UX)", async () => {
		vi.stubGlobal(
			"fetch",
			mockFetchUsers([
				{ id: "u1", name: "Tomek" },
				{ id: "u2", name: "Ania" },
			]),
		);
		const user = userEvent.setup();
		render(<TestHost currentUserId="u1" />, { wrapper: createWrapper() });

		await user.type(screen.getByRole("textbox"), "@");
		await screen.findByText("Ania");

		expect(screen.queryByText("Tomek")).toBeNull();
	});
});
