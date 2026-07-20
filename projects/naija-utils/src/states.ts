/** The 36 Nigerian states plus the Federal Capital Territory (37 entries), with capitals and zones. */

export type GeopoliticalZone =
  | "North-Central"
  | "North-East"
  | "North-West"
  | "South-East"
  | "South-South"
  | "South-West";

export interface NigerianState {
  name: string;
  capital: string;
  zone: GeopoliticalZone;
}

export const STATES: readonly NigerianState[] = [
  { name: "Abia", capital: "Umuahia", zone: "South-East" },
  { name: "Adamawa", capital: "Yola", zone: "North-East" },
  { name: "Akwa Ibom", capital: "Uyo", zone: "South-South" },
  { name: "Anambra", capital: "Awka", zone: "South-East" },
  { name: "Bauchi", capital: "Bauchi", zone: "North-East" },
  { name: "Bayelsa", capital: "Yenagoa", zone: "South-South" },
  { name: "Benue", capital: "Makurdi", zone: "North-Central" },
  { name: "Borno", capital: "Maiduguri", zone: "North-East" },
  { name: "Cross River", capital: "Calabar", zone: "South-South" },
  { name: "Delta", capital: "Asaba", zone: "South-South" },
  { name: "Ebonyi", capital: "Abakaliki", zone: "South-East" },
  { name: "Edo", capital: "Benin City", zone: "South-South" },
  { name: "Ekiti", capital: "Ado-Ekiti", zone: "South-West" },
  { name: "Enugu", capital: "Enugu", zone: "South-East" },
  { name: "Gombe", capital: "Gombe", zone: "North-East" },
  { name: "Imo", capital: "Owerri", zone: "South-East" },
  { name: "Jigawa", capital: "Dutse", zone: "North-West" },
  { name: "Kaduna", capital: "Kaduna", zone: "North-West" },
  { name: "Kano", capital: "Kano", zone: "North-West" },
  { name: "Katsina", capital: "Katsina", zone: "North-West" },
  { name: "Kebbi", capital: "Birnin Kebbi", zone: "North-West" },
  { name: "Kogi", capital: "Lokoja", zone: "North-Central" },
  { name: "Kwara", capital: "Ilorin", zone: "North-Central" },
  { name: "Lagos", capital: "Ikeja", zone: "South-West" },
  { name: "Nasarawa", capital: "Lafia", zone: "North-Central" },
  { name: "Niger", capital: "Minna", zone: "North-Central" },
  { name: "Ogun", capital: "Abeokuta", zone: "South-West" },
  { name: "Ondo", capital: "Akure", zone: "South-West" },
  { name: "Osun", capital: "Osogbo", zone: "South-West" },
  { name: "Oyo", capital: "Ibadan", zone: "South-West" },
  { name: "Plateau", capital: "Jos", zone: "North-Central" },
  { name: "Rivers", capital: "Port Harcourt", zone: "South-South" },
  { name: "Sokoto", capital: "Sokoto", zone: "North-West" },
  { name: "Taraba", capital: "Jalingo", zone: "North-East" },
  { name: "Yobe", capital: "Damaturu", zone: "North-East" },
  { name: "Zamfara", capital: "Gusau", zone: "North-West" },
  { name: "Federal Capital Territory", capital: "Abuja", zone: "North-Central" },
];

const BY_NAME = new Map(STATES.map((s) => [s.name.toLowerCase(), s]));

/** All state names (including the FCT). */
export function listStates(): string[] {
  return STATES.map((s) => s.name);
}

/** Look up a state case-insensitively; returns `undefined` if not found. */
export function findState(name: string): NigerianState | undefined {
  return BY_NAME.get(String(name).trim().toLowerCase());
}

/** True if the given name is a recognised Nigerian state/territory. */
export function isValidState(name: string): boolean {
  return findState(name) !== undefined;
}

/** All states within a geopolitical zone. */
export function statesInZone(zone: GeopoliticalZone): NigerianState[] {
  return STATES.filter((s) => s.zone === zone);
}
