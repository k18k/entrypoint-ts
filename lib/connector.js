import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
//#region src/connector.ts
const PLATFORMS = {
	"linux-x64": "linux_amd64",
	"linux-arm64": "linux_arm64",
	"darwin-x64": "darwin_amd64",
	"darwin-arm64": "darwin_arm64",
	"win32-x64": "windows_amd64"
};
const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function connectorExe() {
	return process.platform === "win32" ? "entrypoint-connector.exe" : "entrypoint-connector";
}
function frpcExe() {
	return process.platform === "win32" ? "frpc.exe" : "frpc";
}
/** Klucz platformy w wydaniu, np. linux_amd64. */
function platformKey() {
	return PLATFORMS[`${process.platform}-${process.arch}`];
}
function readManifest() {
	const p = join(PKG_ROOT, "connector.json");
	if (!existsSync(p)) return void 0;
	return JSON.parse(readFileSync(p, "utf8"));
}
/** Katalogi, w których szukamy (i do których pobieramy) konektora tej wersji SDK. */
function connectorDirs() {
	const version = readManifest()?.version ?? "dev";
	const cache = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
	return [join(PKG_ROOT, "bin"), join(cache, "entrypoint", version)];
}
async function download(asset, dest) {
	const res = await fetch(asset.url, { redirect: "follow" });
	if (!res.ok) throw new Error(`pobieranie ${asset.url}: HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	const got = createHash("sha256").update(buf).digest("hex");
	if (got !== asset.sha256) throw new Error(`błędna suma SHA256 pliku ${asset.url} (${got}, oczekiwano ${asset.sha256})`);
	const tmp = `${dest}.tmp-${process.pid}`;
	await writeFile(tmp, buf, { mode: 493 });
	await chmod(tmp, 493);
	await rename(tmp, dest);
}
/**
* Zapewnia konektor i frpc dla bieżącej platformy: zwraca ścieżkę konektora,
* pobierając pliki z wydania, jeśli ich jeszcze nie ma. frpc trafia obok konektora.
*/
async function ensureConnector() {
	for (const dir of connectorDirs()) {
		const c = join(dir, connectorExe());
		if (existsSync(c) && existsSync(join(dir, frpcExe()))) return c;
	}
	const manifest = readManifest();
	const key = platformKey();
	const assets = key ? manifest?.platforms[key] : void 0;
	if (!manifest || !key || !assets) throw new Error(`brak konektora dla platformy ${process.platform}-${process.arch}`);
	let lastErr;
	for (const dir of connectorDirs()) try {
		await mkdir(dir, { recursive: true });
		await download(assets.frpc, join(dir, frpcExe()));
		await download(assets.connector, join(dir, connectorExe()));
		return join(dir, connectorExe());
	} catch (err) {
		lastErr = err;
	}
	throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
//#endregion
export { connectorDirs, connectorExe, ensureConnector, platformKey };
