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
export interface ConnectOptions extends Omit<TunnelOptions, "upstream"> {
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
export declare function connectTo(handler: RequestHandler, opts: ConnectOptions): Promise<Connection>;
//#endregion