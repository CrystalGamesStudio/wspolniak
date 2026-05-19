// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	CircleSlash2,
	Copy,
	Download,
	Info,
	Link,
	NotebookPen,
	Pencil,
	Plus,
	Printer,
	Share2,
	Trash2,
	X,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
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
	note: string | null;
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: admin page with multiple mutations and dialogs
function AdminPage() {
	const queryClient = useQueryClient();
	const [newName, setNewName] = useState("");
	const [copiedLink, setCopiedLink] = useState<string | null>(null);
	const [lastMagicLink, setLastMagicLink] = useState<{ name: string; link: string } | null>(null);
	const [editingShareCode, setEditingShareCode] = useState(false);
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [shareCodeInput, setShareCodeInput] = useState("");
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [shareSupported, setShareSupported] = useState(false);

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

	const noteMutation = useMutation({
		mutationFn: async ({ id, note }: { id: string; note: string }) => {
			const res = await fetch(`/api/admin/members/${id}/note`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note }),
			});
			if (!res.ok) throw new Error("Nie udało się zapisać notatki");
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
		},
	});

	const banMutation = useMutation({
		mutationFn: async ({ id, days }: { id: string; days: number }) => {
			const res = await fetch(`/api/admin/members/${id}/ban`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ days }),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
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
	const fullShareUrl = currentShareCode
		? `${appUrl}/share?code=${encodeURIComponent(currentShareCode)}`
		: "";

	useEffect(() => {
		if (!shareDialogOpen || !fullShareUrl) {
			setQrDataUrl(null);
			return;
		}
		let cancelled = false;
		QRCode.toDataURL(fullShareUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 }).then(
			(png) => {
				if (!cancelled) setQrDataUrl(png);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [shareDialogOpen, fullShareUrl]);

	useEffect(() => {
		if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
			setShareSupported(true);
		}
	}, []);

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

	function handleQrDownload() {
		if (!qrDataUrl) return;
		const anchor = document.createElement("a");
		anchor.href = qrDataUrl;
		anchor.download = "qr-wspolniak-share.png";
		anchor.click();
	}

	async function handleQrShare() {
		if (!fullShareUrl) return;
		try {
			await navigator.share({
				title: "Logowanie do Wspólniaka",
				text: "Kod dostępu do Wspólniaka",
				url: fullShareUrl,
			});
		} catch {
			// user cancelled or share failed
		}
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
						onClick={() => setShareDialogOpen(true)}
						title="Udostępnianie"
					>
						<Share2 className="h-4 w-4" />
					</Button>
					<ThemeToggle size="lg" className="hidden sm:block" />
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
								<LoaderIcon loading={shareCodeMutation.isPending} />
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
								<div className="flex flex-col items-center gap-4 pt-2 screen-only">
									{qrDataUrl && (
										<div className="relative h-64 w-64">
											<img
												src={qrDataUrl}
												alt="Kod QR /share"
												className="h-64 w-64 rounded-md bg-card"
											/>
											<img
												src="/logo/WspolniakIconLIGHT.png"
												alt=""
												className="absolute top-1/2 left-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-md bg-card p-1"
											/>
										</div>
									)}
									<div className="flex flex-wrap justify-center gap-2">
										<Button variant="outline" onClick={handleQrDownload} disabled={!qrDataUrl}>
											<Download className="mr-1 h-4 w-4" />
											Pobierz PNG
										</Button>
										<Button variant="outline" onClick={() => window.print()} disabled={!qrDataUrl}>
											<Printer className="mr-1 h-4 w-4" />
											Drukuj
										</Button>
										{shareSupported && (
											<Button variant="outline" onClick={handleQrShare} disabled={!qrDataUrl}>
												<Share2 className="mr-1 h-4 w-4" />
												Udostępnij
											</Button>
										)}
									</div>
								</div>
							)}
							<div className="print-area hidden">
								<div className="flex flex-col gap-2">
									<h2 className="text-center text-xl font-bold text-black">Wspólniak</h2>
									<div className="flex items-start gap-4">
										<div className="flex flex-col items-start gap-1">
											<img src="/logo/WspolniakLogoLIGHT.png" alt="Wspólniak" className="h-48" />
											<p className="text-xs break-all text-gray-600">{appUrl}/share</p>
										</div>
										<div className="flex-1" />
										{qrDataUrl && (
											<div className="relative h-48 w-48 shrink-0">
												<img src={qrDataUrl} alt="Kod QR /share" className="h-48 w-48" />
												<img
													src="/logo/WspolniakIconLIGHT.png"
													alt=""
													className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-1"
												/>
											</div>
										)}
									</div>
									<div className="flex items-start gap-4">
										<div className="text-left text-sm leading-relaxed text-black">
											<p className="font-semibold">Jak się zalogować:</p>
											<ul className="mt-1 text-left pl-5 list-decimal space-y-0.5">
												<li>Zeskanuj kod QR aparatem telefonu</li>
												<li>Wybierz swoje imię z listy</li>
												<li>Gotowe — jesteś zalogowany!</li>
											</ul>
										</div>
										<div className="flex-1" />
										<div className="text-right text-sm text-black">
											{currentShareCode && (
												<p>
													Kod: <strong>{currentShareCode}</strong>
												</p>
											)}
											<p>
												<strong>
													W razie pytań
													<br />
													podejdź do Adama
												</strong>
											</p>
										</div>
									</div>
								</div>
							</div>
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
							isSavingNote={noteMutation.isPending}
							isBanning={banMutation.isPending}
							onRegenerate={() => regenerateMutation.mutate({ id: member.id, name: member.name })}
							onDelete={() => deleteMutation.mutate(member.id)}
							onSaveNote={(note) => noteMutation.mutate({ id: member.id, note })}
							onBan={(days) => banMutation.mutate({ id: member.id, days })}
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
	isSavingNote: boolean;
	isBanning: boolean;
	onRegenerate: () => void;
	onDelete: () => void;
	onSaveNote: (note: string) => void;
	onBan: (days: number) => void;
}

function MemberRow({
	member,
	isRegenerating,
	isDeleting,
	isSavingNote,
	isBanning,
	onRegenerate,
	onDelete,
	onSaveNote,
	onBan,
}: MemberRowProps) {
	const [editingNote, setEditingNote] = useState(false);
	const [noteInput, setNoteInput] = useState(member.note ?? "");
	const [_banDialogOpen, setBanDialogOpen] = useState(false);
	const [banDays, _setBanDays] = useState(7);

	const _handleBan = () => {
		onBan(banDays);
		setBanDialogOpen(false);
	};

	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1">
					<span className="font-medium text-foreground">{member.name}</span>
					<span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
						{member.role}
					</span>
					{member.role !== "admin" && member.note && !editingNote && (
						<span className="ml-1 text-xs text-muted-foreground">({member.note})</span>
					)}
				</div>
				<div className="flex gap-1">
					{member.role !== "admin" && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setNoteInput(member.note ?? "");
								setEditingNote(!editingNote);
							}}
							title="Notatka"
						>
							<NotebookPen className="h-4 w-4" />
						</Button>
					)}
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
								onClick={() => setBanDialogOpen(true)}
								disabled={isBanning}
								title="Zbanuj"
							>
								<CircleSlash2 className="h-4 w-4 text-destructive" />
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
			{editingNote && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						onSaveNote(noteInput);
						setEditingNote(false);
					}}
					className="mt-2 flex gap-2"
				>
					<Input
						value={noteInput}
						onChange={(e) => setNoteInput(e.target.value)}
						placeholder="Dodaj notatkę..."
						className="flex-1"
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Escape") setEditingNote(false);
						}}
					/>
					<Button type="submit" size="sm" disabled={isSavingNote}>
						{isSavingNote ? "..." : "OK"}
					</Button>
				</form>
			)}
			<Dialog open={_banDialogOpen} onOpenChange={setBanDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Zbanuj użytkownika</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<p className="text-muted-foreground">
							Zbanuj <strong>{member.name}</strong> na określoną liczbę dni.
						</p>
						<div className="flex items-center gap-2">
							<Input
								type="number"
								min={1}
								max={365}
								value={banDays}
								onChange={(e) => _setBanDays(Number(e.target.value))}
								className="w-24"
							/>
							<span className="text-sm text-muted-foreground">dni</span>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setBanDialogOpen(false)}>
								Anuluj
							</Button>
							<Button variant="destructive" onClick={_handleBan} disabled={isBanning}>
								{isBanning ? "..." : "Zbanuj"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
