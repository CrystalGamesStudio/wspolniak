interface AppPageProps {
	name: string;
}

export function AppPage({ name }: AppPageProps) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background">
			<h1 className="text-3xl font-bold tracking-tight text-foreground">Witaj {name}</h1>
		</div>
	);
}
