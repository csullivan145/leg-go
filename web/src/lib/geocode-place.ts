export interface ResolvedPlace {
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
}

/**
 * Resolve a free-text place query (e.g. a hotel name + address) to Places
 * coordinates via the Places API (New) Text Search endpoint. Returns null
 * if the API key is missing or no match is found.
 */
export async function geocodePlace(
  apiKey: string | null,
  query: string,
): Promise<ResolvedPlace | null> {
  if (!apiKey) return null;
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({ textQuery: trimmed, pageSize: 1 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };
    const first = data.places?.[0];
    if (!first) return null;
    return {
      name: first.displayName?.text ?? null,
      address: first.formattedAddress ?? null,
      lat: first.location?.latitude ?? null,
      lng: first.location?.longitude ?? null,
      place_id: first.id ?? null,
    };
  } catch {
    return null;
  }
}
