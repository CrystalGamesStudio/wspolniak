// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SPDX_HEADER = "// SPDX-License-Identifier: AGPL-3.0-or-later";

function findSourceFiles(dir: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
	return entries
		.filter(
			(e) =>
				e.isFile() &&
				(e.name.endsWith(".ts") || e.name.endsWith(".tsx")) &&
				e.name !== "routeTree.gen.ts",
		)
		.map((e) => join(e.parentPath ?? e.path, e.name));
}

describe("SPDX license headers", () => {
	it("every source file under src/ has an SPDX identifier on the first line", () => {
		const srcDir = resolve(import.meta.dirname ?? process.cwd(), ".");
		const files = findSourceFiles(srcDir);

		expect(files.length).toBeGreaterThan(0);

		const missing: string[] = [];
		for (const file of files) {
			const firstLine = readFileSync(file, "utf-8").split("\n")[0];
			if (firstLine !== SPDX_HEADER) {
				missing.push(file.replace(`${process.cwd()}/`, ""));
			}
		}

		expect(missing, `Files missing SPDX header:\n${missing.join("\n")}`).toEqual([]);
	});
});
