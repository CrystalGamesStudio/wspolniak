// SPDX-License-Identifier: AGPL-3.0-or-later

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { feedQueryKey } from "@/components/app/feed-query";
import type { Mention } from "@/components/app/mention-input";
import { compressImage } from "@/images/compress";

/** Wejście publikacji posta (tekst + pliki + wzmianki). */
export interface PublishPostInput {
	description: string | null;
	files: File[];
	mentions: Mention[];
}

/**
 * Czas wypełniania paska postępu (ms). MUSI zgadzać się z animacją `7s` klasy
 * `animate-[publish-indeterminate_7s_ease-out_forwards]` w `new-post-form.tsx`.
 * Pasek ma dojść do 100% zanim nawigujemy do feedu.
 */
export const PUBLISH_BAR_DURATION_MS = 7000;

export interface RunPublishFlowOptions {
	input: PublishPostInput;
	navigate: (opts: { to: string }) => Promise<void> | void;
	queryClient: QueryClient;
	/** Moment startu (Date.now(), ms) — do obliczenia ile brakuje do pełnego paska. */
	startedAt: number;
	/** Jedyna granica sieci — mockowana w testach, realna w hooku usePublishPost. */
	createPostFn?: (input: PublishPostInput) => Promise<unknown>;
}

/**
 * Pełny lifecycle publikacji (deep module, testowalny bez Reacta):
 * 1. `createPost` (upload zdjęć + create) — jedyna granica sieci.
 * 2. `refetchQueries` feedu — post musi być w cache, żeby po nawigacji był widoczny od razu.
 * 3. odczekanie do pełnego wypełnienia paska (`PUBLISH_BAR_DURATION_MS` od `startedAt`).
 * 4. `navigate` do `/app`.
 *
 * Błąd na którymokolwiek kroku → rzucany (formularz zostaje z tekstem/zdjęciami, error → Alert).
 */
export async function runPublishFlow(options: RunPublishFlowOptions): Promise<void> {
	const create = options.createPostFn ?? createPost;
	await create(options.input);
	await options.queryClient.refetchQueries({ queryKey: feedQueryKey });
	const remaining = PUBLISH_BAR_DURATION_MS - (Date.now() - options.startedAt);
	if (remaining > 0) {
		await new Promise((resolve) => setTimeout(resolve, remaining));
	}
	await options.navigate({ to: "/app" });
}

async function uploadFile(file: File): Promise<string> {
	const urlRes = await fetch("/api/app/images/upload-url", { method: "POST" });
	if (!urlRes.ok) throw new Error("Nie udało się uzyskać URL do uploadu");
	const { data } = (await urlRes.json()) as { data: { cfImageId: string; uploadURL: string } };

	const compressed = await compressImage(file);
	const form = new FormData();
	form.append("file", compressed);
	const uploadRes = await fetch(data.uploadURL, { method: "POST", body: form });
	if (!uploadRes.ok) throw new Error(`Upload nie powiódł się dla: ${file.name}`);

	return data.cfImageId;
}

/** Realna funkcja create (granica sieci): kompresuje, uploaduje zdjęcia i tworzy post. */
export async function createPost(input: PublishPostInput): Promise<unknown> {
	const cfImageIds = await Promise.all(input.files.map(uploadFile));

	const res = await fetch("/api/app/posts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			description: input.description || null,
			cfImageIds,
			mentions: input.mentions,
		}),
	});

	if (res.status === 429) {
		throw new Error("Osiągnięto dzienny limit postów (50)");
	}
	if (!res.ok) {
		throw new Error("Nie udało się utworzyć posta");
	}

	return res.json();
}

export interface UsePublishPostResult {
	publish: (input: PublishPostInput) => Promise<void>;
	isPending: boolean;
	isError: boolean;
	error: Error | null;
	reset: () => void;
}

/**
 * Hook (deep module) właściciel publishowania. `isPending` zostaje true przez CAŁY flow
 * (create → refetch → odczekanie paska → navigate), więc pasek jest widoczny aż do pełna
 * i znika dopiero przy nawigacji. Przy błędzie `isPending=false`, `error` ustawione.
 */
export function usePublishPost(): UsePublishPostResult {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const publish = useCallback(
		async (input: PublishPostInput) => {
			setError(null);
			setIsPending(true);
			try {
				await runPublishFlow({
					input,
					navigate,
					queryClient,
					startedAt: Date.now(),
				});
				// sukces: navigate odpaliło się w runPublishFlow, komponent się odmontuje.
				// Celowo nie zerujemy isPending — pasek ma być pełny aż do samej nawigacji.
			} catch (e) {
				setError(e instanceof Error ? e : new Error(String(e)));
				setIsPending(false);
			}
		},
		[navigate, queryClient],
	);

	return {
		publish,
		isPending,
		isError: error !== null,
		error,
		reset: () => {
			setError(null);
			setIsPending(false);
		},
	};
}
