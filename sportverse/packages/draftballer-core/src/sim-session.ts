import type { SimMatchConfig } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";

const STORAGE_KEY = "db_sim_config";

export function loadSimConfig(): SimMatchConfig {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SIM_CONFIG };
  try {
    return { ...DEFAULT_SIM_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SIM_CONFIG };
  }
}

export function saveSimConfig(config: SimMatchConfig): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadSquadBuilderState(): {
  formationId: string;
  tacticalIdentity: SimMatchConfig["tacticalIdentityHome"];
} {
  const raw = sessionStorage.getItem("db_squad_builder");
  if (!raw) return { formationId: "4-4-2", tacticalIdentity: "balanced" };
  try {
    return JSON.parse(raw);
  } catch {
    return { formationId: "4-4-2", tacticalIdentity: "balanced" };
  }
}

export function saveSquadBuilderState(state: {
  formationId: string;
  tacticalIdentity: SimMatchConfig["tacticalIdentityHome"];
}): void {
  sessionStorage.setItem("db_squad_builder", JSON.stringify(state));
}
