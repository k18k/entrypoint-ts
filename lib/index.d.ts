import { r as ensureConnector } from "./connector-sMjggFUc.js";
import { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
//#region src/index.d.ts
export interface TunnelOptions {
  /** Pakiet połączenia ENTRYPOINT_CONNECT (domyślnie z process.env). */
  connect?: string;
  /** Nazwa serwisu; musi zgadzać się z pakietem połączenia. */
  service?: string;
  /** Lokalny adres aplikacji, np. http://127.0.0.1:3000. */
  upstream: string;
  /** Ścieżka health checku HTTP, np. /health. Bez niej health check jest TCP. */
  healthCheck?: string;
  healthIntervalSec?: number;
  healthMaxFailed?: number;
  /** Domyślny czas drainu (ms). */
  drainTimeoutMs?: number;
  /** Nazwa repliki (domyślnie z nazwy hosta). */
  replica?: string;
  /** Ścieżka do entrypoint-connector (domyślnie z pakietu platformy albo ENTRYPOINT_CONNECTOR). */
  connectorPath?: string;
  /** Czy tunnel() ma czekać na pierwszą zdrową rejestrację (domyślnie true). */
  waitReady?: boolean;
  readyTimeoutMs?: number;
  /** Gdzie trafiają logi konektora i frpc (domyślnie stderr procesu). */
  log?: "inherit" | "ignore";
}
export type TunnelEventName = "starting" | "connected" | "healthy" | "unhealthy" | "rejected" | "disconnected" | "draining" | "withdrawn" | "drained" | "drain_timeout" | "revoked" | "auth_failed" | "tls_error" | "connect_failed" | "error" | "exit";
export interface TunnelEvent {
  event: TunnelEventName;
  replica?: string;
  reason?: string;
  timeoutMs?: number;
  code?: number;
  time: string;
}
export declare class TunnelError extends Error {
  readonly event: TunnelEvent | undefined;
  constructor(message: string, event?: TunnelEvent);
}
/** Uchwyt tunelu. Zdarzenia konektora są tylko obserwowane. */
export declare class Tunnel extends EventEmitter {
  #private;
  replica: string;
  state: TunnelEventName;
  readonly exited: Promise<number>;
  constructor(child: ChildProcess);
  /**
   * Drain repliki: wycofanie z grupy (brak nowych połączeń), wygaszanie istniejących
   * połączeń przez timeoutMs, potem zakończenie frpc. Kontrakt bazowy czeka tylko na
   * wygaśnięcie połączeń; adapter zgłasza ich koniec przez notifyDrained().
   */
  drain(opts?: {
    timeoutMs?: number;
  }): Promise<number>;
  /** Czeka na wycofanie repliki z grupy (krok 1 drainu). */
  withdrawn(): Promise<void>;
  /** Adapter: wszystkie połączenia zamknięte, konektor może zakończyć frpc. */
  notifyDrained(): void;
  /** Natychmiastowe zamknięcie tunelu, bez drainu. */
  close(): Promise<number>;
}
/**
 * Znajduje binarkę konektora: jawna ścieżka, ENTRYPOINT_CONNECTOR, pakiet platformy
 * (jeśli zainstalowany), katalog bin/ paczki albo pamięć podręczna pobrań.
 */
export declare function findConnector(explicit?: string): string;
/** Otwiera tunel do lokalnego adresu aplikacji. */
export declare function tunnel(opts: TunnelOptions): Promise<Tunnel>;
//#endregion
export { ensureConnector };