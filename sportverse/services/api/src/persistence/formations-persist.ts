import type { FormationDef } from "@sportverse/draftballer-types";
import { FORMATIONS } from "@sportverse/match-sim";
import { FileStore, resolveDataPath } from "./file-store.js";

const store = new FileStore<{ custom: FormationDef[] }>(resolveDataPath("custom-formations.json"));

export function listPersistedCustomFormations(): FormationDef[] {
  return store.read().custom ?? [];
}

export function savePersistedCustomFormation(formation: FormationDef): FormationDef {
  store.update((current) => {
    const custom = [...(current.custom ?? [])];
    const idx = custom.findIndex((f) => f.id === formation.id);
    if (idx >= 0) custom[idx] = formation;
    else custom.push(formation);
    return { custom };
  });
  return formation;
}

export function listAllFormationsWithCustom(): FormationDef[] {
  return [...FORMATIONS, ...listPersistedCustomFormations()];
}

export function getFormationByIdPersisted(id: string): FormationDef | undefined {
  return listAllFormationsWithCustom().find((f) => f.id === id);
}
