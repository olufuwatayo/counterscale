import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import {
    redirect,
    useFetcher,
    useLoaderData,
    useSearchParams,
} from "react-router";
import { Fragment, useEffect, useMemo, useState } from "react";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { requireAuth } from "~/lib/auth";
import {
    applyDefaultUnifiedFilters,
    getUnifiedFiltersFromSearchParams,
    needsDefaultFilterRedirect,
} from "~/lib/unified-snapshot";
import type { UnifiedSiteMetrics } from "~/lib/unified-types";
import type { loader as insightsLoader } from "~/routes/resources.unified-insights";
import type { loader as sitesLoader } from "~/routes/resources.unified-sites";
import type { loader as summaryLoader } from "~/routes/resources.unified-summary";

export const meta: MetaFunction = () => {
    return [
        { title: "Portfolio | Counterscale" },
        { name: "description", content: "Unified portfolio analytics" },
    ];
};

export async function loader({ context, request }: LoaderFunctionArgs) {
    await requireAuth(request, context.cloudflare.env);

    const url = new URL(request.url);
    if (needsDefaultFilterRedirect(url.searchParams)) {
        throw redirect(applyDefaultUnifiedFilters(url).toString());
    }

    return {
        filters: getUnifiedFiltersFromSearchParams(url.searchParams),
    };
}

type SortDirection = "asc" | "desc";
type PortfolioSortKey =
    | "domain"
    | "market"
    | "ga4_sessions"
    | "ga4_users"
    | "mobile_share"
    | "gsc_clicks"
    | "gsc_impressions"
    | "gsc_ctr"
    | "gsc_position"
    | "cs_visitors"
    | "nigeria_share";

function getSortValue(site: UnifiedSiteMetrics, sortKey: PortfolioSortKey): number | string {
    switch (sortKey) {
        case "domain":
            return site.domain;
        case "market":
            return site.market;
        case "ga4_sessions":
            return site.ga4.sessions || 0;
        case "ga4_users":
            return site.ga4.users || 0;
        case "mobile_share":
            return site.combined.mobile_share || 0;
        case "gsc_clicks":
            return site.gsc.clicks || 0;
        case "gsc_impressions":
            return site.gsc.impressions || 0;
        case "gsc_ctr":
            return site.gsc.ctr || 0;
        case "gsc_position":
            return site.gsc.position || 0;
        case "cs_visitors":
            return site.counterscale.human_visitors || 0;
        case "nigeria_share":
            return site.combined.nigeria_share || 0;
    }
}

export function sortPortfolioSites(
    sites: UnifiedSiteMetrics[],
    sortKey: PortfolioSortKey,
    direction: SortDirection,
): UnifiedSiteMetrics[] {
    const sorted = [...sites].sort((a, b) => {
        const left = getSortValue(a, sortKey);
        const right = getSortValue(b, sortKey);

        if (typeof left === "string" && typeof right === "string") {
            return left.localeCompare(right);
        }

        return Number(left) - Number(right);
    });

    return direction === "asc" ? sorted : sorted.reverse();
}

function formatCompact(value: number | undefined): string {
    return Intl.NumberFormat("en", { notation: "compact" }).format(value || 0);
}

function formatPercent(value: number | undefined): string {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatTrend(value: number | undefined): string {
    const trend = value || 0;
    const prefix = trend > 0 ? "+" : "";
    return `${prefix}${(trend * 100).toFixed(1)}%`;
}

function formatGeneratedAt(value: string | undefined): string {
    if (!value) {
        return "unknown";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "unknown";
    }

    return date.toLocaleString();
}

function toTopEntries(map: Record<string, number>, max = 5): Array<[string, number]> {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max);
}

function SortableHeader({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <th className="p-2 text-left">
            <button className="underline" type="button" onClick={onClick}>
                {label}
            </button>
        </th>
    );
}

