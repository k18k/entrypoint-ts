import { tunnel } from "./index.js";
import { createServer } from "node:http";
//#region src/http.ts
const isEventStream = (v) => String(Array.isArray(v) ? v[0] : v ?? "").toLowerCase().startsWith("text/event-stream");
function trackEventStream(res, set) {
	const writeHead = res.writeHead.bind(res);
	res.writeHead = ((...args) => {
		for (const a of args) if (Array.isArray(a)) {
			const flat = a.flat();
			for (let i = 0; i + 1 < flat.length; i += 2) if (String(flat[i]).toLowerCase() === "content-type" && isEventStream(flat[i + 1])) set.add(res);
		} else if (a && typeof a === "object") {
			for (const [k, v] of Object.entries(a)) if (k.toLowerCase() === "content-type" && isEventStream(v)) set.add(res);
		}
		return writeHead(...args);
	});
}
const WS_CLOSE_1001 = Buffer.from([
	136,
	2,
	3,
	233
]);
async function connectTo(handler, opts) {
	let draining = false;
	const sockets = /* @__PURE__ */ new Set();
	const upgraded = /* @__PURE__ */ new Set();
	const streams = /* @__PURE__ */ new Set();
	const eventStreams = /* @__PURE__ */ new Set();
	let onAllClosed;
	const checkDone = () => {
		if (draining && sockets.size === 0 && onAllClosed) {
			const done = onAllClosed;
			onAllClosed = void 0;
			done();
		}
	};
	const server = createServer((req, res) => {
		if (draining) res.setHeader("Connection", "close");
		trackEventStream(res, eventStreams);
		streams.add(res);
		res.on("close", () => {
			streams.delete(res);
			eventStreams.delete(res);
		});
		handler(req, res);
	});
	server.on("connection", (s) => {
		sockets.add(s);
		s.on("close", () => {
			sockets.delete(s);
			upgraded.delete(s);
			checkDone();
		});
	});
	server.on("upgrade", (_req, s) => upgraded.add(s));
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => resolve());
	});
	const port = server.address().port;
	const t = await tunnel({
		...opts,
		upstream: `http://127.0.0.1:${port}`
	});
	const closeStreams = () => {
		for (const res of streams) if (eventStreams.has(res) || isEventStream(res.getHeader("content-type"))) res.end();
		const wss = opts.websockets ?? [];
		for (const w of wss) for (const c of w.clients) c.close(1001, "server draining");
		if (wss.length === 0) for (const s of upgraded) s.end(WS_CLOSE_1001);
	};
	let drainPromise;
	const drain = (o = {}) => {
		drainPromise ??= (async () => {
			const exited = t.drain({ timeoutMs: o.timeoutMs ?? opts.drainTimeoutMs });
			await t.withdrawn();
			draining = true;
			server.close();
			server.closeIdleConnections();
			closeStreams();
			const allClosed = new Promise((resolve) => {
				onAllClosed = resolve;
				checkDone();
			});
			await Promise.race([allClosed.then(() => t.notifyDrained()), exited]);
			await exited;
			server.closeAllConnections();
		})();
		return drainPromise;
	};
	const close = async () => {
		await t.close();
		server.closeAllConnections();
		server.close();
	};
	if (opts.handleSignals !== false) {
		const onSignal = () => {
			drain().then(() => process.exit(0), () => process.exit(1));
		};
		process.once("SIGTERM", onSignal);
		process.once("SIGINT", onSignal);
	}
	t.exited.then(() => {
		if (!draining) server.close();
	});
	return {
		server,
		tunnel: t,
		drain,
		close
	};
}
//#endregion
export { connectTo };
