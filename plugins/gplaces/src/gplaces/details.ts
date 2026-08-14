// Place details: ctx.fns.gplaces.details({ id: "ChIJ..." })
// Wraps GET /places/{id}. id may be "places/ChIJ..." or "ChIJ..." (prefix stripped).
// Returns full info: phone, website, hours, reviews (up to 5), photo names (up to 5).
// 404 (unknown id) -> returns null.
const PRICE: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

/**
 * Fetches details for a Google Place.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Google Place identifier or resource name. */
        id: string;
        /** Response language code. */
        lang?: string;
        /** Whether to include reviews. */
        reviews?: boolean;
        /** Whether to include photo metadata. */
        photos?: boolean;
}) {
    if (!opts?.id) throw new Error("id is required");
    const cleanId = opts.id.replace(/^places\//, "");
    const reviews = opts.reviews !== false;
    const photos = opts.photos !== false;

    const fields = [
        "id", "displayName", "formattedAddress", "shortFormattedAddress", "location",
        "rating", "userRatingCount", "priceLevel", "types", "primaryType", "primaryTypeDisplayName",
        "regularOpeningHours", "currentOpeningHours", "internationalPhoneNumber", "nationalPhoneNumber",
        "websiteUri", "googleMapsUri", "editorialSummary",
    ];
    if (reviews) fields.push("reviews");
    if (photos) fields.push("photos");

    let p: any;
    try {
        p = await ctx.fns.gplaces.api({
            path: `/places/${cleanId}`,
            method: "GET",
            fieldMask: fields.join(","),
            lang: opts.lang ?? "en",
        });
    } catch (e: any) {
        if (String(e?.message).includes("Places API 404")) return null;
        throw e;
    }

    return {
        id: p.id,
        name: p.displayName?.text,
        type: p.primaryTypeDisplayName?.text || p.primaryType,
        rating: p.rating,
        reviews: p.reviews?.slice(0, 5).map((r: any) => ({
            author: r.authorAttribution?.displayName,
            rating: r.rating,
            time: r.relativePublishTimeDescription,
            text: r.text?.text?.slice(0, 300),
        })),
        userRatingCount: p.userRatingCount,
        price: PRICE[p.priceLevel] || undefined,
        open: p.currentOpeningHours?.openNow,
        address: p.shortFormattedAddress || p.formattedAddress,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        maps: p.googleMapsUri,
        phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
        website: p.websiteUri,
        hours: p.regularOpeningHours?.weekdayDescriptions,
        summary: p.editorialSummary?.text,
        photos: p.photos?.slice(0, 5).map((ph: any) => ph.name),
    };
}
