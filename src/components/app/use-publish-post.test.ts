// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient } from "@tanstack/react-query";
import { feedQueryKey } from "@/components/app/feed-query";
import { PUBLISH_BAR_DURATION_MS, type PublishPostInput, runPublishFlow } from "./use-publish-post";

function makeQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const sampleInput: PublishPostInput = {
	description: "Cześć",
	files: [],
	mentions: [],
};

afterEach(() => {
	vi.useRealTimers();
});

describe("runPublishFlow", () => {
	it("szybki publish: create → refetch → odczekanie do pełnego paska (7s) → navigate", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		const qc = makeQueryClient();
		const refetchSpy = vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
		const navigate = vi.fn().mockResolvedValue(undefined);
		const createPostFn = vi.fn().mockResolvedValue(undefined);

		const flow = runPublishFlow({
			input: sampleInput,
			navigate,
			queryClient: qc,
			createPostFn,
			startedAt: 0,
		});

		// create + refetch resolve natychmiast (mocki); flow czeka na setTimeout(7000).
		await vi.advanceTimersByTimeAsync(PUBLISH_BAR_DURATION_MS - 1);
		expect(navigate).not.toHaveBeenCalled(); // pasek jeszcze niepełny — nie nawigujemy

		await vi.advanceTimersByTimeAsync(1);
		await flow;

		expect(refetchSpy).toHaveBeenCalledWith({ queryKey: feedQueryKey });
		expect(refetchSpy).toHaveBeenCalledBefore(navigate);
		expect(navigate).toHaveBeenCalledWith({ to: "/app" });
	});

	it("powolny publish (>czasu paska): nie czeka dodatkowo, navigate od razu (pasek już pełny)", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(PUBLISH_BAR_DURATION_MS + 1000); // "teraz" = 8s

		const qc = makeQueryClient();
		vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
		const navigate = vi.fn().mockResolvedValue(undefined);

		await runPublishFlow({
			input: sampleInput,
			navigate,
			queryClient: qc,
			createPostFn: vi.fn().mockResolvedValue(undefined),
			startedAt: 0, // start przy 0, "publish" trwał 8s → pasek pełny od 7s
		});

		expect(navigate).toHaveBeenCalledWith({ to: "/app" }); // bez dodatkowego setTimeout
	});

	it("gdy createPost odrzuca: rzuca, refetch i navigate nie wołane", async () => {
		const qc = makeQueryClient();
		const refetchSpy = vi.spyOn(qc, "refetchQueries").mockResolvedValue(undefined);
		const navigate = vi.fn();
		const createPostFn = vi.fn().mockRejectedValue(new Error("upload nie powiódł się"));

		await expect(
			runPublishFlow({
				input: sampleInput,
				navigate,
				queryClient: qc,
				createPostFn,
				startedAt: 0,
			}),
		).rejects.toThrow("upload nie powiódł się");

		expect(refetchSpy).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});
});
