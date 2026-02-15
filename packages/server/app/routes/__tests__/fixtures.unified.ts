import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { UnifiedSnapshot } from "~/lib/unified-types";

export function buildSnapshotFixture(): UnifiedSnapshot {
    return {
        schema_version: 1,
        generated_at: "2026-02-15T10:00:00Z",
        generator_version: "v2.0.0",
        run_duration_ms: 1200,
        site_count_total: 2,
        site_count_complete: 2,
        site_count_partial: 0,
        source_health: {
            ga4: {
                status: "ok",
                checked_at: "2026-02-15T10:00:00Z",
                error_count: 0,
                last_error: null,
            },
            gsc: {
                status: "ok",
                checked_at: "2026-02-15T10:00:00Z",
                error_count: 0,
                last_error: null,
            },
            counterscale: {
                status: "ok",
                checked_at: "2026-02-15T10:00:00Z",
                error_count: 0,
                last_error: null,
            },
        },
        intervals: {
            "30d": {
                totals: {
                    real_users: 0,
                    nigeria_share: 0,
                    mobile_share: 0,
                    search_clicks: 0,
                    search_impressions: 0,
                    avg_position: 0,
                },
                sites: [
                    {
                        domain: "naijatrim.com",
                        market: "NG",
                        timezone: "Africa/Lagos",
                        site_group: "drug-keyword",
                        ids: {
                            ga4_property_id: "123",
                            gsc_site_url: "https://naijatrim.com/",
                            counterscale_site_id: "naijatrim",
                        },
                        ga4: {
                            status: "ok",
                            users: 100,
                            sessions: 140,
                            new_users: 20,
                            pageviews: 220,
                            avg_duration: 45,
                            bounce_rate: 0.35,
                            device_mix: { mobile: 100, desktop: 40 },
                            country_mix: { Nigeria: 90, Ghana: 10 },
                            date_series: [],
                        },
                        gsc: {
                            status: "ok",
                            clicks: 60,
                            impressions: 1200,
                            ctr: 0.05,
                            position: 18.2,
                            device_mix: { MOBILE: 40, DESKTOP: 20 },
                            country_mix: { NG: 50, GH: 10 },
                            date_series: [],
                            top_queries: [
                                {
                                    query: "naija trim",
                                    clicks: 10,
                                    impressions: 100,
                                    ctr: 0.1,
                                    position: 8,
                                },
                            ],
                        },
                        counterscale: {
                            status: "ok",
                            raw_visitors: 220,
                            raw_views: 300,
                            human_visitors: 150,
                            human_views: 230,
                            device_mix: { mobile: 100, desktop: 50 },
                            country_mix: { NG: 120, GH: 30 },
                            top_referrers: [
                                { referrer: "google.com", count: 55 },
                            ],
                            date_series: [],
                        },
                        combined: {
                            real_users_estimate: 150,
                            nigeria_share: 0.9,
                            mobile_share: 0.714,
                            trend_7d: 0.2,
                            quality_flags: [],
                            search_clicks: 60,
                            search_impressions: 1200,
                        },
                        errors: [],
                    },
                    {
                        domain: "tirzepatideinghana.com",
                        market: "GH",
                        timezone: "Africa/Accra",
                        site_group: "drug-keyword",
                        ids: {
                            ga4_property_id: "456",
                            gsc_site_url: "https://tirzepatideinghana.com/",
                            counterscale_site_id: "tirzepatideinghana",
                        },
                        ga4: {
                            status: "ok",
                            users: 40,
                            sessions: 70,
                            new_users: 15,
                            pageviews: 90,
                            avg_duration: 35,
                            bounce_rate: 0.45,
                            device_mix: { mobile: 30, desktop: 40 },
                            country_mix: { Ghana: 35, Nigeria: 5 },
                            date_series: [],
                        },
                        gsc: {
                            status: "ok",
                            clicks: 25,
                            impressions: 800,
                            ctr: 0.03125,
                            position: 22,
                            device_mix: { MOBILE: 18, DESKTOP: 7 },
                            country_mix: { GH: 23, NG: 2 },
                            date_series: [],
                            top_queries: [],
                        },
                        counterscale: {
                            status: "ok",
                            raw_visitors: 65,
                            raw_views: 90,
                            human_visitors: 45,
                            human_views: 70,
                            device_mix: { mobile: 25, desktop: 20 },
                            country_mix: { GH: 40, NG: 5 },
                            top_referrers: [],
                            date_series: [],
                        },
                        combined: {
                            real_users_estimate: 45,
                            nigeria_share: 0.125,
                            mobile_share: 0.428,
                            trend_7d: -0.1,
                            quality_flags: [],
                            search_clicks: 25,
                            search_impressions: 800,
                        },
                        errors: [],
                    },
                ],
            },
            "7d": {
                totals: {
                    real_users: 0,
                    nigeria_share: 0,
                    mobile_share: 0,
                    search_clicks: 0,
                    search_impressions: 0,
                    avg_position: 0,
                },
                sites: [],
            },
            "90d": {
                totals: {
                    real_users: 0,
                    nigeria_share: 0,
                    mobile_share: 0,
                    search_clicks: 0,
                    search_impressions: 0,
                    avg_position: 0,
                },
                sites: [],
            },
        },
        insights: [
            {
                site: "naijatrim.com",
                severity: "warning",
                title: "Low CTR despite demand",
                evidence: { ctr: 0.05, impressions: 1200 },
                recommended_action: "Improve snippets",
            },
            {
                site: "tirzepatideinghana.com",
                severity: "opportunity",
                title: "Traffic is growing",
                evidence: { trend_7d: 0.2 },
                recommended_action: "Scale content",
            },
        ],
    };
}

export async function writeSnapshotFixture(snapshot?: UnifiedSnapshot): Promise<{
    dir: string;
    filePath: string;
}> {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "unified-snapshot-test-"));
    const filePath = path.join(tmpDir, "unified_snapshot.json");
    const payload = snapshot || buildSnapshotFixture();
    await writeFile(filePath, JSON.stringify(payload), "utf-8");
    return { dir: tmpDir, filePath };
}

export async function cleanupFixtureDir(dir: string) {
    await rm(dir, { recursive: true, force: true });
}
