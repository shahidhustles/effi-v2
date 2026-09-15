export type BotGatewayConfig =
  | { kind: "ready"; host: string }
  | { kind: "missing" }
  | { kind: "invalid"; value: string };

export function botGatewayConfig(value: string | undefined): BotGatewayConfig {
  const candidate = value?.trim();
  if (!candidate) return { kind: "missing" };

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { kind: "invalid", value: candidate };
    }

    return { kind: "ready", host: url.toString().replace(/\/$/, "") };
  } catch {
    return { kind: "invalid", value: candidate };
  }
}
