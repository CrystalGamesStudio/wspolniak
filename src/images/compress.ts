// SPDX-License-Identifier: AGPL-3.0-or-later

export type CompressOptions = {
	maxWidth?: number;
	quality?: number;
};

/**
 * Czysta geometria skalowania: jeżeli obraz jest szerszy niż `maxWidth`, skaluje
 * proporcjonalnie; nigdy nie upscaluje. Współdzielona przez klienta (testy) i workera.
 */
export function computeDimensions(
	width: number,
	height: number,
	maxWidth: number,
): { width: number; height: number } {
	if (width > maxWidth) {
		return { width: maxWidth, height: Math.round(height * (maxWidth / width)) };
	}
	return { width, height };
}

/** Żądanie kompresji wysyłane do workera. */
export type WorkerRequest = {
	id: number;
	file: File;
	maxWidth: number;
	quality: number;
};

/** Odpowiedź workera: sukces (`file`) lub błąd (`error`), zawsze z pasującym `id`. */
export type WorkerResponse = {
	id: number;
	file?: File;
	error?: string;
};

// Singleton workera — tworzony leniwie przy pierwszym użyciu (poza głównym wątkiem SSR).
let worker: Worker | null = null;
let nextRequestId = 0;

function getWorker(): Worker {
	if (!worker) {
		worker = new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" });
	}
	return worker;
}

/**
 * Kompresja obrazu poza głównym wątkiem (issue #95). Ten sam interfejs co wcześniej
 * (`File → webp File`), ale praca idzie w Web Workerze (OffscreenCanvas), więc UI nie
 * zamarza przy batchu HEIC. Wiadomości matchowane po `id`; jeden worker reuse'owany.
 */
export async function compressImage(file: File, options?: CompressOptions): Promise<File> {
	const { maxWidth = 1200, quality = 0.7 } = options ?? {};
	const id = nextRequestId++;
	const w = getWorker();

	return new Promise<File>((resolve, reject) => {
		const onMessage = (e: MessageEvent) => {
			const msg = e.data as WorkerResponse;
			if (msg.id !== id) return; // nie nasza odpowiedź (np. inny równoległy plik)
			w.removeEventListener("message", onMessage);
			if (msg.error) reject(new Error(msg.error));
			else resolve(msg.file as File);
		};
		w.addEventListener("message", onMessage);
		const request: WorkerRequest = { id, file, maxWidth, quality };
		w.postMessage(request);
	});
}
