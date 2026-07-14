// SPDX-License-Identifier: AGPL-3.0-or-later
interface DirectUploadConfig {
	accountId: string;
	apiToken: string;
}

interface DirectUploadResult {
	cfImageId: string;
	uploadURL: string;
}

export async function createDirectUploadUrl(
	config: DirectUploadConfig,
): Promise<DirectUploadResult> {
	const { accountId, apiToken } = config;

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Cloudflare Images API error: ${response.status}`);
	}

	const data = (await response.json()) as {
		result: { id: string; uploadURL: string };
	};

	return {
		cfImageId: data.result.id,
		uploadURL: data.result.uploadURL,
	};
}

/**
 * Pobiera `count` par `{cfImageId, uploadURL}` w jednym wywołaniu (równolegle).
 * Zastępuje N sekwencyjnych round-tripów przy publikacji batcha zdjęć (issue #95).
 * `count <= 0` → `[]` (nie woła CF API). Błąd dowolnej pary → odrzuca całość.
 */
export async function createDirectUploadUrlBatch(
	config: DirectUploadConfig,
	count: number,
): Promise<DirectUploadResult[]> {
	if (count <= 0) return [];
	return Promise.all(Array.from({ length: count }, () => createDirectUploadUrl(config)));
}

interface ImageUrlConfig {
	accountHash: string;
	cfImageId: string;
	variant?: string;
}

export function getImageUrl(config: ImageUrlConfig): string {
	const { accountHash, cfImageId, variant = "public" } = config;

	if (cfImageId.startsWith("placeholder-")) {
		const seed = cfImageId.replace("placeholder-", "");
		const size = variant === "thumbnail" ? "400/400" : "1200/800";
		return `https://picsum.photos/seed/${seed}/${size}`;
	}

	return `https://imagedelivery.net/${accountHash}/${cfImageId}/${variant}`;
}
