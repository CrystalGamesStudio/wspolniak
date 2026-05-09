// SPDX-License-Identifier: AGPL-3.0-or-later
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FORMSPREE_FORM_ID = "mojybbla";

export const Route = createFileRoute("/app/feedback")({
	component: FeedbackPage,
});

function FeedbackPage() {
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
				headers: { Accept: "application/json" },
			});

			if (res.ok) {
				setSubmitted(true);
			} else {
				const data = (await res.json()) as { error?: string };
				setError(data.error || "Wystąpił błąd. Spróbuj ponownie.");
			}
		} catch {
			setError("Nie udało się wysłać feedbacku. Spróbuj ponownie.");
		}
	}

	return (
		<div className="max-w-2xl bg-background px-4 py-6 pb-28 sm:pb-6">
			<div className="mb-6 flex items-center gap-3">
				<Link
					to="/app"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					<ArrowLeft className="size-6" />
				</Link>
				<h1 className="text-2xl font-bold text-foreground">Feedback</h1>
			</div>

			{submitted ? (
				<div className="rounded-md border border-border bg-muted/50 p-6 text-center">
					<p className="text-lg font-medium text-foreground">Dzięki za feedback!</p>
					<p className="mt-1 text-muted-foreground">Odpowiemy najszybciej jak to możliwe.</p>
					<Link to="/app" className="mt-4 inline-block">
						<Button variant="outline">Wróć do feedu</Button>
					</Link>
				</div>
			) : (
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
							<option value="bug">Błąd</option>
							<option value="feature">Nowa funkcja</option>
							<option value="improvement">Poprawa</option>
							<option value="other">Inne</option>
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

					<Button type="submit" className="h-11 w-full sm:h-9">
						Wyślij feedback
					</Button>
				</form>
			)}
		</div>
	);
}
