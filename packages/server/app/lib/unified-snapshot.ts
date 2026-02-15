import { readFile } from "node:fs/promises";

import type {
    UnifiedCountry,
    UnifiedFilters,
    UnifiedInsight,
    UnifiedInterval,
    UnifiedIntervalMetrics,
    UnifiedSiteGroup,
    UnifiedSiteMetrics,
    UnifiedSnapshot,
    UnifiedTraffic,
} from "~/lib/unified-types";

export const DEFAULT_UNIFIED_SNAPSHOT_PATH =
    "/Users/lol/ai/websites/pharmacy/tools/domain-setup/output/unified_snapshot.json";

export const DEFAULT_UNIFIED_FILTERS: UnifiedFilters = {
    interval: "30d",
    country: "NG",
    traffic: "human",
    site_group: "all",
};

export const STALE_THRESHOLD_HOURS = 8;

const VALID_INTERVALS = new Set<UnifiedInterval>(["7d", "30d", "90d"]);
const VALID_COUNTRIES = new Set<UnifiedCountry>(["NG", "GH", "ZW", "ALL"]);
const VALID_TRAFFIC = new Set<UnifiedTraffic>(["human", "all"]);
const VALID_SITE_GROUP = new Set<UnifiedSiteGroup>([
    "all",
    "drug-keyword",
    "lifestyle",
]);

const UNSUPPORTED_RUNTIME_MESSAGE =
    "Unified analytics is local-runtime only. Use Node dev/preview with filesystem access.";

export class UnifiedSnapshotError extends Error {
    status: number;
    code: string;

