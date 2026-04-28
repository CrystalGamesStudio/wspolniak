// SPDX-License-Identifier: AGPL-3.0-or-later
import { Download, Printer, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

interface QrCodeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	url: string;
	memberName: string;
}

export function QrCodeDialog({ open, onOpenChange, url, memberName }: QrCodeDialogProps) {
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	const [shareSupported, setShareSupported] = useState(false);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 320 }).then((png) => {
			if (!cancelled) setDataUrl(png);
		});
		return () => {
			cancelled = true;
		};
	}, [open, url]);

	useEffect(() => {
		if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
			setShareSupported(true);
		}
	}, []);

	function handleDownload() {
		if (!dataUrl) return;
		const anchor = document.createElement("a");
		anchor.href = dataUrl;
		anchor.download = `qr-${slugify(memberName)}.png`;
		anchor.click();
	}

	async function handleShare() {
		try {
			await navigator.share({
				title: `Logowanie do Wspólniaka — ${memberName}`,
				text: `Kod QR dla ${memberName}`,
				url,
			});
		} catch {
			// user cancelled or share failed — silent
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Kod QR dla {memberName}</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col items-center gap-4 screen-only">
					{dataUrl && (
						<div className="relative h-64 w-64">
							<img
								src={dataUrl}
								alt={`Kod QR dla ${memberName}`}
								className="h-64 w-64 rounded-md bg-card"
							/>
							<img
								src="/logo/WspolniakIconLIGHT.png"
								alt=""
								className="absolute top-1/2 left-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-md bg-card p-1"
							/>
						</div>
					)}
					<p className="text-center text-xs text-muted-foreground break-all">{url}</p>
				</div>

				<div className="print-area hidden">
					<div className="flex flex-col gap-6 p-8">
						<h2 className="text-center text-2xl font-bold">{memberName}</h2>
						<div className="flex items-center gap-6">
							<div className="flex flex-col items-center gap-2">
								<img src="/logo/WspolniakLogoLIGHT.png" alt="Wspólniak" className="h-28" />
								<p className="text-xs break-all text-gray-600">{url}</p>
							</div>
							{dataUrl && (
								<div className="relative h-48 w-48">
									<img src={dataUrl} alt={`Kod QR dla ${memberName}`} className="h-48 w-48" />
									<img
										src="/logo/WspolniakIconLIGHT.png"
										alt=""
										className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-1"
									/>
								</div>
							)}
						</div>
						<div className="text-center text-sm leading-relaxed text-black">
							<p className="font-semibold">Jak się zalogować:</p>
							<ol className="mt-2 list-decimal text-left pl-6">
								<li>Zeskanuj kod QR aparatem telefonu</li>
								<li>lub wejdź na stronę i wpisz kod dostępu</li>
								<li>Gotowe — jesteś zalogowany!</li>
							</ol>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap justify-center gap-2 screen-only">
					<Button variant="outline" onClick={handleDownload} disabled={!dataUrl}>
						<Download className="mr-1 h-4 w-4" />
						Pobierz PNG
					</Button>
					<Button variant="outline" onClick={() => window.print()} disabled={!dataUrl}>
						<Printer className="mr-1 h-4 w-4" />
						Drukuj
					</Button>
					{shareSupported && (
						<Button variant="outline" onClick={handleShare} disabled={!dataUrl}>
							<Share2 className="mr-1 h-4 w-4" />
							Udostępnij
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
