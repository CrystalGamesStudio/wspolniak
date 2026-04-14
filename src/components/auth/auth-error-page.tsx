// SPDX-License-Identifier: AGPL-3.0-or-later
export function AuthErrorPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<div className="mx-auto max-w-md space-y-4 text-center">
				<h1 className="text-2xl font-bold tracking-tight">
					Link jest nieaktywny lub nieprawidłowy
				</h1>
				<p className="text-muted-foreground">Poproś admina o nowy link</p>
			</div>
		</div>
	);
}
