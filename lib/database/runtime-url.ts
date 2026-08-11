export function isRuntimeDatabaseUrl(databaseUrl: string) {
  const username = decodeURIComponent(new URL(databaseUrl).username);
  return (
    username === "app_runtime" ||
    username.startsWith("app_runtime.")
  );
}

export function resolveRuntimeDatabaseUrl(options: {
  appEnvironment: "development" | "test" | "staging" | "production";
  databaseUrl: string;
  migrationUrl: string;
  runtimePassword: string;
}) {
  if (isRuntimeDatabaseUrl(options.databaseUrl)) {
    return options.databaseUrl;
  }

  if (options.appEnvironment !== "development") {
    throw new Error(
      "DATABASE_URL must authenticate as the restricted app_runtime role.",
    );
  }

  const runtimeUrl = new URL(options.migrationUrl);
  const migrationUsername = decodeURIComponent(runtimeUrl.username);
  const poolerSuffix = migrationUsername.includes(".")
    ? migrationUsername.slice(migrationUsername.indexOf("."))
    : "";
  runtimeUrl.username = `app_runtime${poolerSuffix}`;
  runtimeUrl.password = options.runtimePassword;
  return runtimeUrl.toString();
}
