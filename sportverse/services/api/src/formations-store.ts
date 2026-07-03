import type { FormationDef } from "@sportverse/draftballer-types";
import { FORMATIONS, getFormation } from "@sportverse/match-sim";

const customFormations = new Map<string, FormationDef>();

export function listAllFormations(): FormationDef[] {
  return [...FORMATIONS, ...customFormations.values()];
}

export function saveCustomFormation(body: Partial<FormationDef> & { slots: FormationDef["slots"] }): FormationDef {
  const id = body.id ?? `custom_${crypto.randomUUID().slice(0, 8)}`;
  const formation: FormationDef = {
    id,
    name: body.name ?? "Custom formation",
    backLineCount: body.backLineCount ?? countBackLine(body.slots),
    widthCategory: body.widthCategory ?? "balanced",
    eraTags: body.eraTags ?? [],
    slots: body.slots,
    isCustom: true,
  };
  customFormations.set(id, formation);
  return formation;
}

export function getFormationById(id: string): FormationDef | undefined {
  return customFormations.get(id) ?? getFormation(id);
}

function countBackLine(slots: FormationDef["slots"]): number {
  return slots.filter((s) => s.positionTag === "CB" || s.positionTag === "FB").length;
}
