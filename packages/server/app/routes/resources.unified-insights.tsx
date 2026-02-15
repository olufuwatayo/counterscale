import type { LoaderFunctionArgs } from "react-router";

import { requireAuth } from "~/lib/auth";
import {
    filterInsights,
    filterSites,
    getIntervalDataOrThrow,
    getUnifiedFiltersFromSearchParams,
    isSnapshotStale,
    readUnifiedSnapshot,
    toResponseError,
} from "~/lib/unified-snapshot";
import type { UnifiedInsightsResponse } from "~/lib/unified-types";

export async function loader({ context, request }: LoaderFunctionArgs) {
    await requireAuth(request, context.cloudflare.env);

    try {
        const url = new URL(request.url);
        const filters = getUnifiedFiltersFromSearchParams(url.searchParams);

        const snapshot = await readUnifiedSnapshot();
        const intervalData = getIntervalDataOrThrow(snapshot, filters.interval);
        const sites = filterSites(intervalData.sites, filters);
        const insights = filterInsights(snapshot.insights || [], sites);

        const response: UnifiedInsightsResponse = {
            filters,
            stale: isSnapshotStale(snapshot.generated_at),
            generated_at: snapshot.generated_at,
            insights,
        };

        return response;
    } catch (error) {
        throw toResponseError(error);
    }
}
