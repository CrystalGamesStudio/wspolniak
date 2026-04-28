// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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

interface SharePageProps {
	initialCode?: string;
	preselectedMemberId?: string;
}

export function SharePage({ initialCode = "", preselectedMemberId }: SharePageProps = {}) {
	const [step, setStep] = useState<Step>("code");
	const [code, setCode] = useState(initialCode);
	const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
	const autoVerifyTriggered = useRef(false);

	const verifyMutation = useMutation({
		mutationFn: () => verifyCode(code),
		onSuccess: (data) => {
			setMembers(data.members);
			setStep("members");
		},
	});

	useEffect(() => {
		if (autoVerifyTriggered.current) return;
		if (!initialCode || !preselectedMemberId) return;
		autoVerifyTriggered.current = true;
		verifyMutation.mutate();
	}, [initialCode, preselectedMemberId, verifyMutation.mutate]);

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
			<MembersStep
				members={members}
				preselectedMemberId={preselectedMemberId}
				isLoggingIn={loginMutation.isPending}
				errorMessage={loginMutation.isError ? loginMutation.error.message : null}
				onSelect={(id) => loginMutation.mutate(id)}
				onBack={() => {
					setStep("code");
					setMembers([]);
					loginMutation.reset();
				}}
			/>
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

interface MembersStepProps {
	members: { id: string; name: string }[];
	preselectedMemberId?: string;
	isLoggingIn: boolean;
	errorMessage: string | null;
	onSelect: (id: string) => void;
	onBack: () => void;
}

function MembersStep({
	members,
	preselectedMemberId,
	isLoggingIn,
	errorMessage,
	onSelect,
	onBack,
}: MembersStepProps) {
	const preselected = preselectedMemberId
		? members.find((m) => m.id === preselectedMemberId)
		: undefined;
	const otherMembers = preselected ? members.filter((m) => m.id !== preselected.id) : members;

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6">
			<div className="mx-auto w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold tracking-tight text-foreground">
						{preselected ? `Cześć, ${preselected.name}!` : "Wybierz siebie"}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{preselected ? "Potwierdź, aby się zalogować" : "Kto się loguje?"}
					</p>
				</div>

				{errorMessage && (
					<Alert variant="destructive">
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				)}

				{preselected && (
					<Button
						className="w-full h-14 justify-center text-lg"
						disabled={isLoggingIn}
						onClick={() => onSelect(preselected.id)}
					>
						Zaloguj się jako {preselected.name}
					</Button>
				)}

				{otherMembers.length > 0 && (
					<div className="space-y-3">
						{preselected && (
							<p className="text-center text-sm text-muted-foreground">
								To nie ja — wybierz kogoś innego:
							</p>
						)}
						{otherMembers.map((member) => (
							<Button
								key={member.id}
								variant="outline"
								className="w-full h-14 justify-center text-lg"
								disabled={isLoggingIn}
								onClick={() => onSelect(member.id)}
							>
								{member.name}
							</Button>
						))}
					</div>
				)}

				<Button variant="ghost" className="w-full h-12 text-base" onClick={onBack}>
					Wstecz
				</Button>
			</div>
		</div>
	);
}
