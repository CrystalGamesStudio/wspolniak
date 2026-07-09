// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoaderIcon } from "@/components/ui/spinner";

interface CalendarEventDTO {
	id: string;
	title: string;
	description: string | null;
	day: number;
	month: number;
}

interface NewEventForm {
	title: string;
	description: string;
	day: string;
	month: string;
}

const EMPTY_FORM: NewEventForm = { title: "", description: "", day: "", month: "" };

const MONTHS_PL = [
	"styczeń",
	"luty",
	"marzec",
	"kwiecień",
	"maj",
	"czerwiec",
	"lipiec",
	"sierpień",
	"wrzesień",
	"październik",
	"listopad",
	"grudzień",
];

export const Route = createFileRoute("/app/calendar")({
	beforeLoad: ({ context }) => {
		if (context.session.role !== "admin") {
			throw redirect({ to: "/app" });
		}
	},
	component: CalendarPage,
});

function CalendarPage() {
	const queryClient = useQueryClient();
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [form, setForm] = useState<NewEventForm>(EMPTY_FORM);

	const eventsQuery = useQuery({
		queryKey: ["admin", "calendar"],
		queryFn: async (): Promise<CalendarEventDTO[]> => {
			const res = await fetch("/api/admin/calendar");
			if (!res.ok) throw new Error("Nie udało się pobrać wydarzeń");
			const json = (await res.json()) as { data: CalendarEventDTO[] };
			return json.data;
		},
	});

	const createMutation = useMutation({
		mutationFn: async (input: {
			title: string;
			description: string | null;
			day: number;
			month: number;
		}) => {
			const res = await fetch("/api/admin/calendar", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}
			return res.json() as Promise<{ data: CalendarEventDTO }>;
		},
		onSuccess: async () => {
			setForm(EMPTY_FORM);
			setAddDialogOpen(false);
			await queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
		},
	});

	function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		createMutation.reset();
		createMutation.mutate({
			title: form.title.trim(),
			description: form.description.trim() || null,
			day: Number(form.day),
			month: Number(form.month),
		});
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
				<h1 className="text-2xl font-bold text-foreground">Kalendarz</h1>
				<div className="flex-1" />
				<Button
					variant="ghost"
					size="lg"
					onClick={() => setAddDialogOpen(true)}
					title="Dodaj wydarzenie"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			<Dialog
				open={addDialogOpen}
				onOpenChange={(open) => {
					setAddDialogOpen(open);
					if (!open) {
						setForm(EMPTY_FORM);
						createMutation.reset();
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Dodaj wydarzenie</DialogTitle>
					</DialogHeader>

					{createMutation.isError && (
						<Alert variant="destructive">{createMutation.error.message}</Alert>
					)}

					<form onSubmit={handleCreate} className="space-y-3">
						<Input
							value={form.title}
							onChange={(e) => setForm({ ...form, title: e.target.value })}
							placeholder="Tytuł"
							autoFocus
							required
						/>
						<Input
							value={form.description}
							onChange={(e) => setForm({ ...form, description: e.target.value })}
							placeholder="Opis (opcjonalnie)"
						/>
						<div className="flex gap-2">
							<Input
								type="number"
								min={1}
								max={31}
								value={form.day}
								onChange={(e) => setForm({ ...form, day: e.target.value })}
								placeholder="Dzień (1–31)"
								required
								className="flex-1"
							/>
							<Input
								type="number"
								min={1}
								max={12}
								value={form.month}
								onChange={(e) => setForm({ ...form, month: e.target.value })}
								placeholder="Miesiąc (1–12)"
								required
								className="flex-1"
							/>
						</div>
						<Button type="submit" disabled={createMutation.isPending} className="w-full">
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

			{eventsQuery.data && (
				<div className="space-y-2">
					{eventsQuery.data.map((event) => (
						<EventRow key={event.id} event={event} />
					))}
				</div>
			)}
		</div>
	);
}

interface EventRowProps {
	event: CalendarEventDTO;
}

function EventRow({ event }: EventRowProps) {
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div className="flex items-baseline justify-between gap-2">
				<span className="font-medium text-foreground">{event.title}</span>
				<span className="shrink-0 text-sm text-muted-foreground">
					{event.day} {MONTHS_PL[event.month - 1]}
				</span>
			</div>
			{event.description && (
				<p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
			)}
		</div>
	);
}
