import { Tunnel, TunnelOptions } from "./index.js";
import { IncomingMessage, Server, ServerResponse } from "node:http";
//#region src/http.d.ts
export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;
/** Minimalny interfejs serwera WebSocket (zgodny z biblioteką ws). */
export interface WebSocketServerLike {
  clients: Set<{
    close(code?: number, reason?: string): void;
  }>;
}
export interface ExposeOptions extends Omit<TunnelOptions, "upstream"> {
  /** Serwery WebSocket podpięte pod server (np. new WebSocketServer({ server })). */
  websockets?: WebSocketServerLike[];
  /** Obsługa SIGTERM/SIGINT: drain i zakończenie procesu (domyślnie true). */
  handleSignals?: boolean;
}
export interface Connection {
  server: Server;
  tunnel: Tunnel;
  /** Drain: wycofanie z grupy, wygaszanie połączeń, zakończenie tunelu. */
  drain(opts?: {
    timeoutMs?: number;
  }): Promise<void>;
  close(): Promise<void>;
}
/**
 * Wystawia handler HTTP przez bramę Entrypoint: uruchamia serwer na 127.0.0.1 (losowy port,
 * niedostępny z sieci) i tunel do niego. Pakiet połączenia: opts.connect albo ENTRYPOINT_CONNECT.
 */
export declare function expose(handler: RequestHandler, opts: ExposeOptions): Promise<Connection>;
/** @deprecated Od 0.1.1: użyj ExposeOptions. */
export type ConnectOptions = ExposeOptions;
/** @deprecated Od 0.1.1: użyj expose(). */
export declare const connectTo: typeof expose;
//#endregion