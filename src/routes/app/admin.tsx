// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Check, Copy, Link, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
	id: string;
	name: string;
	role: string;
	createdAt: string;
}

interface CreateMemberResponse {
	data: { user: Member; magicLink: string };
}

export const Route = createFileRoute("/app/admin")({
	beforeLoad: ({ context }) => {
		if (context.session.role !== "admin") {
			throw redirect({ to: "/app" });
		}
	},
	component: AdminPage,
});

function AdminPage() {
	const queryClient = useQueryClient();
	const [newName, setNewName] = useState("");
	const [copiedLink, setCopiedLink] = useState<string | null>(null);
	const [lastMagicLink, setLastMagicLink] = useState<{ name: string; link: string } | null>(null);

	const membersQuery = useQuery({
		queryKey: ["admin", "members"],
		queryFn: async (): Promise<Member[]> => {
			const res = await fetch("/api/admin/members");
			if (!res.ok) throw new Error("Nie udało się pobrać członków");
			const json = (await res.json()) as { data: Member[] };
			return json.data;
		},
	});

	const createMutation = useMutation({
		mutationFn: async (name: string): Promise<CreateMemberResponse> => {
			const res = await fetch("/api/admin/members", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name }),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
			return res.json() as Promise<CreateMemberResponse>;
		},
		onSuccess: async (data) => {
			setLastMagicLink({ name: data.data.user.name, link: data.data.magicLink });
			setNewName("");
			await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
			if (!res.ok) throw new Error("Nie udało się usunąć członka");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
		},
	});

	const regenerateMutation = useMutation({
		mutationFn: async ({ id, name }: { id: string; name: string }) => {
			const res = await fetch(`/api/admin/members/${id}/regenerate`, { method: "POST" });
			if (!res.ok) throw new Error("Nie udało się wygenerować nowego linku");
			const json = (await res.json()) as { data: { magicLink: string } };
			return { name, link: json.data.magicLink };
		},
		onSuccess: (data) => {
			setLastMagicLink({ name: data.name, link: data.link });
		},
	});

	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
		setCopiedLink(text);
		setTimeout(() => setCopiedLink(null), 2000);
	}

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = newName.trim();
		if (!trimmed) return;
		createMutation.reset();
		createMutation.mutate(trimmed);
	}

	return (
		<div className="mx-auto max-w-2xl bg-background px-4 py-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold text-foreground">Zarządzanie rodziną</h1>
				<a href="/app">
					<Button variant="outline" size="sm">
						Wróć
					</Button>
				</a>
			</div>

			{lastMagicLink && (
				<div className="mb-6 rounded-lg border border-border bg-card p-4">
					<p className="mb-2 text-sm font-medium text-foreground">
						Link logowania dla <strong>{lastMagicLink.name}</strong>:
					</p>
					<div className="flex items-center gap-2">
						<code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 text-xs text-foreground">
							{lastMagicLink.link}
						</code>
						<Button size="sm" variant="outline" onClick={() => copyToClipboard(lastMagicLink.link)}>
							{copiedLink === lastMagicLink.link ? (
								<Check className="h-4 w-4" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						Wyślij ten link osobie — po kliknięciu zostanie zalogowana.
					</p>
				</div>
			)}

			<form onSubmit={handleCreate} className="mb-6 flex gap-2">
				<Input
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					placeholder="Imię nowego członka..."
					className="flex-1"
				/>
				<Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
					<Plus className="mr-1 h-4 w-4" />
					{createMutation.isPending ? "Dodaję..." : "Dodaj"}
				</Button>
			</form>

			{createMutation.isError && (
				<Alert variant="destructive" className="mb-4">
					{createMutation.error.message}
				</Alert>
			)}

			{membersQuery.isLoading && <p className="text-center text-muted-foreground">Ładowanie...</p>}

			{membersQuery.data && (
				<div className="space-y-2">
					{membersQuery.data.map((member) => (
						<div
							key={member.id}
							className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
						>
							<div>
								<span className="font-medium text-foreground">{member.name}</span>
								<span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{member.role}
								</span>
							</div>
							{member.role !== "admin" && (
								<div className="flex gap-1">
									<Button
										size="sm"
										variant="ghost"
										onClick={() => regenerateMutation.mutate({ id: member.id, name: member.name })}
										disabled={regenerateMutation.isPending}
										title="Nowy link logowania"
									>
										<Link className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => deleteMutation.mutate(member.id)}
										disabled={deleteMutation.isPending}
										title="Usuń członka"
									>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
