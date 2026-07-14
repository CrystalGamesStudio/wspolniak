// SPDX-License-Identifier: AGPL-3.0-or-later

// Web Worker kompresujący obrazy (issue #95): dekoduje plik przez `createImageBitmap`,
// rysuje na `OffscreenCanvas` i eksportuje jako WebP — wszystko poza głównym wątkiem,
// więc UI nie zamarza przy batchu HEIC. Typowo nie testowany jednostkowo (brak
// OffscreenCanvas w jsdom) — weryfikowany manualnie przez publikację batcha.
import { computeDimensions, type WorkerRequest, type WorkerResponse } from "./compress";

/**
 * Minimalny kształt globalnego scope workera, którego używamy (`onmessage` + 1-argowy
 * `postMessage`). Wskazany interfejs zamiast `DedicatedWorkerGlobalScope`, bo ten typ
 * nie jest globalnie dostępny przy `lib: [DOM]` w tej konfiguracji tsconfiga.
 */
type WorkerGlobalScope = {
	onmessage: ((this: unknown, ev: MessageEvent<WorkerRequest>) => void) | null;
	postMessage: (message: WorkerResponse) => void;
};

const scope = self as unknown as WorkerGlobalScope;

scope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
	const { id, file, maxWidth, quality } = e.data;
	try {
		const bitmap = await createImageBitmap(file);
		const { width, height } = computeDimensions(bitmap.width, bitmap.height, maxWidth);

		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext("2d");
		ctx?.drawImage(bitmap, 0, 0, width, height);
		bitmap.close();

		const blob = await canvas.convertToBlob({ type: "image/webp", quality });
		const name = file.name.replace(/\.[^.]+$/, ".webp");

		const response: WorkerResponse = {
			id,
			file: new File([blob], name, { type: "image/webp" }),
		};
		scope.postMessage(response);
	} catch (error) {
		const response: WorkerResponse = {
			id,
			error: error instanceof Error ? error.message : String(error),
		};
		scope.postMessage(response);
	}
};
