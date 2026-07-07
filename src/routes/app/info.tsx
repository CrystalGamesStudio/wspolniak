// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { StatsSummary } from "@/db/stats";

export const Route = createFileRoute("/app/info")({
	beforeLoad: ({ context }) => {
		if (context.session.role !== "admin") {
			throw redirect({ to: "/app" });
		}
	},
	component: InfoPage,
});

function InfoPage() {
	const statsQuery = useQuery({
		queryKey: ["admin", "stats"],
		queryFn: async (): Promise<StatsSummary> => {
			const res = await fetch("/api/admin/stats");
			if (!res.ok) throw new Error("Nie udało się pobrać statystyk");
			const json = (await res.json()) as { data: StatsSummary };
			return json.data;
		},
	});

	return (
		<div className="bg-background px-4 py-6 pb-28 sm:pb-6">
			<h1 className="mb-6 text-2xl font-bold text-foreground">Statystyki</h1>

			<p className="mb-6 text-sm text-muted-foreground">
				Realne użycie Wspólniaka przez rodzinę. DAU/WAU liczą, kto w oknie napisał post lub
				komentarz (nawet jeśli treść została potem skasowana).
			</p>

			{statsQuery.isLoading && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
			{statsQuery.isError && <p className="text-sm text-destructive">{statsQuery.error.message}</p>}

			{statsQuery.data && (
				<>
					<h2 className="mb-3 text-sm font-semibold text-foreground">Aktywność</h2>
					<div className="mb-8 grid grid-cols-2 gap-3">
						<StatCard label="Aktywni dzisiaj (24h)" value={String(statsQuery.data.dau)} />
						<StatCard label="Aktywni w tygodniu (7d)" value={String(statsQuery.data.wau)} />
						<StatCard label="Zdjęcia (7d)" value={String(statsQuery.data.photosLast7Days)} />
						<PushCard
							attempts={statsQuery.data.pushDeliveryLast7Days.attempts}
							successes={statsQuery.data.pushDeliveryLast7Days.successes}
							rate={statsQuery.data.pushDeliveryLast7Days.rate}
						/>
					</div>

					<h2 className="mb-3 text-sm font-semibold text-foreground">Łącznie w serwisie</h2>
					<div className="grid grid-cols-2 gap-3">
						<StatCard label="Posty" value={String(statsQuery.data.totalPosts)} accent />
						<StatCard label="Komentarze" value={String(statsQuery.data.totalComments)} accent />
						<StatCard label="Zdjęcia" value={String(statsQuery.data.totalPhotos)} accent />
						<StatCard label="Reakcje" value={String(statsQuery.data.totalReactions)} accent />
						<StatCard label="Mentions" value={String(statsQuery.data.totalMentions)} accent />
					</div>
				</>
			)}
		</div>
	);
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
	return (
		<div
			className={`rounded-lg border bg-card p-4 ${
				accent ? "border-2 border-[#167c51]" : "border-border"
			}`}
		>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
		</div>
	);
}

function PushCard({
	attempts,
	successes,
	rate,
}: {
	attempts: number;
	successes: number;
	rate: number;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<p className="text-xs text-muted-foreground">Powiadomienia dostarczone (7d)</p>
			<p className="mt-1 text-2xl font-bold text-foreground">{Math.round(rate * 100)}%</p>
			<p className="mt-1 text-xs text-muted-foreground">
				{successes} / {attempts} prób
			</p>
		</div>
	);
}
