type PluginListener = { remove: () => Promise<void> };

type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
};

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

function bridge(): CapacitorBridge | undefined {
  return typeof window === "undefined" ? undefined : window.Capacitor;
}

function plugin(name: string): Record<string, (...args: never[]) => Promise<unknown>> | undefined {
  return bridge()?.Plugins?.[name];
}

export function nativePlatform(): "android" | "ios" | "web" {
  const platform = bridge()?.getPlatform?.();
  return platform === "android" || platform === "ios" ? platform : "web";
}

export function isNativeApp(): boolean {
  return bridge()?.isNativePlatform?.() === true || nativePlatform() !== "web";
}

export async function hapticImpact(enabled = true): Promise<void> {
  if (!enabled) return;
  const haptics = plugin("Haptics");
  try {
    if (haptics?.impact) {
      await haptics.impact({ style: "MEDIUM" } as never);
      return;
    }
  } catch {
    // The web fallback below is intentionally best effort.
  }
  navigator.vibrate?.(120);
}

export async function configureNativeChrome(): Promise<void> {
  const statusBar = plugin("StatusBar");
  try {
    await statusBar?.setBackgroundColor?.({ color: "#09090b" } as never);
    await statusBar?.setStyle?.({ style: "DARK" } as never);
  } catch {
    // Older shells may not bundle the optional StatusBar plugin.
  }
}

export async function getInstalledAppVersion(): Promise<string | null> {
  const app = plugin("App");
  try {
    const info = await app?.getInfo?.();
    if (typeof info === "object" && info !== null && "version" in info && typeof info.version === "string") return info.version;
  } catch {
    // The APK supplied by the user does not bundle this plugin.
  }
  return null;
}

export async function registerNativeBackButton(handler: () => void): Promise<() => void> {
  const app = plugin("App");
  try {
    const listener = await app?.addListener?.("backButton" as never, handler as never) as PluginListener | undefined;
    if (listener) return () => { void listener.remove(); };
  } catch {
    // Browser history remains the fallback for shells without the App plugin.
  }
  return () => undefined;
}

export async function openExternal(url: string): Promise<void> {
  const browser = plugin("Browser");
  try {
    if (browser?.open) {
      await browser.open({ url } as never);
      return;
    }
  } catch {
    // Continue with the system-browser fallback.
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
