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

interface ImageUrlConfig {
	accountHash: string;
	cfImageId: string;
	variant?: string;
}

export function getImageUrl(config: ImageUrlConfig): string {
	const { accountHash, cfImageId, variant = "public" } = config;
	return `https://imagedelivery.net/${accountHash}/${cfImageId}/${variant}`;
}
