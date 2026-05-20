#!/usr/bin/env node
// Replace the __BUILD_ID__ placeholder in dist/client/sw.js with a unique
// per-build identifier (git short SHA when available, otherwise a timestamp).
// Required so CACHE_NAME differs between deploys and the SW activate handler
// evicts the previous build's stale bundles. See GH issue #62.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PLACEHOLDER = "__BUILD_ID__";
const SW_PATH = resolve(process.cwd(), "dist", "client", "sw.js");

function resolveBuildId() {
	try {
		const sha = execSync("git rev-parse --short=8 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
			.toString()
			.trim();
		if (sha) return sha;
	} catch {
		// fall through to timestamp
	}
	return Date.now().toString(36);
}

const source = readFileSync(SW_PATH, "utf-8");
if (!source.includes(PLACEHOLDER)) {
	console.error(`[inject-sw-version] placeholder ${PLACEHOLDER} not found in ${SW_PATH}`);
	process.exit(1);
}

const buildId = resolveBuildId();
const replaced = source.replaceAll(PLACEHOLDER, buildId);
writeFileSync(SW_PATH, replaced);
console.log(`[inject-sw-version] injected build id ${buildId} into ${SW_PATH}`);
