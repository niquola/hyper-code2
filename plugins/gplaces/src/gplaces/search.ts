// Text search for places: ctx.fns.gplaces.search({ query: "pharmacy in Cascais", max: 10 })
// Wraps POST /places:searchText. Optional location bias (lat/lng/radius), type filter,
// openNow, minRating, region. Returns compact place summaries.
const PRICE: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

/**
 * Reduces a Places API result to the public search-result shape.
 *
 * @param p - Raw Google Places result.
 * @returns Selected place summary fields.
 */
function short(p: any) {
    return {
        id: p.id,
        name: p.displayName?.text,
        type: p.primaryTypeDisplayName?.text || p.primaryType,
        rating: p.rating,
        reviews: p.userRatingCount,
        price: PRICE[p.priceLevel] || undefined,
        open: p.currentOpeningHours?.openNow,
        address: p.shortFormattedAddress || p.formattedAddress,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        maps: p.googleMapsUri,
    };
}

/**
 * Searches Google Places using a text query.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Place search query. */
        query: string;
        /** Response language code. */
        lang?: string;
        /** Region code used to bias results. */
        region?: string;
        /** Maximum number of places to return. */
        max?: number;
        /** Latitude used for location bias. */
        lat?: number;
        /** Longitude used for location bias. */
        lng?: number;
        /** Location-bias radius in metres. */
        radius?: number;
        /** Google place type filter. */
        type?: string;
        /** Whether to return only places currently open. */
        openNow?: boolean;
        /** Minimum accepted user rating. */
        minRating?: number;
}) {
    if (!opts?.query) throw new Error("query is required");
    const body: any = {
        textQuery: opts.query,
        languageCode: opts.lang ?? "en",
        maxResultCount: Math.min(opts.max ?? 10, 20),
    };
    if (opts.region) body.regionCode = opts.region;
    if (opts.type) body.includedType = opts.type;
    if (opts.openNow) body.openNow = true;
    if (opts.minRating) body.minRating = opts.minRating;
    if (opts.lat !== undefined && opts.lng !== undefined) {
        body.locationBias = { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: opts.radius ?? 5000 } };
    }

    const fieldMask = [
        "places.id", "places.displayName", "places.formattedAddress", "places.shortFormattedAddress",
        "places.location", "places.rating", "places.userRatingCount", "places.priceLevel",
        "places.primaryType", "places.primaryTypeDisplayName", "places.currentOpeningHours", "places.googleMapsUri",
    ].join(",");

    const data = await ctx.fns.gplaces.api({ path: "/places:searchText", method: "POST", body, fieldMask });
    return (data.places ?? []).map(short);
}
