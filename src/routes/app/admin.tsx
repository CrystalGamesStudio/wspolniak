// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Check, Copy, Info, Link, Pencil, Plus, QrCode, Share2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { QrCodeDialog } from "@/components/admin/qr-code-dialog";
import { ThemeToggle } from "@/components/theme";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
	const [editingShareCode, setEditingShareCode] = useState(false);
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [shareCodeInput, setShareCodeInput] = useState("");
	const [qrTarget, setQrTarget] = useState<Member | null>(null);

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

	const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share` : "";
	const currentShareCode = shareCodeQuery.data;

	const qrUrl =
		qrTarget && currentShareCode && typeof window !== "undefined"
			? `${window.location.origin}/share?code=${encodeURIComponent(currentShareCode)}&member=${encodeURIComponent(qrTarget.id)}`
			: "";

	function startEditShareCode() {
		setShareCodeInput(currentShareCode ?? "");
		setEditingShareCode(true);
	}

	function handleSaveShareCode(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = shareCodeInput.trim();
		if (!trimmed) return;
		shareCodeMutation.reset();
		shareCodeMutation.mutate(trimmed);
	}

	return (
		<div className="mx-auto max-w-2xl bg-background px-4 py-6 pb-20 sm:pb-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold text-foreground">Zarządzanie rodziną</h1>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						className="h-12 w-12"
						onClick={() => setAddDialogOpen(true)}
						title="Dodaj członka"
					>
						<Plus className="h-7 w-7" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="h-12 w-12"
						onClick={() => setShareDialogOpen(true)}
						title="Udostępnianie"
					>
						<Share2 className="h-7 w-7" />
					</Button>
					<ThemeToggle size="lg" />
					<a href="/app">
						<Button variant="outline" size="lg">
							Wróć
						</Button>
					</a>
				</div>
			</div>

			<Dialog
				open={shareDialogOpen}
				onOpenChange={(open) => {
					setShareDialogOpen(open);
					if (!open) {
						setEditingShareCode(false);
						shareCodeMutation.reset();
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Kod dostępu /share</DialogTitle>
					</DialogHeader>

					{shareCodeMutation.isError && (
						<Alert variant="destructive">{shareCodeMutation.error.message}</Alert>
					)}

					{editingShareCode ? (
						<form onSubmit={handleSaveShareCode} className="flex gap-2">
							<Input
								value={shareCodeInput}
								onChange={(e) => setShareCodeInput(e.target.value)}
								placeholder="np. 7843"
								className="flex-1"
								maxLength={20}
								autoFocus
							/>
							<Button
								type="submit"
								size="sm"
								disabled={!shareCodeInput.trim() || shareCodeMutation.isPending}
							>
								{shareCodeMutation.isPending ? "Zapisuję..." : "Zapisz"}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => {
									setEditingShareCode(false);
									shareCodeMutation.reset();
								}}
							>
								<X className="h-4 w-4" />
							</Button>
						</form>
					) : (
						<>
							<div className="flex items-center gap-2">
								<code className="rounded bg-muted px-2 py-1 text-sm font-bold text-foreground">
									{currentShareCode ?? "Brak"}
								</code>
								{currentShareCode && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => copyToClipboard(currentShareCode)}
										title="Kopiuj kod"
									>
										{copiedLink === currentShareCode ? (
											<Check className="h-4 w-4" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								)}
								<Button size="sm" variant="ghost" onClick={startEditShareCode} title="Zmień kod">
									<Pencil className="h-4 w-4" />
								</Button>
							</div>
							{currentShareCode && (
								<div className="flex items-center gap-2">
									<code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
										{shareUrl}
									</code>
									<Button
										size="sm"
										variant="outline"
										onClick={() => copyToClipboard(shareUrl)}
										title="Kopiuj link"
									>
										{copiedLink === shareUrl ? (
											<Check className="h-4 w-4" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								</div>
							)}
						</>
					)}
				</DialogContent>
			</Dialog>

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
							<Plus className="mr-1 h-4 w-4" />
							{createMutation.isPending ? "Dodaję..." : "Dodaj"}
						</Button>
					</form>
				</DialogContent>
			</Dialog>

			{qrTarget && (
				<QrCodeDialog
					open={true}
					onOpenChange={(open) => {
						if (!open) setQrTarget(null);
					}}
					url={qrUrl}
					memberName={qrTarget.name}
				/>
			)}

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

			{membersQuery.isLoading && <p className="text-center text-muted-foreground">Ładowanie...</p>}

			{membersQuery.data && !currentShareCode && (
				<button
					type="button"
					onClick={() => setShareDialogOpen(true)}
					className="mb-4 flex w-full items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-left text-sm text-muted-foreground hover:bg-muted"
				>
					<Info className="mt-0.5 h-4 w-4 shrink-0" />
					<span>
						<strong className="text-foreground">Kody QR są wyłączone.</strong> Aby je włączyć, ustaw
						najpierw kod dostępu w sekcji <strong>Udostępnianie</strong>. Kliknij, aby otworzyć.
					</span>
				</button>
			)}

			{membersQuery.data && (
				<div className="space-y-2">
					{membersQuery.data.map((member) => (
						<MemberRow
							key={member.id}
							member={member}
							hasShareCode={Boolean(currentShareCode)}
							isRegenerating={regenerateMutation.isPending}
							isDeleting={deleteMutation.isPending}
							onShowQr={() => setQrTarget(member)}
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
	hasShareCode: boolean;
	isRegenerating: boolean;
	isDeleting: boolean;
	onShowQr: () => void;
	onRegenerate: () => void;
	onDelete: () => void;
}

function MemberRow({
	member,
	hasShareCode,
	isRegenerating,
	isDeleting,
	onShowQr,
	onRegenerate,
	onDelete,
}: MemberRowProps) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
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
						onClick={onShowQr}
						disabled={!hasShareCode}
						title={hasShareCode ? "Kod QR" : "Najpierw ustaw kod /share"}
					>
						<QrCode className="h-4 w-4" />
					</Button>
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
				</div>
			)}
		</div>
	);
}
