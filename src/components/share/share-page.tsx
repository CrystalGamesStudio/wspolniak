// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VerifyResponse {
	members: { id: string; name: string }[];
}

interface LoginResponse {
	redirectUrl: string;
}

type Step = "code" | "members" | "redirecting";

async function verifyCode(code: string): Promise<VerifyResponse> {
	const res = await fetch("/api/share/verify", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code }),
	});

	if (!res.ok) {
		throw new Error("Nieprawidłowy kod dostępu");
	}

	return res.json() as Promise<VerifyResponse>;
}

async function loginMember(code: string, memberId: string): Promise<LoginResponse> {
	const res = await fetch("/api/share/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code, memberId }),
	});

	if (!res.ok) {
		const body = (await res.json()) as { error?: string };
		throw new Error(body.error ?? "Logowanie nie powiodło się");
	}

	return res.json() as Promise<LoginResponse>;
}

export function SharePage() {
	const [step, setStep] = useState<Step>("code");
	const [code, setCode] = useState("");
	const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

	const verifyMutation = useMutation({
		mutationFn: () => verifyCode(code),
		onSuccess: (data) => {
			setMembers(data.members);
			setStep("members");
		},
	});

	const loginMutation = useMutation({
		mutationFn: (memberId: string) => loginMember(code, memberId),
		onSuccess: (data) => {
			setStep("redirecting");
			window.location.href = data.redirectUrl;
		},
	});

	if (step === "redirecting") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-6">
				<p className="text-muted-foreground">Logowanie...</p>
			</div>
		);
	}

	if (step === "members") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-6">
				<div className="mx-auto w-full max-w-md space-y-6">
					<div className="text-center">
						<h1 className="text-2xl font-bold tracking-tight text-foreground">Wybierz siebie</h1>
						<p className="mt-2 text-muted-foreground">Kto się loguje?</p>
					</div>

					{loginMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>{loginMutation.error.message}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-3">
						{members.map((member) => (
							<Button
								key={member.id}
								variant="outline"
								className="w-full h-14 justify-center text-lg"
								disabled={loginMutation.isPending}
								onClick={() => loginMutation.mutate(member.id)}
							>
								{member.name}
							</Button>
						))}
					</div>

					<Button
						variant="ghost"
						className="w-full h-12 text-base"
						onClick={() => {
							setStep("code");
							setMembers([]);
							loginMutation.reset();
						}}
					>
						Wstecz
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6">
			<div className="mx-auto w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold tracking-tight text-foreground">Wspólniak</h1>
					<p className="mt-2 text-muted-foreground">Wpisz kod dostępu z ulotki</p>
				</div>

				{verifyMutation.isError && (
					<Alert variant="destructive">
						<AlertDescription>{verifyMutation.error.message}</AlertDescription>
					</Alert>
				)}

				<form
					onSubmit={(e) => {
						e.preventDefault();
						verifyMutation.reset();
						verifyMutation.mutate();
					}}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="share-code">Kod dostępu</Label>
						<Input
							id="share-code"
							type="text"
							inputMode="numeric"
							placeholder="Kod dostępu"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							autoComplete="off"
							maxLength={20}
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={!code.trim() || verifyMutation.isPending}
					>
						{verifyMutation.isPending ? "Sprawdzanie..." : "Dalej"}
					</Button>
				</form>
			</div>
		</div>
	);
}
