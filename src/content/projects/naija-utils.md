---
title: "naija-utils"
tagline: "An open-source toolkit for building African-market software correctly."
domain: "Systems / Open Source"
domains: ["Systems", "Web"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "Vitest", "GitHub Actions", "Zero dependencies"]
skill: "Library design, testing discipline, CI/CD, maintainership"
seniorSignal: "Clean public API, exhaustive tests, automated CI and semver — the unglamorous craft that separates seniors from juniors."
summary: "A small, dependency-free open-source library of African-market primitives — Nigerian phone and ID validation, Naira formatting, network detection and state data — built with full tests, CI and documentation as a credibility signal."
order: 7
featured: false
links: []
---

## The idea

Every team building for the Nigerian and wider African market re-implements the same fiddly primitives badly: validating phone numbers and national IDs, formatting Naira, detecting carrier networks. `naija-utils` does them once, correctly, and gives them away.

## What I built

A complete, dependency-free TypeScript package in `projects/naija-utils`, with a clean public API across four areas:

| Area | Functions |
|------|-----------|
| Phone | `parsePhone`, `isValidPhone`, `getNetwork`, `formatPhone` |
| Identity | `isValidNIN`, `isValidBVN`, `maskID` |
| Money | `nairaToKobo`, `koboToNaira`, `formatNaira` |
| Geography | `STATES`, `listStates`, `findState`, `isValidState`, `statesInZone` |

```ts
parsePhone("0803 123 4567");
// { local: "08031234567", e164: "+2348031234567", network: "MTN" }

formatNaira(nairaToKobo(62000) * 3, { fromKobo: true }); // "₦186,000.00"
```

## Engineering decisions (where senior shows)

- **Money in minor units.** All amounts are integer **kobo**; Naira strings are produced only for display, so there is no floating-point drift.
- **Validate at the boundary, fail loudly.** `formatPhone` throws on bad input, catching invalid data where it enters the system instead of three layers deep.
- **Prefixes as data.** Carrier network ranges live in one auditable table, trivial to update as the NCC reallocates.
- **ID checks are honestly scoped.** `isValidNIN/BVN` validate *structure* only; authoritative verification needs the NIMC/NIBSS APIs, and `maskID` exists so raw IDs never reach logs. The README says so explicitly.

## Results

- Full Vitest suite covering every module — phone normalisation across seven input formats, kobo round-tripping, capture/validation edge cases, all 37 states.
- A GitHub Actions workflow runs typecheck, tests and build on every push and PR; nothing merges red.
- `strict` TypeScript with `noUncheckedIndexedAccess` and emitted type declarations.

## Senior signal

Anyone can write a function. Shipping a maintained library — clean API, real tests, green CI, honest scope and semver — is the credibility marker open-source maintainers and senior reviewers recognise instantly. A shared-spec Python port is the next step on the roadmap.
