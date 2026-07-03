/** Curated awards + iconic moments for rating v3 (bible §5.1). */
export function buildAwardsAndMoments(curatedPlayers) {
  const byId = new Map(curatedPlayers.map((p) => [p.id, p.name]));

  const awards = [
    { playerId: "messi", award: "Ballon d'Or", year: 2021, context: "both", bonus: 3 },
    { playerId: "ronaldo", award: "Ballon d'Or", year: 2017, context: "both", bonus: 3 },
    { playerId: "modric", award: "Ballon d'Or", year: 2018, context: "both", bonus: 3 },
    { playerId: "benzema", award: "Ballon d'Or", year: 2022, context: "club", bonus: 2 },
    { playerId: "haaland", award: "Golden Boot", year: 2023, context: "club", bonus: 2 },
    { playerId: "mbappe", award: "Golden Boot", year: 2022, context: "club", bonus: 2 },
    { playerId: "de-bruyne", award: "PFA Player of the Year", year: 2021, context: "club", bonus: 2 },
    { playerId: "van-dijk", award: "UEFA Men's Player", year: 2019, context: "both", bonus: 2 },
    { playerId: "salah", award: "Golden Boot", year: 2022, context: "club", bonus: 2 },
    { playerId: "pele", award: "World Cup", year: 1970, context: "international", bonus: 3 },
    { playerId: "maradona", award: "World Cup", year: 1986, context: "international", bonus: 3 },
    { playerId: "zidane", award: "World Cup", year: 1998, context: "international", bonus: 3 },
    { playerId: "maldini", award: "Champions League", year: 2007, context: "club", bonus: 2 },
    { playerId: "henry", award: "Golden Boot", year: 2004, context: "club", bonus: 2 },
    { playerId: "ronaldinho", award: "Ballon d'Or", year: 2005, context: "both", bonus: 3 },
  ].filter((a) => byId.has(a.playerId));

  const iconicMoments = [
    { playerId: "maradona", moment: "1986 World Cup quarter-final", context: "international", bonus: 3 },
    { playerId: "zidane", moment: "2002 Champions League final volley", context: "club", bonus: 2 },
    { playerId: "ronaldinho", moment: "2002 El Clásico at Bernabéu", context: "club", bonus: 2 },
    { playerId: "messi", moment: "2011 Champions League final", context: "club", bonus: 2 },
    { playerId: "ronaldo", moment: "2008 Champions League final header", context: "club", bonus: 2 },
    { playerId: "pele", moment: "1970 World Cup final", context: "international", bonus: 3 },
    { playerId: "henry", moment: "2003-04 Invincibles season", context: "club", bonus: 2 },
    { playerId: "modric", moment: "2018 World Cup run", context: "international", bonus: 2 },
    { playerId: "mbappe", moment: "2018 World Cup final", context: "international", bonus: 2 },
  ].filter((m) => byId.has(m.playerId));

  return { awards, iconicMoments };
}
