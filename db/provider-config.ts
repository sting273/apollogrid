import { env } from "cloudflare:workers";

type ProviderSecret = "IDEAL_POSTCODES_API_KEY" | "GOOGLE_MAPS_API_KEY" | "ADMIN_EMAILS" | "MIGRATION_TOKEN";

// Read worker bindings directly as well as Node compatibility environment.
// Values remain on the server and must never be returned to the browser.
export function providerSecret(name: ProviderSecret, processValue?: string) {
  const bindings = env as unknown as Partial<Record<ProviderSecret, string>>;
  return bindings[name]?.trim() || processValue?.trim() || "";
}

export function providerStatus() {
  return {
    addresses: Boolean(providerSecret("IDEAL_POSTCODES_API_KEY", process.env.IDEAL_POSTCODES_API_KEY)),
    solar: Boolean(providerSecret("GOOGLE_MAPS_API_KEY", process.env.GOOGLE_MAPS_API_KEY)),
  };
}

export function adminEmails() {
  return providerSecret("ADMIN_EMAILS", process.env.ADMIN_EMAILS)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
