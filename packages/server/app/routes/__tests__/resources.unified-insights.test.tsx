import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { loader } from "../resources.unified-insights";
import {
    cleanupFixtureDir,
    writeSnapshotFixture,
} from "./fixtures.unified";

vi.mock("~/lib/auth", () => ({
    requireAuth: vi.fn(),
}));

describe("resources.unified-insights loader", () => {
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

    test("returns only insights for the filtered market", async () => {
        const result = await loader({
            request: new Request(
                "https://example.com/resources/unified-insights?interval=30d&country=GH&traffic=human&site_group=all",
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

        expect(result.insights).toHaveLength(1);
        expect(result.insights[0].site).toBe("tirzepatideinghana.com");
    });
});
