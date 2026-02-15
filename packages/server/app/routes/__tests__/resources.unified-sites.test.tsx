import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { loader } from "../resources.unified-sites";
import {
    cleanupFixtureDir,
    writeSnapshotFixture,
} from "./fixtures.unified";

vi.mock("~/lib/auth", () => ({
    requireAuth: vi.fn(),
}));

describe("resources.unified-sites loader", () => {
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

        delete (globalThis as any).WebSocketPair;
        vi.restoreAllMocks();
    });

    test("filters by country and site_group", async () => {
        const result = await loader({
            request: new Request(
                "https://example.com/resources/unified-sites?interval=30d&country=GH&traffic=human&site_group=drug-keyword",
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

        expect(result.sites).toHaveLength(1);
        expect(result.sites[0].domain).toBe("tirzepatideinghana.com");
    });

    test("returns 503 in unsupported runtime", async () => {
        (globalThis as any).WebSocketPair = () => {};

        try {
            await loader({
                request: new Request(
                    "https://example.com/resources/unified-sites?interval=30d&country=ALL&traffic=human&site_group=all",
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
            expect(payload.error).toBe("unsupported_runtime");
        }
    });
});
