#!/usr/bin/env node
import { ensureConnector } from "./connector.js";
import { TunnelError, tunnel } from "./index.js";
import { parseArgs } from "node:util";
//#region src/cli.ts
const USAGE = `użycie: entrypoint-tunnel tunnel --upstream http://127.0.0.1:3000 [--service <nazwa>]
       [--health /health] [--drain-timeout 30s] [--replica <nazwa>]
       entrypoint-tunnel install-connector   (pobiera konektor i frpc dla tej platformy)
Pakiet połączenia: zmienna ENTRYPOINT_CONNECT.`;
function usage() {
	console.error(USAGE);
	process.exit(2);
}
function parseDuration(s) {
	const m = /^(\d+)(ms|s|m)?$/.exec(s);
	if (!m?.[1]) usage();
	const n = Number(m[1]);
	return m[2] === "ms" ? n : m[2] === "m" ? n * 6e4 : n * 1e3;
}
async function main() {
	const argv = process.argv.slice(2);
	if (argv[0] === "install-connector") {
		console.error(`entrypoint: konektor w ${await ensureConnector()}`);
		return;
	}
	if (argv[0] === "tunnel") argv.shift();
	let values;
	try {
		({values} = parseArgs({
			args: argv,
			options: {
				upstream: { type: "string" },
				service: { type: "string" },
				health: { type: "string" },
				replica: { type: "string" },
				"drain-timeout": { type: "string" }
			}
		}));
	} catch {
		usage();
	}
	if (!values.upstream) usage();
	const drainTimeoutMs = values["drain-timeout"] ? parseDuration(values["drain-timeout"]) : 3e4;
	const t = await tunnel({
		upstream: values.upstream,
		service: values.service,
		healthCheck: values.health,
		replica: values.replica,
		drainTimeoutMs
	});
	console.error(`entrypoint: tunel aktywny (${t.replica})`);
	t.on("event", (e) => {
		if ([
			"disconnected",
			"connected",
			"unhealthy",
			"revoked",
			"tls_error"
		].includes(e.event)) console.error(`entrypoint: ${e.event}${e.reason ? ": " + e.reason : ""}`);
	});
	const stop = () => {
		console.error("entrypoint: drain...");
		t.drain({ timeoutMs: drainTimeoutMs }).then((code) => process.exit(code));
	};
	process.once("SIGTERM", stop);
	process.once("SIGINT", stop);
	process.exit(await t.exited);
}
main().catch((err) => {
	console.error(`entrypoint: ${err instanceof TunnelError ? err.message : String(err)}`);
	process.exit(1);
});
//#endregion
export {};
