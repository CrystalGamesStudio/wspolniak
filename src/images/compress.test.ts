// SPDX-License-Identifier: AGPL-3.0-or-later
import { computeDimensions } from "./compress";

describe("computeDimensions", () => {
	it("resizes proportionally when wider than maxWidth", () => {
		expect(computeDimensions(2400, 1600, 1200)).toEqual({ width: 1200, height: 800 });
	});

	it("does not upscale when narrower than maxWidth", () => {
		expect(computeDimensions(800, 600, 1200)).toEqual({ width: 800, height: 600 });
	});

	it("leaves dimensions unchanged at exactly maxWidth", () => {
		expect(computeDimensions(1200, 1600, 1200)).toEqual({ width: 1200, height: 1600 });
	});

	it("keeps aspect ratio for non-trivial ratio", () => {
		// 3000 × 2000 → maxWidth 900 ⇒ 900 × 600
		expect(computeDimensions(3000, 2000, 900)).toEqual({ width: 900, height: 600 });
	});
});

type SentRequest = { id: number; file: File; maxWidth: number; quality: number };

/**
 * `compressImage` deleguje kompresję do Web Workera (granica systemu — mockujemy
 * globalny `Worker`). Każdy test dostaje świeży moduł (`vi.resetModules`), bo klient
 * trzyma singleton workera w stanie modułu.
 */
describe("compressImage (worker delegation)", () => {
	function mountFakeWorker() {
		const messageListeners: Array<(e: MessageEvent) => void> = [];
		const fakeWorker = {
			addEventListener: vi.fn((type: string, cb: (e: MessageEvent) => void) => {
				if (type === "message") messageListeners.push(cb);
			}),
			removeEventListener: vi.fn((type: string, cb: (e: MessageEvent) => void) => {
				if (type === "message") {
					const i = messageListeners.indexOf(cb);
					if (i >= 0) messageListeners.splice(i, 1);
				}
			}),
			postMessage: vi.fn(),
		};
		// musi być zwykła funkcja (nie arrow) — compress.ts woła `new Worker(...)`.
		const WorkerCtor = vi.fn(function (this: unknown) {
			return fakeWorker;
		});
		vi.stubGlobal("Worker", WorkerCtor);

		const dispatch = (data: unknown) => {
			const event = new MessageEvent("message", { data });
			for (const cb of [...messageListeners]) cb(event);
		};

		return { fakeWorker, WorkerCtor, dispatch };
	}

	function sentRequestAt(
		fakeWorker: { postMessage: ReturnType<typeof vi.fn> },
		i: number,
	): SentRequest {
		return fakeWorker.postMessage.mock.calls[i]?.[0] as SentRequest;
	}

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("posts {id,file,maxWidth,quality} to a worker and resolves the returned File", async () => {
		vi.resetModules();
		const { compressImage } = await import("./compress");
		const { fakeWorker, dispatch } = mountFakeWorker();

		const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
		const resultFile = new File(["y"], "a.webp", { type: "image/webp" });

		const promise = compressImage(file, { maxWidth: 800, quality: 0.5 });

		expect(fakeWorker.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ file, maxWidth: 800, quality: 0.5 }),
		);

		const sent = sentRequestAt(fakeWorker, 0);
		dispatch({ id: sent.id, file: resultFile });

		await expect(promise).resolves.toBe(resultFile);
		expect(fakeWorker.removeEventListener).toHaveBeenCalled();
	});

	it("rejects when the worker reports an error", async () => {
		vi.resetModules();
		const { compressImage } = await import("./compress");
		const { fakeWorker, dispatch } = mountFakeWorker();

		const promise = compressImage(new File(["x"], "a.jpg", { type: "image/jpeg" }));
		const sent = sentRequestAt(fakeWorker, 0);
		dispatch({ id: sent.id, error: "decode failed" });

		await expect(promise).rejects.toThrow("decode failed");
	});

	it("reuses one worker instance across multiple compressions", async () => {
		vi.resetModules();
		const { compressImage } = await import("./compress");
		const { fakeWorker, WorkerCtor, dispatch } = mountFakeWorker();

		const p1 = compressImage(new File(["a"], "1.jpg", { type: "image/jpeg" }));
		const p2 = compressImage(new File(["b"], "2.jpg", { type: "image/jpeg" }));

		dispatch({
			id: sentRequestAt(fakeWorker, 0).id,
			file: new File(["a"], "1.webp", { type: "image/webp" }),
		});
		dispatch({
			id: sentRequestAt(fakeWorker, 1).id,
			file: new File(["b"], "2.webp", { type: "image/webp" }),
		});

		await Promise.all([p1, p2]);
		expect(WorkerCtor).toHaveBeenCalledTimes(1);
	});

	it("ignores worker messages with a non-matching id", async () => {
		vi.resetModules();
		const { compressImage } = await import("./compress");
		const { fakeWorker, dispatch } = mountFakeWorker();

		const promise = compressImage(new File(["x"], "a.jpg", { type: "image/jpeg" }));
		const sent = sentRequestAt(fakeWorker, 0);

		// stranger message z złym id → ignorowany (promise jeszcze nieresolwowany)
		dispatch({ id: sent.id + 999, file: new File(["z"], "x.webp", { type: "image/webp" }) });

		const resultFile = new File(["y"], "a.webp", { type: "image/webp" });
		dispatch({ id: sent.id, file: resultFile });

		await expect(promise).resolves.toBe(resultFile);
	});

	it("sends sensible defaults when options are omitted", async () => {
		vi.resetModules();
		const { compressImage } = await import("./compress");
		const { fakeWorker, dispatch } = mountFakeWorker();

		const promise = compressImage(new File(["x"], "a.jpg", { type: "image/jpeg" }));
		const sent = sentRequestAt(fakeWorker, 0);
		expect(sent.maxWidth).toBe(1200);
		expect(sent.quality).toBe(0.7);

		dispatch({ id: sent.id, file: new File(["y"], "a.webp", { type: "image/webp" }) });
		await promise;
	});
});
