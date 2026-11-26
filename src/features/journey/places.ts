// Stop names for the trip film: the city (and the country when the trip crosses countries), never a street or a venue.
import * as Location from "expo-location";
import { placeName } from "@/features/gallery/place";

type Address = { city: string | null; country: string | null };
export type StopPlace = Address & { spot: string | null };

/**
 * City (and country when the stops span more than one). Never a district, street or point of interest, unless
 * `cityOnly` is false and several stops share a city: then the spot tells them apart.
 */
export function stopLabels(addresses: (Address | null)[], cityOnly: boolean, spots: (string | null)[] = []): (string | null)[] {
  const countries = new Set<string>();
  const cityCount = new Map<string, number>();
  for (const address of addresses) {
    if (!address) continue;
    if (address.country) countries.add(address.country);
    if (address.city) cityCount.set(address.city, (cityCount.get(address.city) ?? 0) + 1);
  }
  const multi = countries.size > 1;
  return addresses.map((address, i) => {
    if (!address) return null;
    const { city, country } = address;
    const spot = spots[i] ?? null;
    if (!cityOnly && city && (cityCount.get(city) ?? 0) > 1 && spot) return spot;
    if (multi && city && country && city !== country) return `${city}, ${country}`;
    return city ?? country ?? null;
  });
}

const NO_PLACE: StopPlace = { city: null, country: null, spot: null };

/** Reverse-geocodes every stop (expo-location), giving up after `capMs` with what it has. Never throws. */
export function geocodeStops(stops: { lat: number; lng: number }[], capMs = 5000): Promise<StopPlace[]> {
  const places: StopPlace[] = stops.map(() => NO_PLACE);
  return new Promise<StopPlace[]>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve([...places]);
    };
    const timer = setTimeout(finish, capMs);
    void (async () => {
      for (let i = 0; i < stops.length; i++) {
        if (done) return;
        try {
          const [address] = await Location.reverseGeocodeAsync({ latitude: stops[i]!.lat, longitude: stops[i]!.lng });
          if (done) return;
          if (address) {
            places[i] = { city: placeName(address), country: address.country ?? null, spot: address.district ?? address.name ?? address.street ?? null };
          }
        } catch {
          // a stop without a name is left without one
        }
        await new Promise<void>((r) => setTimeout(r, 120));
      }
      finish();
    })();
  });
}
