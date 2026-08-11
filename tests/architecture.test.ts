import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const projectRoot = new URL("../", import.meta.url);

describe("standard Next.js architecture", () => {
  it("uses native Next.js scripts without Cloudflare runtime packages", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("package.json", projectRoot), "utf8"),
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.scripts.dev).toBe("next dev");
    expect(packageJson.scripts.build).toBe("next build");
    expect(packageJson.scripts.start).toBe("next start");

    const packageNames = new Set([
      ...Object.keys(packageJson.dependencies),
      ...Object.keys(packageJson.devDependencies),
    ]);

    expect(packageNames.has("vinext")).toBe(false);
    expect(packageNames.has("wrangler")).toBe(false);
    expect(packageNames.has("@cloudflare/vite-plugin")).toBe(false);
  });

  it("documents browser-safe and server-only Supabase credentials separately", async () => {
    const exampleEnvironment = await readFile(
      new URL(".env.example", projectRoot),
      "utf8",
    );

    expect(exampleEnvironment).toContain(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
    );
    expect(exampleEnvironment).toContain("SUPABASE_SECRET_KEY=");
    expect(exampleEnvironment).toContain("DATABASE_URL=");
    expect(exampleEnvironment).not.toContain(
      "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
    );
  });

  it("keeps coach pool opportunities notification-led without exposing earnings", async () => {
    const [shell, coachOverview, coachSections, coachLayout, lifecycle] =
      await Promise.all([
        readFile(new URL("components/portal/PortalShell.tsx", projectRoot), "utf8"),
        readFile(new URL("components/portal/CoachPortal.tsx", projectRoot), "utf8"),
        readFile(new URL("app/(portal)/coach/[section]/page.tsx", projectRoot), "utf8"),
        readFile(new URL("app/(portal)/coach/layout.tsx", projectRoot), "utf8"),
        readFile(new URL("lib/assignments/lifecycle.ts", projectRoot), "utf8"),
      ]);

    expect(shell).not.toContain('label: "Earnings"');
    expect(coachSections).not.toContain('"earnings"');
    expect(coachOverview).not.toContain('label="Opportunities"');
    expect(coachLayout).toContain("reconcileDueAssignmentLifecycles");
    expect(coachLayout).toContain("openPool.value > 0");
    expect(coachLayout).toContain('"/coach/opportunities": "warning"');
    expect(lifecycle).toContain('type: "assignment.pool_opportunity"');
    expect(lifecycle).toContain('actionUrl: "/coach/opportunities"');
  });

  it("locks coach service areas when the 30-day activation has expired", async () => {
    const protectedApiFiles = [
      "app/api/sessions/route.ts",
      "app/api/sessions/[sessionId]/route.ts",
      "app/api/sessions/[sessionId]/join/route.ts",
      "app/api/coaching-groups/route.ts",
      "app/api/group-sessions/[sessionId]/join/route.ts",
      "lib/group-coaching.ts",
    ];
    const [coachPortal, clientDetail, opportunityDetail, ...protectedApis] = await Promise.all([
      readFile(new URL("components/portal/CoachPortal.tsx", projectRoot), "utf8"),
      readFile(
        new URL("app/(portal)/coach/clients/[clientId]/page.tsx", projectRoot),
        "utf8",
      ),
      readFile(
        new URL("app/(portal)/coach/opportunities/[assignmentId]/page.tsx", projectRoot),
        "utf8",
      ),
      ...protectedApiFiles.map((file) =>
        readFile(new URL(file, projectRoot), "utf8"),
      ),
    ]);

    expect(coachPortal).toContain("hasCurrentCoachServiceAccess(profile)");
    expect(coachPortal).toContain('"clients", "opportunities", "switch-requests", "schedule", "groups"');
    expect(clientDetail).toContain("coachHasCurrentServiceAccess(coach.id)");
    expect(opportunityDetail).toContain("coachHasCurrentServiceAccess(coach.id)");
    for (const apiSource of protectedApis) {
      expect(apiSource).toContain("requireCurrentCoachServiceAccess");
    }
  });
});
