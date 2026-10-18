//#region src/connector.d.ts
declare function connectorExe(): string;
/** Klucz platformy w wydaniu, np. linux_amd64. */
declare function platformKey(): string | undefined;
/** Katalogi, w których szukamy (i do których pobieramy) konektora tej wersji SDK. */
declare function connectorDirs(): string[];
/**
 * Zapewnia konektor i frpc dla bieżącej platformy: zwraca ścieżkę konektora,
 * pobierając pliki z wydania, jeśli ich jeszcze nie ma. frpc trafia obok konektora.
 */
declare function ensureConnector(): Promise<string>;
//#endregion
export { platformKey as i, connectorExe as n, ensureConnector as r, connectorDirs as t };