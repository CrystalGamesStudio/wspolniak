// SPDX-License-Identifier: AGPL-3.0-or-later
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoaderIcon, Spinner } from "./spinner";

describe("Spinner", () => {
	it("shows when loading is true", () => {
		const { container } = render(<Spinner loading={true} />);
		expect(container.firstChild).not.toBeNull();
	});

	it("hides immediately when loading is false", () => {
		const { container } = render(<Spinner loading={false} />);
		expect(container.firstChild).toBeNull();
	});

	it("hides immediately when loading transitions from true to false", () => {
		vi.useFakeTimers();
		const { container, rerender } = render(<Spinner loading={true} />);
		expect(container.firstChild).not.toBeNull();

		rerender(<Spinner loading={false} />);

		// Should hide without needing to advance timers
		expect(container.firstChild).toBeNull();
		vi.useRealTimers();
	});
});

describe("LoaderIcon", () => {
	it("shows when loading is true", () => {
		const { container } = render(<LoaderIcon loading={true} />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("hides immediately when loading is false", () => {
		const { container } = render(<LoaderIcon loading={false} />);
		expect(container.querySelector(".animate-spin")).toBeNull();
	});

	it("hides immediately when loading transitions from true to false", () => {
		vi.useFakeTimers();
		const { container, rerender } = render(<LoaderIcon loading={true} />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();

		rerender(<LoaderIcon loading={false} />);

		expect(container.querySelector(".animate-spin")).toBeNull();
		vi.useRealTimers();
	});
});
