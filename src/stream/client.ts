// SPDX-License-Identifier: AGPL-3.0-or-later

interface StreamUploadConfig {
	accountId: string;
	apiToken: string;
}

interface StreamUploadResult {
	uid: string;
	uploadURL: string;
}

export async function createStreamUploadUrl(
	config: StreamUploadConfig,
): Promise<StreamUploadResult> {
	const { accountId, apiToken } = config;

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Tus-Resumable": "1.0.0",
				"Upload-Length": "0",
				"Upload-Metadata": "",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Cloudflare Stream API error: ${response.status}`);
	}

	const data = (await response.json()) as {
		result: { uid: string; uploadURL: string };
	};

	return {
		uid: data.result.uid,
		uploadURL: data.result.uploadURL,
	};
}

export function getStreamThumbnailUrl(uid: string): string {
	return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
}
