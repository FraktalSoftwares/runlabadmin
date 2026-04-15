// Espelha runlabMobile/lib/core/models/gamification.dart.
// Se as faixas de XP mudarem no mobile, atualizar aqui também.

export type TierSlug = "hero" | "machine" | "unstoppable" | "limitless" | "legend";

export type Tier = {
  slug: TierSlug;
  name: string;
  minXP: number;
  maxXP: number;
};

export const TIERS: Tier[] = [
  { slug: "hero", name: "Hero", minXP: 0, maxXP: 4999 },
  { slug: "machine", name: "Machine", minXP: 5000, maxXP: 14999 },
  { slug: "unstoppable", name: "Unstoppable", minXP: 15000, maxXP: 29999 },
  { slug: "limitless", name: "Limitless", minXP: 30000, maxXP: 49999 },
  { slug: "legend", name: "Legend", minXP: 50000, maxXP: 999999 },
];

export function tierFromXP(xp: number): Tier {
  if (xp >= 50000) return TIERS[4];
  if (xp >= 30000) return TIERS[3];
  if (xp >= 15000) return TIERS[2];
  if (xp >= 5000) return TIERS[1];
  return TIERS[0];
}
