export interface DesktopRuntimeInfo {
  packaged: boolean;
  version: string;
  logDirectory: string;
  projectStorage: string;
}

interface TauriCoreBridge {
  invoke<T>(command: string, arguments_?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI__?: { core?: TauriCoreBridge };
  }
}

function coreBridge(): TauriCoreBridge | null {
  if (typeof window === "undefined") return null;
  return window.__TAURI__?.core ?? null;
}

export function isDesktopRuntime(): boolean {
  return coreBridge() !== null;
}

export async function getRuntimeInfo(): Promise<DesktopRuntimeInfo> {
  const bridge = coreBridge();
  if (!bridge) {
    return {
      packaged: false,
      version: __APP_VERSION__,
      logDirectory: "Browser developer console",
      projectStorage: "This browser profile's local storage",
    };
  }
  return bridge.invoke<DesktopRuntimeInfo>("get_runtime_info");
}

export async function appendDiagnosticLog(level: "info" | "warn" | "error", message: string): Promise<void> {
  const bridge = coreBridge();
  if (!bridge) return;
  await bridge.invoke("append_diagnostic_log", { level, message });
}

export async function openLogDirectory(): Promise<void> {
  const bridge = coreBridge();
  if (!bridge) throw new Error("File logs are available only in the installed Windows application.");
  await bridge.invoke("open_log_directory");
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) || String(value) || "Unknown error";
  } catch {
    return String(value) || "Unknown error";
  }
}

function writeFrontendDiagnostic(level: "info" | "warn" | "error", message: string): void {
  // Diagnostics must never create a second unhandled rejection when native logging is unavailable.
  void appendDiagnosticLog(level, message).catch(() => undefined);
}

export function initialiseDesktopDiagnostics(): () => void {
  if (!isDesktopRuntime()) return () => undefined;

  writeFrontendDiagnostic("info", `Frontend ${__APP_VERSION__} initialized; solver mode ${import.meta.env.VITE_ENGINE || "wasm"}`);
  const handleError = (event: ErrorEvent) => {
    writeFrontendDiagnostic("error", `Unhandled window error: ${errorMessage(event.error ?? event.message)}`);
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    writeFrontendDiagnostic("error", `Unhandled promise rejection: ${errorMessage(event.reason)}`);
  };
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
