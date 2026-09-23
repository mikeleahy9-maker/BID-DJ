export function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function getAppHost(): string {
  try {
    return new URL(getAppUrl()).host;
  } catch {
    return "localhost:3000";
  }
}