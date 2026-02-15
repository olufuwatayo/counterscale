import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { loader } from "../resources.unified-summary";
import {
    cleanupFixtureDir,
    writeSnapshotFixture,
} from "./fixtures.unified";

vi.mock("~/lib/auth", () => ({
    requireAuth: vi.fn(),
}));

describe("resources.unified-summary loader", () => {
    let tmpDir: string | null = null;
    let priorPath: string | undefined;

    beforeEach(async () => {
        priorPath = process.env.UNIFIED_SNAPSHOT_PATH;
        const fixture = await writeSnapshotFixture();
        tmpDir = fixture.dir;
        process.env.UNIFIED_SNAPSHOT_PATH = fixture.filePath;
    });

    afterEach(async () => {
        if (priorPath) {
            process.env.UNIFIED_SNAPSHOT_PATH = priorPath;
        } else {
            delete process.env.UNIFIED_SNAPSHOT_PATH;
        }

        if (tmpDir) {
            await cleanupFixtureDir(tmpDir);
            tmpDir = null;
        }

        vi.restoreAllMocks();
    });

    test("returns Nigeria-filtered summary totals by default params", async () => {
        const result = await loader({
            request: new Request(
                "https://example.com/resources/unified-summary?interval=30d&country=NG&traffic=human&site_group=all",
            ),
            context: {
                cloudflare: {
                    env: {
                        CF_PASSWORD_HASH: "$2b$12$test.hash.value",
                        CF_JWT_SECRET: "test-secret",
                    },
                },
            },
        } as any);

        expect(result.filters.country).toBe("NG");
        expect(result.totals.site_count).toBe(1);
        expect(result.totals.real_users).toBe(150);
    });

    test("supports traffic=all by using raw counterscale visitors in estimate", async () => {
        const result = await loader({
            request: new Request(
                "https://example.com/resources/unified-summary?interval=30d&country=NG&traffic=all&site_group=all",
            ),
            context: {
                cloudflare: {
                    env: {
                        CF_PASSWORD_HASH: "$2b$12$test.hash.value",
                        CF_JWT_SECRET: "test-secret",
                    },
                },
            },
        } as any);

        expect(result.totals.real_users).toBe(220);
    });

    test("returns typed error payload when snapshot is missing", async () => {
        if (tmpDir) {
            await cleanupFixtureDir(tmpDir);
            tmpDir = null;
        }
        process.env.UNIFIED_SNAPSHOT_PATH = "/tmp/does-not-exist-snapshot.json";

        try {
            await loader({
                request: new Request(
                    "https://example.com/resources/unified-summary?interval=30d&country=NG&traffic=human&site_group=all",
                ),
                context: {
                    cloudflare: {
                        env: {
                            CF_PASSWORD_HASH: "$2b$12$test.hash.value",
                            CF_JWT_SECRET: "test-secret",
                        },
                    },
                },
            } as any);
            throw new Error("Expected loader to throw");
        } catch (error) {
            expect(error).toBeInstanceOf(Response);
            const response = error as Response;
            expect(response.status).toBe(503);
            const payload = (await response.json()) as { error: string };
            expect(payload.error).toBe("snapshot_missing");
        }
    });
});