export default function Portfolio() {
    const data = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = useMemo(
        () => getUnifiedFiltersFromSearchParams(searchParams),
        [searchParams],
    );

    const summaryFetcher = useFetcher<typeof summaryLoader>();
    const sitesFetcher = useFetcher<typeof sitesLoader>();
    const insightsFetcher = useFetcher<typeof insightsLoader>();

    useEffect(() => {
        const requestFilters = {
            interval: filters.interval,
            country: filters.country,
            traffic: filters.traffic,
            site_group: filters.site_group,
        };

        summaryFetcher.submit(requestFilters, {
            method: "get",
            action: "/resources/unified-summary",
        });
        sitesFetcher.submit(requestFilters, {
            method: "get",
            action: "/resources/unified-sites",
        });
        insightsFetcher.submit(requestFilters, {
            method: "get",
            action: "/resources/unified-insights",
        });
        // data fetchers are intentionally omitted from deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.interval, filters.country, filters.traffic, filters.site_group]);

    const [sortKey, setSortKey] = useState<PortfolioSortKey>("ga4_sessions");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [expandedSite, setExpandedSite] = useState<string | null>(null);

    const sites = sitesFetcher.data?.sites || [];
    const sortedSites = useMemo(
        () => sortPortfolioSites(sites, sortKey, sortDirection),
        [sites, sortKey, sortDirection],
    );

    const summary = summaryFetcher.data?.totals;
    const insights = (insightsFetcher.data?.insights || []).slice(0, 5);
    const stale =
        summaryFetcher.data?.stale ||
        sitesFetcher.data?.stale ||
        insightsFetcher.data?.stale ||
        false;

    const generatedAt =
        summaryFetcher.data?.generated_at ||
        sitesFetcher.data?.generated_at ||
        insightsFetcher.data?.generated_at;

    function updateFilter(key: string, value: string) {
        setSearchParams((prev) => {
            prev.set(key, value);
            return prev;
        });
    }

    function onSort(next: PortfolioSortKey) {
        if (sortKey === next) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            return;
        }

        setSortKey(next);
        setSortDirection(next === "domain" || next === "market" ? "asc" : "desc");
    }

    return (
        <div className="space-y-4" style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.7" }}>
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[140px]">
                    <Select
                        value={filters.interval}
                        onValueChange={(value) => updateFilter("interval", value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Interval" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">7d</SelectItem>
                            <SelectItem value="30d">30d</SelectItem>
                            <SelectItem value="90d">90d</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-w-[160px]">
                    <Select
                        value={filters.country}
                        onValueChange={(value) => updateFilter("country", value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NG">Nigeria</SelectItem>
                            <SelectItem value="GH">Ghana</SelectItem>
                            <SelectItem value="ZW">Zimbabwe</SelectItem>
                            <SelectItem value="ALL">All</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-w-[150px]">
                    <Select
                        value={filters.traffic}
                        onValueChange={(value) => updateFilter("traffic", value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Traffic" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="human">Human</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-w-[170px]">
                    <Select
                        value={filters.site_group}
                        onValueChange={(value) => updateFilter("site_group", value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Site Group" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="drug-keyword">Drug-keyword</SelectItem>
                            <SelectItem value="lifestyle">Lifestyle</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="ml-auto text-sm text-gray-600">
                    Snapshot: {formatGeneratedAt(generatedAt)}
                </div>
            </div>

            {stale ? (
                <Card className="border-yellow-600 bg-yellow-50">
                    <CardContent className="pt-4 text-sm text-yellow-900">
                        Snapshot is older than 8 hours. Run unified sync to refresh data.
                    </CardContent>
                </Card>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Real Users</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl">{formatCompact(summary?.real_users)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Nigeria Share</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl">{formatPercent(summary?.nigeria_share)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Mobile Share</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl">{formatPercent(summary?.mobile_share)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Search Clicks</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl">{formatCompact(summary?.search_clicks)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Search Impressions</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl">{formatCompact(summary?.search_impressions)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Avg Position</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl">{(summary?.avg_position || 0).toFixed(1)}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Smart Insights</CardTitle>
                </CardHeader>
                <CardContent>
                    {insights.length === 0 ? (
                        <div className="text-sm text-gray-600">No insights for current filters.</div>
                    ) : (
                        <ul className="space-y-2">
                            {insights.map((item, idx) => (
                                <li key={`${item.site}-${idx}`} className="rounded border p-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="rounded bg-gray-200 px-2 py-0.5 uppercase">
                                            {item.severity}
                                        </span>
                                        <strong>{item.site}</strong>
                                    </div>
                                    <div className="mt-1 text-sm">{item.title}</div>
                                    <div className="mt-1 text-xs text-gray-600">
                                        {item.recommended_action}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Brand Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    <SortableHeader label="Brand" onClick={() => onSort("domain")} />
                                    <SortableHeader label="Market" onClick={() => onSort("market")} />
                                    <SortableHeader label="GA4 Sessions" onClick={() => onSort("ga4_sessions")} />
                                    <SortableHeader label="GA4 Users" onClick={() => onSort("ga4_users")} />
                                    <SortableHeader label="Mobile%" onClick={() => onSort("mobile_share")} />
                                    <SortableHeader label="GSC Clicks" onClick={() => onSort("gsc_clicks")} />
                                    <SortableHeader label="GSC Impr." onClick={() => onSort("gsc_impressions")} />
                                    <SortableHeader label="CTR" onClick={() => onSort("gsc_ctr")} />
                                    <SortableHeader label="Position" onClick={() => onSort("gsc_position")} />
                                    <SortableHeader label="CS Visitors" onClick={() => onSort("cs_visitors")} />
                                    <SortableHeader label="Nigeria%" onClick={() => onSort("nigeria_share")} />
                                    <th className="p-2">Trend 7d</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSites.map((site) => {
                                    const csVisitors =
                                        filters.traffic === "human"
                                            ? site.counterscale.human_visitors
                                            : site.counterscale.raw_visitors;

                                    const isExpanded = expandedSite === site.domain;

                                    return (
                                        <Fragment key={site.domain}>
                                            <tr
                                                className="border-b hover:bg-gray-50"
                                            >
                                                <td className="p-2">
                                                    <button
                                                        type="button"
                                                        className="text-left font-medium underline"
                                                        onClick={() =>
                                                            setExpandedSite((prev) =>
                                                                prev === site.domain
                                                                    ? null
                                                                    : site.domain,
                                                            )
                                                        }
                                                    >
                                                        {site.domain}
                                                    </button>
                                                </td>
                                                <td className="p-2">{site.market}</td>
                                                <td className="p-2">{formatCompact(site.ga4.sessions)}</td>
                                                <td className="p-2">{formatCompact(site.ga4.users)}</td>
                                                <td className="p-2">{formatPercent(site.combined.mobile_share)}</td>
                                                <td className="p-2">{formatCompact(site.gsc.clicks)}</td>
                                                <td className="p-2">{formatCompact(site.gsc.impressions)}</td>
                                                <td className="p-2">{formatPercent(site.gsc.ctr)}</td>
                                                <td className="p-2">{site.gsc.position.toFixed(1)}</td>
                                                <td className="p-2">{formatCompact(csVisitors)}</td>
                                                <td className="p-2">{formatPercent(site.combined.nigeria_share)}</td>
                                                <td className="p-2">{formatTrend(site.combined.trend_7d)}</td>
                                            </tr>

                                            {isExpanded ? (
                                                <tr className="border-b bg-gray-50">
                                                    <td className="p-3" colSpan={12}>
                                                        <div className="grid gap-4 md:grid-cols-2">
                                                            <div>
                                                                <div className="mb-2 text-xs font-semibold uppercase text-gray-600">
                                                                    Country Mix (GA4 users)
                                                                </div>
                                                                <ul className="space-y-1 text-sm">
                                                                    {toTopEntries(site.ga4.country_mix).map(
                                                                        ([label, value]) => (
                                                                            <li key={`${site.domain}-country-${label}`}>
                                                                                {label}: {formatCompact(value)}
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>

                                                                <div className="mb-2 mt-4 text-xs font-semibold uppercase text-gray-600">
                                                                    Device Mix (GA4 sessions)
                                                                </div>
                                                                <ul className="space-y-1 text-sm">
                                                                    {toTopEntries(site.ga4.device_mix).map(
                                                                        ([label, value]) => (
                                                                            <li key={`${site.domain}-device-${label}`}>
                                                                                {label}: {formatCompact(value)}
                                                                            </li>
                                                                        ),
                                                                    )}
                                                                </ul>
                                                            </div>

                                                            <div>
                                                                <div className="mb-2 text-xs font-semibold uppercase text-gray-600">
                                                                    Top Queries (GSC)
                                                                </div>
                                                                <ul className="space-y-1 text-sm">
                                                                    {site.gsc.top_queries.slice(0, 5).map((query, idx) => (
                                                                        <li key={`${site.domain}-query-${idx}`}>
                                                                            {query.query || "(unknown)"}: {formatCompact(query.clicks)} clicks
                                                                        </li>
                                                                    ))}
                                                                </ul>

                                                                <div className="mb-2 mt-4 text-xs font-semibold uppercase text-gray-600">
                                                                    Top Referrers (Counterscale)
                                                                </div>
                                                                <ul className="space-y-1 text-sm">
                                                                    {site.counterscale.top_referrers
                                                                        .slice(0, 5)
                                                                        .map((referrer, idx) => (
                                                                            <li key={`${site.domain}-ref-${idx}`}>
                                                                                {referrer.referrer || "(direct)"}: {formatCompact(referrer.count)}
                                                                            </li>
                                                                        ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="text-xs text-gray-500">
                Defaults: interval={data.filters.interval}, country={data.filters.country}, traffic={data.filters.traffic}
            </div>
        </div>
    );
}