    constructor(code: string, status: number, message: string) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

export function isLocalNodeRuntime(): boolean {
    const hasNode =
        typeof process !== "undefined" &&
        typeof process.versions === "object" &&
        typeof process.versions.node === "string";

    const isLikelyWorkerRuntime =
        typeof (globalThis as Record<string, unknown>).WebSocketPair ===
        "function";

    return hasNode && !isLikelyWorkerRuntime;
}

export function getUnifiedSnapshotPath(): string {
    return process.env.UNIFIED_SNAPSHOT_PATH || DEFAULT_UNIFIED_SNAPSHOT_PATH;
}

function assertSnapshotShape(value: unknown): asserts value is UnifiedSnapshot {
    if (!value || typeof value !== "object") {
        throw new UnifiedSnapshotError(
            "invalid_snapshot",
            500,
            "Snapshot file does not contain a JSON object.",
        );
    }

    const snapshot = value as Partial<UnifiedSnapshot>;

    if (
        typeof snapshot.schema_version !== "number" ||
        !snapshot.generated_at ||
        typeof snapshot.generated_at !== "string" ||
        !snapshot.intervals ||
        typeof snapshot.intervals !== "object"
    ) {
        throw new UnifiedSnapshotError(
            "invalid_snapshot",
            500,
            "Snapshot file is missing required schema fields.",
        );
    }
}

export async function readUnifiedSnapshot(): Promise<UnifiedSnapshot> {
    if (!isLocalNodeRuntime()) {
        throw new UnifiedSnapshotError(
            "unsupported_runtime",
            503,
            UNSUPPORTED_RUNTIME_MESSAGE,
        );
    }

    const snapshotPath = getUnifiedSnapshotPath();

    let raw: string;
    try {
        raw = await readFile(snapshotPath, "utf-8");
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code === "ENOENT") {
            throw new UnifiedSnapshotError(
                "snapshot_missing",
                503,
                `Unified snapshot not found at ${snapshotPath}. Run unified_sync.py first.`,
            );
        }

        throw new UnifiedSnapshotError(
            "snapshot_read_failed",
            500,
            `Failed to read unified snapshot at ${snapshotPath}.`,
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new UnifiedSnapshotError(
            "snapshot_invalid_json",
            500,
            "Unified snapshot is not valid JSON.",
        );
    }

    assertSnapshotShape(parsed);
    return parsed;
}

function parseEnumParam<T extends string>(
    raw: string | null,
    allowed: Set<T>,
    fallback: T,
): T {
    if (!raw) {
        return fallback;
    }

    const candidate = raw as T;
    return allowed.has(candidate) ? candidate : fallback;
}

export function getUnifiedFiltersFromSearchParams(
    searchParams: URLSearchParams,
): UnifiedFilters {
    return {
        interval: parseEnumParam(
            searchParams.get("interval"),
            VALID_INTERVALS,
            DEFAULT_UNIFIED_FILTERS.interval,
        ),
        country: parseEnumParam(
            searchParams.get("country"),
            VALID_COUNTRIES,
            DEFAULT_UNIFIED_FILTERS.country,
        ),
        traffic: parseEnumParam(
            searchParams.get("traffic"),
            VALID_TRAFFIC,
            DEFAULT_UNIFIED_FILTERS.traffic,
        ),
        site_group: parseEnumParam(
            searchParams.get("site_group"),
            VALID_SITE_GROUP,
            DEFAULT_UNIFIED_FILTERS.site_group,
        ),
    };
}

export function needsDefaultFilterRedirect(searchParams: URLSearchParams): boolean {
    const defaults = getUnifiedFiltersFromSearchParams(searchParams);

    return (
        searchParams.get("interval") !== defaults.interval ||
        searchParams.get("country") !== defaults.country ||
        searchParams.get("traffic") !== defaults.traffic ||
        searchParams.get("site_group") !== defaults.site_group
    );
}

export function applyDefaultUnifiedFilters(url: URL): URL {
    const filters = getUnifiedFiltersFromSearchParams(url.searchParams);

    url.searchParams.set("interval", filters.interval);
    url.searchParams.set("country", filters.country);
    url.searchParams.set("traffic", filters.traffic);
    url.searchParams.set("site_group", filters.site_group);

    return url;
}

export function isSnapshotStale(generatedAt: string): boolean {
    const generatedMs = Date.parse(generatedAt);
    if (Number.isNaN(generatedMs)) {
        return true;
    }

    const maxAgeMs = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
    return Date.now() - generatedMs > maxAgeMs;
}

export function getIntervalDataOrThrow(
    snapshot: UnifiedSnapshot,
    interval: UnifiedInterval,
): UnifiedIntervalMetrics {
    const intervalData = snapshot.intervals[interval];

    if (!intervalData) {
        throw new UnifiedSnapshotError(
            "interval_missing",
            500,
            `Unified snapshot is missing the ${interval} interval.`,
        );
    }

    return intervalData;
}

function normalizeMarket(value: string): UnifiedCountry | "UNKNOWN" {
    const upper = value.toUpperCase();
    if (upper === "NG" || upper === "GH" || upper === "ZW") {
        return upper;
    }
    return "UNKNOWN";
}

function projectSiteByTraffic(
    site: UnifiedSiteMetrics,
    traffic: UnifiedTraffic,
): UnifiedSiteMetrics {
    if (traffic === "human") {
        return site;
    }

    const realUsersEstimate = Math.max(site.ga4.users || 0, site.counterscale.raw_visitors || 0);

    return {
        ...site,
        combined: {
            ...site.combined,
            real_users_estimate: realUsersEstimate,
        },
    };
}

export function filterSites(
    sites: UnifiedSiteMetrics[],
    filters: UnifiedFilters,
): UnifiedSiteMetrics[] {
    return sites
        .filter((site) => {
            const market = normalizeMarket(site.market);
            if (filters.country !== "ALL" && market !== filters.country) {
                return false;
            }

            if (
                filters.site_group !== "all" &&
                site.site_group !== filters.site_group
            ) {
                return false;
            }

            return true;
        })
        .map((site) => projectSiteByTraffic(site, filters.traffic));
}

export function computeSummaryTotals(sites: UnifiedSiteMetrics[]): {
    real_users: number;
    nigeria_share: number;
    mobile_share: number;
    search_clicks: number;
    search_impressions: number;
    avg_position: number;
    site_count: number;
} {
    const realUsers = sites.reduce(
        (sum, site) => sum + (site.combined.real_users_estimate || 0),
        0,
    );

    const totalGa4Users = sites.reduce((sum, site) => sum + (site.ga4.users || 0), 0);
    const weightedNigeriaShare = sites.reduce(
        (sum, site) => sum + (site.combined.nigeria_share || 0) * (site.ga4.users || 0),
        0,
    );
    const weightedMobileShare = sites.reduce(
        (sum, site) => sum + (site.combined.mobile_share || 0) * (site.ga4.users || 0),
        0,
    );

    const searchClicks = sites.reduce((sum, site) => sum + (site.gsc.clicks || 0), 0);
    const searchImpressions = sites.reduce(
        (sum, site) => sum + (site.gsc.impressions || 0),
        0,
    );
    const weightedPosition = sites.reduce(
        (sum, site) => sum + (site.gsc.position || 0) * (site.gsc.impressions || 0),
        0,
    );

    return {
        real_users: realUsers,
        nigeria_share: totalGa4Users > 0 ? weightedNigeriaShare / totalGa4Users : 0,
        mobile_share: totalGa4Users > 0 ? weightedMobileShare / totalGa4Users : 0,
        search_clicks: searchClicks,
        search_impressions: searchImpressions,
        avg_position: searchImpressions > 0 ? weightedPosition / searchImpressions : 0,
        site_count: sites.length,
    };
}

export function filterInsights(
    insights: UnifiedInsight[],
    filteredSites: UnifiedSiteMetrics[],
): UnifiedInsight[] {
    const siteSet = new Set(filteredSites.map((site) => site.domain));
    return insights.filter((insight) => siteSet.has(insight.site));
}

export function toResponseError(error: unknown): Response {
    if (error instanceof Response) {
        return error;
    }

    if (error instanceof UnifiedSnapshotError) {
        return new Response(
            JSON.stringify({
                error: error.code,
                message: error.message,
            }),
            {
                status: error.status,
                headers: {
                    "content-type": "application/json",
                },
            },
        );
    }

    return new Response(
        JSON.stringify({
            error: "internal_error",
            message: "Unexpected error while loading unified analytics.",
        }),
        {
            status: 500,
            headers: {
                "content-type": "application/json",
            },
        },
    );
}
