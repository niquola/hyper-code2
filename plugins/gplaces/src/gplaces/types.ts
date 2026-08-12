// Reference list of common Place types grouped by category, for use as `type`/`types`
// args in search()/nearby(). ctx.fns.gplaces.types({}) -> { food: [...], ... }
const PLACE_TYPES = {
    food: ["restaurant", "cafe", "bakery", "bar", "coffee_shop", "fast_food_restaurant"],
    shopping: ["shopping_mall", "supermarket", "grocery_store", "clothing_store", "book_store"],
    services: ["bank", "atm", "gas_station", "pharmacy", "hospital", "doctor"],
    entertainment: ["movie_theater", "museum", "art_gallery", "night_club"],
    travel: ["airport", "train_station", "bus_station", "hotel", "tourist_attraction"],
    outdoors: ["park", "beach", "gym", "golf_course"],
};

export default async function (ctx: Context, session: Session | null, opts?: {}) {
    return PLACE_TYPES;
}
