// SPDX-License-Identifier: AGPL-3.0-or-later
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { shouldRetry } from "@/lib/network";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: (failureCount, error) => shouldRetry(error, failureCount + 1),
			},
		},
	});
	return {
		queryClient,
	};
}

export function Provider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
