// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	Copy,
	Info,
	Link,
	Plus,
	Share2,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { MaintenanceDialog } from "@/components/admin/maintenance-dialog";
import { ShareCodeDialog } from "@/components/admin/share-code-dialog";
import { ThemeToggle } from "@/components/theme";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoaderIcon } from "@/components/ui/spinner";

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
	const [editingShareCode, setEditingShareCode] = useState(false);
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
	const [shareCodeInput, setShareCodeInput] = useState("");

	const configQuery = useQuery({
		queryKey: ["config"],
		queryFn: async () => {
			const res = await fetch("/api/app/config");
			if (!res.ok) throw new Error("Nie udało się pobrać konfiguracji");
			const json = (await res.json()) as { data: { appUrl: string } };
			return json.data.appUrl;
		},
	});

	const appUrl = configQuery.data ?? (typeof window !== "undefined" ? window.location.origin : "");

	const shareCodeQuery = useQuery({
		queryKey: ["admin", "share-code"],
		queryFn: async (): Promise<string | null> => {
			const res = await fetch("/api/admin/share-code");
			if (!res.ok) throw new Error("Nie udało się pobrać kodu");
			const json = (await res.json()) as { data: { code: string | null } };
			return json.data.code;
		},
	});

	const shareCodeMutation = useMutation({
		mutationFn: async (code: string) => {
			const res = await fetch("/api/admin/share-code", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code }),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
		},
		onSuccess: async () => {
			setEditingShareCode(false);
			await queryClient.invalidateQueries({ queryKey: ["admin", "share-code"] });
		},
	});

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
			setAddDialogOpen(false);
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

	const maintenanceQuery = useQuery({
		queryKey: ["admin", "maintenance"],
		queryFn: async () => {
			const res = await fetch("/api/admin/maintenance");
			if (!res.ok) throw new Error("Nie udało się pobrać konfiguracji trybu awaryjnego");
			const json = (await res.json()) as {
				data: { enabled: boolean; message: string; subtitle: string; icon: string };
			};
			return json.data;
		},
	});

	const maintenanceMutation = useMutation({
		mutationFn: async (input: {
			enabled?: boolean;
			message?: string;
			subtitle?: string;
			icon?: string;
		}) => {
			const res = await fetch("/api/admin/maintenance", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["admin", "maintenance"] });
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

	const currentShareCode = shareCodeQuery.data;

	function startEditShareCode() {
		setShareCodeInput(currentShareCode ?? "");
		setEditingShareCode(true);
	}

	return (
		<div className="max-w-2xl bg-background px-4 py-6 pb-28 sm:pb-6">
			<div className="mb-6 flex items-center gap-2">
				<a href="/app">
					<button
						type="button"
						className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						title="Wróć"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
				</a>
				<h1 className="text-2xl font-bold text-foreground">Zarządzanie</h1>
				<div className="flex-1" />
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="lg"
						onClick={() => setAddDialogOpen(true)}
						title="Dodaj członka"
					>
						<Plus className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="lg"
						onClick={() => setMaintenanceDialogOpen(true)}
						title="Tryb awaryjny"
					>
						<AlertTriangle className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="lg"
						onClick={() => setShareDialogOpen(true)}
						title="Udostępnianie"
					>
						<Share2 className="h-4 w-4" />
					</Button>
					<ThemeToggle size="lg" className="hidden sm:block" />
				</div>
			</div>

			<MaintenanceDialog
				open={maintenanceDialogOpen}
				onOpenChange={setMaintenanceDialogOpen}
				config={
					maintenanceQuery.data ?? {
						enabled: false,
						message: "Wspólniak jest w trakcie naprawy",
						subtitle: "Wróć za chwilę",
						icon: "alert-triangle",
					}
				}
				isSaving={maintenanceMutation.isPending}
				errorMessage={maintenanceMutation.isError ? maintenanceMutation.error.message : undefined}
				onSave={(input) => {
					maintenanceMutation.reset();
					maintenanceMutation.mutate(input);
				}}
			/>

			<ShareCodeDialog
				open={shareDialogOpen}
				appUrl={appUrl}
				currentShareCode={currentShareCode}
				copiedLink={copiedLink}
				editingShareCode={editingShareCode}
				shareCodeInput={shareCodeInput}
				isSaving={shareCodeMutation.isPending}
				errorMessage={shareCodeMutation.isError ? shareCodeMutation.error.message : undefined}
				onOpenChange={setShareDialogOpen}
				onClose={() => {
					setEditingShareCode(false);
					shareCodeMutation.reset();
				}}
				onCopy={copyToClipboard}
				onStartEdit={startEditShareCode}
				onCancelEdit={() => {
					setEditingShareCode(false);
					shareCodeMutation.reset();
				}}
				onShareCodeInputChange={setShareCodeInput}
				onSaveShareCode={(code) => {
					shareCodeMutation.reset();
					shareCodeMutation.mutate(code);
				}}
			/>

			<Dialog
				open={addDialogOpen}
				onOpenChange={(open) => {
					setAddDialogOpen(open);
					if (!open) {
						setNewName("");
						createMutation.reset();
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Dodaj członka</DialogTitle>
					</DialogHeader>

					{createMutation.isError && (
						<Alert variant="destructive">{createMutation.error.message}</Alert>
					)}

					<form onSubmit={handleCreate} className="flex gap-2">
						<Input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Imię nowego członka..."
							className="flex-1"
							autoFocus
						/>
						<Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
							{createMutation.isPending ? (
								<LoaderIcon loading={createMutation.isPending} />
							) : (
								<Plus className="h-4 w-4" />
							)}
							{createMutation.isPending ? "Dodaję..." : "Dodaj"}
						</Button>
					</form>
				</DialogContent>
			</Dialog>

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

			{membersQuery.data && !currentShareCode && (
				<button
					type="button"
					onClick={() => setShareDialogOpen(true)}
					className="mb-4 flex w-full items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-left text-sm text-muted-foreground hover:bg-muted"
				>
					<Info className="mt-0.5 h-4 w-4 shrink-0" />
					<span>
						<strong className="text-foreground">Udostępnianie jest wyłączone.</strong> Ustaw kod
						dostępu w sekcji <strong>Udostępnianie</strong>. Kliknij, aby otworzyć.
					</span>
				</button>
			)}

			{membersQuery.data && (
				<div className="space-y-2">
					{membersQuery.data.map((member) => (
						<MemberRow
							key={member.id}
							member={member}
							isRegenerating={regenerateMutation.isPending}
							isDeleting={deleteMutation.isPending}
							onRegenerate={() => regenerateMutation.mutate({ id: member.id, name: member.name })}
							onDelete={() => deleteMutation.mutate(member.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface MemberRowProps {
	member: Member;
	isRegenerating: boolean;
	isDeleting: boolean;
	onRegenerate: () => void;
	onDelete: () => void;
}

function MemberRow({ member, isRegenerating, isDeleting, onRegenerate, onDelete }: MemberRowProps) {
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1">
					<span className="font-medium text-foreground">{member.name}</span>
					<span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
						{member.role}
					</span>
				</div>
				<div className="flex gap-1">
					{member.role !== "admin" && (
						<>
							<Button
								size="sm"
								variant="ghost"
								onClick={onRegenerate}
								disabled={isRegenerating}
								title="Nowy link logowania"
							>
								<Link className="h-4 w-4" />
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={onDelete}
								disabled={isDeleting}
								title="Usuń członka"
							>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
