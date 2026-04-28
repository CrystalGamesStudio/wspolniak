// SPDX-License-Identifier: AGPL-3.0-or-later
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FORMSPREE_FORM_ID = "mojybbla";

interface FeedbackButtonProps {
	variant?: "default" | "ghost" | "outline";
	size?: "default" | "sm" | "icon";
	className?: string;
}

export function FeedbackButton({
	variant = "ghost",
	size = "default",
	className,
}: FeedbackButtonProps) {
	const [open, setOpen] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);

		const form = e.currentTarget;
		const formData = new FormData(form);

		try {
			const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
				method: "POST",
				body: formData,
				headers: {
					Accept: "application/json",
				},
			});

			if (res.ok) {
				setSubmitted(true);
				setTimeout(() => {
					setSubmitted(false);
					setOpen(false);
					form.reset();
				}, 2000);
			} else {
				const data = (await res.json()) as { error?: string };
				setError(data.error || "Wystąpił błąd. Spróbuj ponownie.");
			}
		} catch {
			setError("Nie udało się wysłać feedbacku. Spróbuj ponownie.");
		}
	}

	return (
		<>
			<Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
				<MessageSquare className="h-4 w-4" />
				<span className="hidden sm:inline">Feedback</span>
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Feedback</DialogTitle>
						<DialogDescription>
							{submitted && "Dzięki za feedback! Odpowiemy najszybciej jak to możliwe."}
						</DialogDescription>
					</DialogHeader>

					{!submitted && (
						<form onSubmit={handleSubmit} className="space-y-4">
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							<div className="space-y-2">
								<Label htmlFor="name">Imię</Label>
								<Input id="name" name="name" placeholder="Twoje imię" required />
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" name="email" type="email" placeholder="twoj@email.com" required />
							</div>

							<div className="space-y-2">
								<Label htmlFor="category">Kategoria</Label>
								<select
									id="category"
									name="category"
									className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
									required
								>
									<option value="">Wybierz...</option>
									<option value="bug">🐛 Błąd</option>
									<option value="feature">✨ Nowa funkcja</option>
									<option value="improvement">💡 Poprawa</option>
									<option value="other">💬 Inne</option>
								</select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="message">Wiadomość</Label>
								<Textarea
									id="message"
									name="message"
									rows={8}
									placeholder="Opisz swój problem lub pomysł..."
									className="min-h-48 resize-y"
									required
								/>
							</div>

							<Button type="submit" className="w-full">
								Wyślij feedback
							</Button>
						</form>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
