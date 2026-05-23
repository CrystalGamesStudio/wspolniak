// SPDX-License-Identifier: AGPL-3.0-or-later
import { Check, Copy, Download, Pencil, Printer, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { type FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoaderIcon } from "@/components/ui/spinner";

interface ShareCodeDialogProps {
	open: boolean;
	appUrl: string;
	currentShareCode: string | null | undefined;
	copiedLink: string | null;
	editingShareCode: boolean;
	shareCodeInput: string;
	isSaving: boolean;
	errorMessage?: string;
	onOpenChange: (open: boolean) => void;
	onClose: () => void;
	onCopy: (text: string) => void;
	onStartEdit: () => void;
	onCancelEdit: () => void;
	onShareCodeInputChange: (value: string) => void;
	onSaveShareCode: (code: string) => void;
}

export function ShareCodeDialog({
	open,
	appUrl,
	currentShareCode,
	copiedLink,
	editingShareCode,
	shareCodeInput,
	isSaving,
	errorMessage,
	onOpenChange,
	onClose,
	onCopy,
	onStartEdit,
	onCancelEdit,
	onShareCodeInputChange,
	onSaveShareCode,
}: ShareCodeDialogProps) {
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [shareSupported, setShareSupported] = useState(false);
	const fullShareUrl = currentShareCode
		? `${appUrl}/share?code=${encodeURIComponent(currentShareCode)}`
		: "";

	useEffect(() => {
		if (!open || !fullShareUrl) {
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
	}, [open, fullShareUrl]);

	useEffect(() => {
		if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
			setShareSupported(true);
		}
	}, []);

	function handleOpenChange(nextOpen: boolean) {
		onOpenChange(nextOpen);
		if (!nextOpen) onClose();
	}

	function handleSaveShareCode(e: FormEvent) {
		e.preventDefault();
		const trimmed = shareCodeInput.trim();
		if (!trimmed) return;
		onSaveShareCode(trimmed);
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
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Kod dostępu /share</DialogTitle>
				</DialogHeader>

				{errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

				{editingShareCode ? (
					<form onSubmit={handleSaveShareCode} className="flex gap-2">
						<Input
							value={shareCodeInput}
							onChange={(e) => onShareCodeInputChange(e.target.value)}
							placeholder="np. 7843"
							className="flex-1"
							maxLength={20}
							autoFocus
						/>
						<Button type="submit" size="sm" disabled={!shareCodeInput.trim() || isSaving}>
							<LoaderIcon loading={isSaving} />
							{isSaving ? "Zapisuję..." : "Zapisz"}
						</Button>
						<Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
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
									onClick={() => onCopy(currentShareCode)}
									title="Kopiuj kod"
								>
									{copiedLink === currentShareCode ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							)}
							<Button size="sm" variant="ghost" onClick={onStartEdit} title="Zmień kod">
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
											<li>Gotowe - jesteś zalogowany!</li>
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
	);
}
