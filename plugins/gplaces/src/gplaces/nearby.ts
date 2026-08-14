// Nearby search: ctx.fns.gplaces.nearby({ lat: 40.758, lng: -73.985, types: ["restaurant"] })
// Wraps POST /places:searchNearby. locationRestriction is a circle (lat/lng/radius).
// rank = "DISTANCE" | "POPULARITY". Returns compact place summaries.
const PRICE: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

/**
 * Reduces a Places API result to the public nearby-result shape.
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
 * Searches for places near geographic coordinates.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Centre latitude. */
        lat: number;
        /** Centre longitude. */
        lng: number;
        /** Search radius in metres. */
        radius?: number;
        /** Included Google place types. */
        types?: string[];
        /** Excluded Google place types. */
        excludeTypes?: string[];
        /** Response language code. */
        lang?: string;
        /** Maximum number of places to return. */
        max?: number;
        /** Result ranking strategy. */
        rank?: "DISTANCE" | "POPULARITY";
}) {
    if (opts?.lat === undefined || opts?.lng === undefined) throw new Error("lat and lng are required");
    const body: any = {
        locationRestriction: { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: opts.radius ?? 1000 } },
        languageCode: opts.lang ?? "en",
        maxResultCount: Math.min(opts.max ?? 10, 20),
        rankPreference: opts.rank ?? "DISTANCE",
    };
    if (opts.types?.length) body.includedTypes = opts.types;
    if (opts.excludeTypes?.length) body.excludedTypes = opts.excludeTypes;

    const fieldMask = [
        "places.id", "places.displayName", "places.formattedAddress", "places.shortFormattedAddress",
        "places.location", "places.rating", "places.userRatingCount", "places.priceLevel",
        "places.primaryType", "places.primaryTypeDisplayName", "places.currentOpeningHours", "places.googleMapsUri",
    ].join(",");

    const data = await ctx.fns.gplaces.api({ path: "/places:searchNearby", method: "POST", body, fieldMask });
    return (data.places ?? []).map(short);
}
