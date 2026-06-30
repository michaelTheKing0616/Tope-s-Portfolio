# naija-utils

A small, **dependency-free** TypeScript toolkit for building African-market
(Nigeria-first) software correctly — the boring-but-critical primitives that get
reinvented (badly) on every project.

> Part of the portfolio of Temitope Olaitan. The point of this project is craft:
> a clean public API, exhaustive tests, CI and semver — the unglamorous
> engineering that separates seniors from juniors.

## Why

Every Nigerian product re-implements phone validation, Naira formatting and state
dropdowns, usually with subtle bugs (float money, naive phone regex, missing
networks). `naija-utils` does it once, correctly, with tests.

## Install

```bash
npm install naija-utils
```

## Usage

```ts
import {
  parsePhone, getNetwork, formatPhone,
  isValidNIN, maskID,
  nairaToKobo, formatNaira,
  findState, statesInZone,
} from "naija-utils";

parsePhone("0803 123 4567");
// { local: "08031234567", e164: "+2348031234567", network: "MTN" }

getNetwork("08051234567");          // "Glo"
formatPhone("2348091234567", "local"); // "08091234567"

// Money is computed in integer kobo to avoid float drift, formatted at the edge.
const totalKobo = nairaToKobo(62000) * 3;       // 18_600_000
formatNaira(totalKobo, { fromKobo: true });     // "₦186,000.00"

isValidNIN("12345678901");          // true (format only)
maskID("12345678901");              // "*******8901"  (never log full IDs)

findState("lagos")?.capital;        // "Ikeja"
statesInZone("South-West").length;  // 6
```

## API

| Area | Functions |
|------|-----------|
| Phone | `parsePhone`, `isValidPhone`, `getNetwork`, `formatPhone` |
| Identity | `isValidNIN`, `isValidBVN`, `maskID` |
| Money | `nairaToKobo`, `koboToNaira`, `formatNaira` |
| Geography | `STATES`, `listStates`, `findState`, `isValidState`, `statesInZone` |

## Design decisions

- **Money in minor units.** All money is integer **kobo**; naira strings are only
  produced for display. This is the same discipline a payments system must use to
  avoid floating-point rounding bugs.
- **Validate at the boundary, fail loudly.** `formatPhone` throws on bad input so
  invalid data is caught where it enters the system, not three layers deep.
- **ID checks are structural only.** `isValidNIN/BVN` check length and digits.
  Authoritative verification needs the NIMC/NIBSS APIs; a `true` here is never
  proof of identity, and `maskID` exists so raw IDs never reach your logs.
- **Prefixes as data.** Network ranges live in one auditable table, easy to update
  as the NCC reallocates.

## Develop

```bash
npm install
npm test          # vitest
npm run typecheck
npm run build     # emits dist/ with types
```

## License

MIT
