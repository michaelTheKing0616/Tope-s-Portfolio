/**
 * naija-utils — a small, dependency-free toolkit for building African-market
 * (Nigeria-first) software correctly.
 *
 * @packageDocumentation
 */

export {
  type Network,
  type ParsedPhone,
  parsePhone,
  isValidPhone,
  getNetwork,
  formatPhone,
} from "./phone.js";

export { isValidNIN, isValidBVN, maskID } from "./id.js";

export {
  type FormatNairaOptions,
  nairaToKobo,
  koboToNaira,
  formatNaira,
} from "./currency.js";

export {
  type GeopoliticalZone,
  type NigerianState,
  STATES,
  listStates,
  findState,
  isValidState,
  statesInZone,
} from "./states.js";
