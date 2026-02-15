import { describe, expect, test, vi } from "vitest";

import { loader, sortPortfolioSites } from "../portfolio";
import { buildSnapshotFixture } from "./fixtures.unified";

vi.mock("~/lib/auth", () => ({
    requireAuth: vi.fn(),
}));

describe("portfolio route", () => {
    test("loader redirects to default filter params", async () => {
        try {
            await loader({
                request: new Request("https://example.com/portfolio"),
                context: {
                    cloudflare: {
                        env: {
                            CF_PASSWORD_HASH: "$2b$12$test.hash.value",
                            CF_JWT_SECRET: "test-secret",
                        },
                    },
                },
            } as any);
            throw new Error("Expected loader to redirect");
        } catch (error) {
            expect(error).toBeInstanceOf(Response);
            const response = error as Response;
            expect(response.status).toBe(302);
            expect(response.headers.get("Location")).toContain(
                "interval=30d",
            );
            expect(response.headers.get("Location")).toContain("country=NG");
            expect(response.headers.get("Location")).toContain(
                "traffic=human",
            );
            expect(response.headers.get("Location")).toContain(
                "site_group=all",
            );
        }
    });

    test("sortPortfolioSites sorts table rows by selected metric", () => {
        const fixture = buildSnapshotFixture();
        const sites = fixture.intervals["30d"]?.sites || [];

        const sorted = sortPortfolioSites(sites, "ga4_sessions", "desc");

        expect(sorted[0].domain).toBe("naijatrim.com");
        expect(sorted[1].domain).toBe("tirzepatideinghana.com");
    });
});
