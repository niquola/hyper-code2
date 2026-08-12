---
name: gplaces
description: "Google Places API client — text and nearby search, place details, addresses, phone, website, hours, ratings, reviews and photos. Use to find restaurants, cafes, pharmacies, hospitals, hotels, stores and other real-world locations."
---

# Google Places

Live Google Places API (New). Its API key remains in 1Password.

## Functions

- `gplaces.search({ query, max?, lang?, region?, lat?, lng?, radius?, type?, openNow?, minRating? })`
- `gplaces.nearby({ lat, lng, radius?, types?, excludeTypes?, rank?, max?, lang? })`
- `gplaces.details({ id, lang?, reviews?, photos? })`
- `gplaces.photo({ name, maxWidth?, path? })` — securely downloads a photo to a local file; it does not return a key-bearing URL.
- `gplaces.types({})`
- `gplaces.api({ path, method?, body?, fieldMask?, lang? })` — low-level API call.

```ts
await ctx.fns.gplaces.search({ query: "coffee in Lisbon", max: 5 });
await ctx.fns.gplaces.nearby({ lat: 38.697, lng: -9.421, types: ["pharmacy"] });
```
