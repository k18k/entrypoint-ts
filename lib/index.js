import { connectorDirs, connectorExe, ensureConnector } from "./connector.js";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
//#region src/index.ts
var TunnelError = class extends Error {
	event;
	constructor(message, event) {
		super(message);
		this.name = "TunnelError";
		this.event = event;
	}
};
/** Uchwyt tunelu. Zdarzenia konektora są tylko obserwowane. */
var Tunnel = class extends EventEmitter {
	replica = "";
	state = "starting";
	exited;
	#child;
	#draining;
	constructor(child) {
		super();
		this.#child = child;
		this.exited = new Promise((resolve) => {
			child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
		});
		if (child.stdout) createInterface({ input: child.stdout }).on("line", (line) => this.#onLine(line));
		child.stdin?.on("error", () => {});
	}
	#onLine(line) {
		let ev;
		try {
			ev = JSON.parse(line);
		} catch {
			return;
		}
		if (ev.replica) this.replica = ev.replica;
		this.state = ev.event;
		this.emit("event", ev);
		this.emit(ev.event, ev);
	}
	#send(cmd) {
		const stdin = this.#child.stdin;
		if (stdin && !stdin.destroyed) stdin.write(JSON.stringify(cmd) + "\n");
	}
	/**
	* Drain repliki: wycofanie z grupy (brak nowych połączeń), wygaszanie istniejących
	* połączeń przez timeoutMs, potem zakończenie frpc. Kontrakt bazowy czeka tylko na
	* wygaśnięcie połączeń; adapter zgłasza ich koniec przez notifyDrained().
	*/
	drain(opts = {}) {
		if (!this.#draining) {
			this.#send({
				cmd: "drain",
				timeoutMs: opts.timeoutMs ?? 0
			});
			this.#draining = this.exited;
		}
		return this.#draining;
	}
	/** Czeka na wycofanie repliki z grupy (krok 1 drainu). */
	withdrawn() {
		if (this.state === "withdrawn") return Promise.resolve();
		return new Promise((resolve) => {
			this.once("withdrawn", () => resolve());
			this.exited.then(() => resolve());
		});
	}
	/** Adapter: wszystkie połączenia zamknięte, konektor może zakończyć frpc. */
	notifyDrained() {
		this.#send({ cmd: "drained" });
	}
	/** Natychmiastowe zamknięcie tunelu, bez drainu. */
	close() {
		this.#send({ cmd: "stop" });
		this.#child.stdin?.end();
		return this.exited;
	}
};
function platformPackage() {
	return `@k18k/entrypoint-${process.platform}-${process.arch}`;
}
/**
* Znajduje binarkę konektora: jawna ścieżka, ENTRYPOINT_CONNECTOR, pakiet platformy
* (jeśli zainstalowany), katalog bin/ paczki albo pamięć podręczna pobrań.
*/
function findConnector(explicit) {
	const exe = connectorExe();
	const candidates = [];
	if (explicit) candidates.push(explicit);
	if (process.env.ENTRYPOINT_CONNECTOR) candidates.push(process.env.ENTRYPOINT_CONNECTOR);
	try {
		const pkg = createRequire(import.meta.url).resolve(`${platformPackage()}/package.json`);
		candidates.push(join(dirname(pkg), "bin", exe));
	} catch {}
	for (const dir of connectorDirs()) candidates.push(join(dir, exe));
	const found = candidates.find((c) => existsSync(c));
	if (found) return found;
	throw new TunnelError(`nie znaleziono ${exe}; uruchom npx entrypoint-tunnel install-connector albo ustaw ENTRYPOINT_CONNECTOR`);
}
async function resolveConnector(explicit) {
	try {
		return findConnector(explicit);
	} catch (err) {
		if (explicit || process.env.ENTRYPOINT_CONNECTOR || process.env.ENTRYPOINT_NO_DOWNLOAD) throw err;
		try {
			return await ensureConnector();
		} catch (dl) {
			throw new TunnelError(`nie udało się pobrać konektora: ${dl instanceof Error ? dl.message : String(dl)}`);
		}
	}
}
function connectorArgs(opts) {
	const args = [
		"tunnel",
		"--parent-pipe",
		"--upstream",
		opts.upstream
	];
	if (opts.service) args.push("--service", opts.service);
	if (opts.healthCheck) args.push("--health", opts.healthCheck);
	if (opts.healthIntervalSec) args.push("--health-interval", String(opts.healthIntervalSec));
	if (opts.healthMaxFailed) args.push("--health-max-failed", String(opts.healthMaxFailed));
	if (opts.drainTimeoutMs) args.push("--drain-timeout", `${opts.drainTimeoutMs}ms`);
	if (opts.replica) args.push("--replica", opts.replica);
	return args;
}
function waitReady(t, timeoutMs) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new TunnelError(`tunel nie był gotowy w ${timeoutMs} ms (stan: ${t.state})`));
		}, timeoutMs);
		const onEvent = (ev) => {
			if (ev.event === "healthy") {
				cleanup();
				resolve();
			} else if (ev.event === "revoked" || ev.event === "auth_failed") {
				cleanup();
				reject(new TunnelError(ev.reason ?? ev.event, ev));
			}
		};
		const cleanup = () => {
			clearTimeout(timer);
			t.off("event", onEvent);
		};
		t.on("event", onEvent);
		t.exited.then((code) => {
			cleanup();
			reject(new TunnelError(`konektor zakończył działanie (kod ${code}) przed gotowością`));
		});
	});
}
/** Otwiera tunel do lokalnego adresu aplikacji. */
async function tunnel(opts) {
	const connect = opts.connect ?? process.env.ENTRYPOINT_CONNECT;
	if (!connect) throw new TunnelError("brak pakietu połączenia (ENTRYPOINT_CONNECT)");
	const bin = await resolveConnector(opts.connectorPath);
	const t = new Tunnel(spawn(bin, connectorArgs(opts), {
		env: {
			...process.env,
			ENTRYPOINT_CONNECT: connect
		},
		stdio: [
			"pipe",
			"pipe",
			opts.log === "ignore" ? "ignore" : "inherit"
		]
	}));
	if (opts.waitReady !== false) await waitReady(t, opts.readyTimeoutMs ?? 6e4);
	return t;
}
//#endregion
export { Tunnel, TunnelError, ensureConnector, findConnector, tunnel };
