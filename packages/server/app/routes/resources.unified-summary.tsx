import type { LoaderFunctionArgs } from "react-router";

import { requireAuth } from "~/lib/auth";
import {
    computeSummaryTotals,
    filterSites,
    getIntervalDataOrThrow,
    getUnifiedFiltersFromSearchParams,
    isSnapshotStale,
    readUnifiedSnapshot,
    STALE_THRESHOLD_HOURS,
    toResponseError,
} from "~/lib/unified-snapshot";
import type { UnifiedSummaryResponse } from "~/lib/unified-types";

export async function loader({ context, request }: LoaderFunctionArgs) {
    await requireAuth(request, context.cloudflare.env);

    try {
        const url = new URL(request.url);
        const filters = getUnifiedFiltersFromSearchParams(url.searchParams);

        const snapshot = await readUnifiedSnapshot();
        const intervalData = getIntervalDataOrThrow(snapshot, filters.interval);
        const sites = filterSites(intervalData.sites, filters);
        const totals = computeSummaryTotals(sites);

        const response: UnifiedSummaryResponse = {
            filters,
            stale: isSnapshotStale(snapshot.generated_at),
            stale_after_hours: STALE_THRESHOLD_HOURS,
            generated_at: snapshot.generated_at,
            source_health: snapshot.source_health,
            totals,
        };

        return response;
    } catch (error) {
        throw toResponseError(error);
    }
}
