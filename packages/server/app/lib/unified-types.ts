export type UnifiedInterval = "7d" | "30d" | "90d";
export type UnifiedCountry = "NG" | "GH" | "ZW" | "ALL";
export type UnifiedTraffic = "human" | "all";
export type UnifiedSiteGroup = "all" | "drug-keyword" | "lifestyle";
export type UnifiedSourceStatus = "ok" | "degraded" | "failed";

export interface UnifiedFilters {
    interval: UnifiedInterval;
    country: UnifiedCountry;
    traffic: UnifiedTraffic;
    site_group: UnifiedSiteGroup;
}

export interface UnifiedSourceHealth {
    status: UnifiedSourceStatus;
    checked_at: string;
    error_count: number;
    last_error: string | null;
}

export interface UnifiedIDSet {
    ga4_property_id: string | null;
    gsc_site_url: string | null;
    counterscale_site_id: string | null;
}

export interface UnifiedGA4Metrics {
    status: UnifiedSourceStatus;
    error?: string | null;
    users: number;
    sessions: number;
    new_users: number;
    pageviews: number;
    avg_duration: number;
    bounce_rate: number;
    device_mix: Record<string, number>;
    country_mix: Record<string, number>;
    date_series: Array<Record<string, number | string>>;
}

export interface UnifiedGSCMetrics {
    status: UnifiedSourceStatus;
    error?: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    device_mix: Record<string, number>;
    country_mix: Record<string, number>;
    date_series: Array<Record<string, number | string>>;
    top_queries: Array<{
        query: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
    }>;
}

export interface UnifiedCounterscaleMetrics {
    status: UnifiedSourceStatus;
    error?: string | null;
    raw_visitors: number;
    raw_views: number;
    human_visitors: number;
    human_views: number;
    device_mix: Record<string, number>;
    country_mix: Record<string, number>;
    top_referrers: Array<{
        referrer: string;
        count: number;
    }>;
    date_series: Array<Record<string, number | string>>;
}

export interface UnifiedCombinedMetrics {
    real_users_estimate: number;
    nigeria_share: number;
    mobile_share: number;
    trend_7d: number;
    quality_flags: string[];
    search_clicks: number;
    search_impressions: number;
}

export interface UnifiedSiteMetrics {
    domain: string;
    market: string;
    timezone: string;
    site_group: string;
    ids: UnifiedIDSet;
    ga4: UnifiedGA4Metrics;
    gsc: UnifiedGSCMetrics;
    counterscale: UnifiedCounterscaleMetrics;
    combined: UnifiedCombinedMetrics;
    errors: string[];
}

export interface UnifiedIntervalMetrics {
    totals: {
        real_users: number;
        nigeria_share: number;
        mobile_share: number;
        search_clicks: number;
        search_impressions: number;
        avg_position: number;
    };
    sites: UnifiedSiteMetrics[];
}

export interface UnifiedInsight {
    site: string;
    severity: "critical" | "warning" | "opportunity";
    title: string;
    evidence: Record<string, number | string>;
    recommended_action: string;
}

export interface UnifiedSnapshot {
    schema_version: number;
    generated_at: string;
    generator_version: string;
    run_duration_ms: number;
    site_count_total: number;
    site_count_complete: number;
    site_count_partial: number;
    source_health: {
        ga4: UnifiedSourceHealth;
        gsc: UnifiedSourceHealth;
        counterscale: UnifiedSourceHealth;
    };
    intervals: Partial<Record<UnifiedInterval, UnifiedIntervalMetrics>>;
    insights: UnifiedInsight[];
}

export interface UnifiedSummaryResponse {
    filters: UnifiedFilters;
    stale: boolean;
    stale_after_hours: number;
    generated_at: string;
    source_health: UnifiedSnapshot["source_health"];
    totals: {
        real_users: number;
        nigeria_share: number;
        mobile_share: number;
        search_clicks: number;
        search_impressions: number;
        avg_position: number;
        site_count: number;
    };
}

export interface UnifiedSitesResponse {
    filters: UnifiedFilters;
    stale: boolean;
    generated_at: string;
    sites: UnifiedSiteMetrics[];
}

export interface UnifiedInsightsResponse {
    filters: UnifiedFilters;
    stale: boolean;
    generated_at: string;
    insights: UnifiedInsight[];
}
