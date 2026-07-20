#!/usr/bin/env node
/**
 * Expand and repair the hand-curated legend-ratings.json anchor list.
 *
 * Problems this fixes:
 * - 108 of the original 164 entries used ids that no longer exist in
 *   players-extended.json (e.g. "lahm", "cancelo", "trent"), so those anchors
 *   were silently dead and the players fell back to stats-based ratings.
 * - Coverage was far too thin: world-class players like Sterling rated in the
 *   60s-70s because goal/assist proxies cannot capture their true level.
 *
 * Resolution strategy per anchor (name → database id):
 * 1. Normalized-name candidates from players-extended.json
 * 2. Filter by expected nationality when provided
 * 3. Rank by fame-index score, then career-club count
 * 4. Ambiguous entries with zero fame signal are skipped and logged (never
 *    anchor an obscure namesake at 90 OVR)
 *
 * Idempotent: re-running regenerates the same output.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OUT_DIR, normalizeName } from "./utils.mjs";

const PLAYERS_JSON = resolve(OUT_DIR, "players-extended.json");
const FAME_JSON = resolve(OUT_DIR, "fame-index.json");
const LEGENDS_JSON = resolve(OUT_DIR, "legend-ratings.json");

/**
 * Vetted prime-peak anchors. OVR reflects the player's best sustained level
 * (FIFA-style prime card). nat = acceptable nationality substrings for
 * disambiguation against same-name players. id = explicit database id when
 * name matching is unsafe (mononyms, many namesakes). pos = corrected raw
 * position label (mapQuizPosition-compatible) when the DB tag is wrong.
 */
const ANCHORS = [
  // ── Explicit-id anchors (name matching unsafe) ────────────────────────
  { name: "Ronaldo", id: "tm-3140", ovr: 94, pos: "Striker" }, // R9 — Brazilian Ronaldo
  { name: "Park Ji-sung", id: "ji-sung-park", ovr: 84 },
  { name: "Oleg Blokhin", id: "oleh-blokhin", ovr: 91, pos: "Winger" },
  { name: "Zico", id: "not-applicable-zico", ovr: 94, pos: "Attacking Midfield" },
  { name: "Sócrates", id: "not-applicable-socrates", ovr: 92, pos: "Attacking Midfield" },
  { name: "Garrincha", id: "not-applicable-garrincha", ovr: 95, pos: "Winger" },
  { name: "Jairzinho", id: "not-applicable-jairzinho", ovr: 92, pos: "Winger" },
  { name: "Tostão", id: "not-applicable-tostao", ovr: 91, pos: "Striker" },
  { name: "Rivelino", id: "not-applicable-rivellino", ovr: 92, pos: "Attacking Midfield" },
  // Curated Rodri row carries a wrong "Portugal" nationality from a TM merge;
  // nat-filtering would otherwise anchor a 1960s namesake defender.
  { name: "Rodri", id: "rodri", ovr: 90, pos: "Defensive Midfield" },
  { name: "Careca", id: "not-applicable-careca", ovr: 89, pos: "Striker" },
  { name: "Bebeto", id: "not-applicable-bebeto", ovr: 89, pos: "Striker" },
  // tm-14133 is a 1973-born Marítimo left-back also named Eusébio — not the legend.
  { name: "Eusébio", id: "not-applicable-eusebio", ovr: 95, pos: "Striker" },
  // ── Position repairs for icons already anchored under valid ids ───────
  { name: "Pelé", id: "pele", ovr: 96, pos: "Striker" }, // DB tag says DM
  { name: "Franz Beckenbauer", id: "franz-beckenbauer", ovr: 95, pos: "Centre-Back" },
  { name: "Michel Platini", id: "michel-platini", ovr: 94, pos: "Attacking Midfield" },
  { name: "Hugo Sánchez", id: "hugo-sanchez", ovr: 92, pos: "Striker" },
  { name: "Bobby Charlton", id: "bobby-charlton", ovr: 92, pos: "Attacking Midfield" },
  // Name-matching picked tm-241354, a Santos/ABC journeyman namesake.
  { name: "Romário", id: "not-applicable-romario", ovr: 93, pos: "Striker" },

  // ── User-flagged prime wide/full-backs ────────────────────────────────
  { name: "Raheem Sterling", ovr: 89, nat: ["England"] },
  { name: "Riyad Mahrez", ovr: 87, nat: ["Algeria"] },
  { name: "Philipp Lahm", ovr: 90, nat: ["Germany"] },
  { name: "João Cancelo", ovr: 88, nat: ["Portugal"] },
  { name: "Trent Alexander-Arnold", ovr: 88, nat: ["England"] },
  { name: "Kyle Walker", ovr: 86, nat: ["England"] },
  { name: "Andrew Robertson", ovr: 87, nat: ["Scotland"] },
  { name: "Dani Alves", ovr: 89, nat: ["Brazil"] },
  { name: "Cafu", ovr: 91, nat: ["Brazil"] },
  { name: "Marcelo", ovr: 88, nat: ["Brazil"] },
  { name: "Maicon", ovr: 86, nat: ["Brazil"] },
  { name: "Ashley Cole", ovr: 88, nat: ["England"] },
  { name: "Jordi Alba", ovr: 87, nat: ["Spain"] },
  { name: "Dani Carvajal", ovr: 86, nat: ["Spain"] },
  { name: "Joshua Kimmich", ovr: 89, nat: ["Germany"] },
  { name: "Achraf Hakimi", ovr: 85, nat: ["Morocco"] },
  { name: "Alphonso Davies", ovr: 86, nat: ["Canada"] },
  { name: "Gianluca Zambrotta", ovr: 88, nat: ["Italy"] },
  { name: "Javier Zanetti", ovr: 89, nat: ["Argentina"] },
  { name: "Bixente Lizarazu", ovr: 87, nat: ["France"] },
  { name: "Patrice Evra", ovr: 87, nat: ["France"] },
  { name: "Kieran Trippier", ovr: 84, nat: ["England"] },
  { name: "Reece James", ovr: 84, nat: ["England"] },
  { name: "Theo Hernandez", ovr: 86, nat: ["France"] },
  { name: "Denis Irwin", ovr: 85, nat: ["Ireland"] },
  { name: "Branislav Ivanovic", ovr: 85, nat: ["Serbia"] },
  { name: "César Azpilicueta", ovr: 85, nat: ["Spain"] },
  { name: "Lilian Thuram", ovr: 89, nat: ["France"] },

  // ── Dead-id repairs (existing anchors that no longer resolved) ───────
  { name: "Alfredo Di Stéfano", ovr: 95, nat: ["Argentina", "Spain"] },
  { name: "Sergio Busquets", ovr: 89, nat: ["Spain"] },
  { name: "Gerard Piqué", ovr: 88, nat: ["Spain"] },
  { name: "Manuel Neuer", ovr: 92, nat: ["Germany"] },
  { name: "Marc-André ter Stegen", ovr: 89, nat: ["Germany"] },
  { name: "Roberto Firmino", ovr: 86, nat: ["Brazil"] },
  { name: "Leroy Sané", ovr: 86, nat: ["Germany"] },
  { name: "Ilkay Gündogan", ovr: 87, nat: ["Germany"] },
  { name: "Toni Kroos", ovr: 91, nat: ["Germany"] },
  { name: "Gareth Bale", ovr: 89, nat: ["Wales"] },
  { name: "Sergio Agüero", ovr: 90, nat: ["Argentina"] },
  { name: "Fernando Torres", ovr: 89, nat: ["Spain"] },
  { name: "David Villa", ovr: 89, nat: ["Spain"] },
  { name: "Paul Scholes", ovr: 90, nat: ["England"] },
  { name: "Ryan Giggs", ovr: 89, nat: ["Wales"] },
  { name: "Wayne Rooney", ovr: 90, nat: ["England"] },
  { name: "Dennis Bergkamp", ovr: 91, nat: ["Netherlands"] },
  // NOTE: Eric Cantona, George Best, Ian Wright, Abedi Pelé are absent from
  // players-extended.json entirely — nothing to anchor until ETL adds them.
  { name: "Bobby Charlton", ovr: 92, nat: ["England"] },
  { name: "Bobby Moore", ovr: 91, nat: ["England"] },
  { name: "Gary Lineker", ovr: 88, nat: ["England"] },
  { name: "Alan Shearer", ovr: 89, nat: ["England"] },
  { name: "Michael Essien", ovr: 87, nat: ["Ghana"] },
  { name: "Claude Makélélé", ovr: 88, nat: ["France"] },
  { name: "Kaká", ovr: 93, nat: ["Brazil"] },
  { name: "Rivaldo", ovr: 92, nat: ["Brazil"] },
  { name: "Rúben Dias", ovr: 89, nat: ["Portugal"] },
  { name: "John Stones", ovr: 85, nat: ["England"] },
  { name: "Nemanja Vidic", ovr: 89, nat: ["Serbia"] },
  { name: "Rio Ferdinand", ovr: 90, nat: ["England"] },
  { name: "Alessandro Nesta", ovr: 91, nat: ["Italy"] },
  { name: "Franco Baresi", ovr: 93, nat: ["Italy"] },
  { name: "Franz Beckenbauer", ovr: 95, nat: ["Germany"] },
  { name: "Gerd Müller", ovr: 94, nat: ["Germany"] },
  { name: "Thomas Müller", ovr: 89, nat: ["Germany"] },
  { name: "Lothar Matthäus", ovr: 92, nat: ["Germany"] },
  { name: "Jürgen Klinsmann", ovr: 89, nat: ["Germany"] },
  { name: "Bastian Schweinsteiger", ovr: 89, nat: ["Germany"] },
  { name: "Michael Ballack", ovr: 89, nat: ["Germany"] },
  { name: "Miroslav Klose", ovr: 88, nat: ["Germany"] },
  { name: "Lukas Podolski", ovr: 84, nat: ["Germany"] },
  { name: "Alessandro Del Piero", ovr: 91, nat: ["Italy"] },
  { name: "Fabio Cannavaro", ovr: 90, nat: ["Italy"] },
  { name: "Gennaro Gattuso", ovr: 86, nat: ["Italy"] },
  { name: "Clarence Seedorf", ovr: 89, nat: ["Netherlands"] },
  { name: "Andriy Shevchenko", ovr: 91, nat: ["Ukraine"] },
  { name: "Patrick Vieira", ovr: 90, nat: ["France"] },
  { name: "Emmanuel Petit", ovr: 86, nat: ["France"] },
  { name: "Luís Figo", ovr: 92, nat: ["Portugal"] },
  { name: "Adriano", ovr: 87, nat: ["Brazil"] },
  { name: "Vinicius Junior", ovr: 90, nat: ["Brazil"] },
  { name: "Rodrygo", ovr: 85, nat: ["Brazil"] },
  { name: "Endrick", ovr: 78, nat: ["Brazil"] },
  { name: "Gavi", ovr: 84, nat: ["Spain"] },
  { name: "Jadon Sancho", ovr: 82, nat: ["England"] },
  { name: "Antony", ovr: 79, nat: ["Brazil"] },
  { name: "Mason Mount", ovr: 82, nat: ["England"] },
  { name: "Paul Pogba", ovr: 88, nat: ["France"] },
  { name: "Raphaël Varane", ovr: 88, nat: ["France"] },
  { name: "N'Golo Kanté", ovr: 90, nat: ["France"] },
  { name: "Eden Hazard", ovr: 91, nat: ["Belgium"] },
  { name: "Thibaut Courtois", ovr: 90, nat: ["Belgium"] },
  { name: "David de Gea", ovr: 89, nat: ["Spain"] },
  { name: "Michel Platini", ovr: 94, nat: ["France"] },
  { name: "Jean-Pierre Papin", ovr: 89, nat: ["France"] },
  { name: "Ruud Gullit", ovr: 92, nat: ["Netherlands"] },
  { name: "Marco van Basten", ovr: 93, nat: ["Netherlands"] },
  { name: "Frank Rijkaard", ovr: 91, nat: ["Netherlands"] },
  { name: "Ronald Koeman", ovr: 89, nat: ["Netherlands"] },
  { name: "Hristo Stoichkov", ovr: 91, nat: ["Bulgaria"] },
  { name: "Gheorghe Hagi", ovr: 90, nat: ["Romania"] },
  { name: "Graeme Souness", ovr: 88, nat: ["Scotland"] },
  { name: "Kenny Dalglish", ovr: 91, nat: ["Scotland"] },
  { name: "Michael Owen", ovr: 88, nat: ["England"] },
  { name: "Carlos Tevez", ovr: 88, nat: ["Argentina"] },
  { name: "Gonzalo Higuaín", ovr: 87, nat: ["Argentina"] },
  { name: "Paulo Dybala", ovr: 86, nat: ["Argentina"] },
  { name: "Mauro Icardi", ovr: 84, nat: ["Argentina"] },
  { name: "Lautaro Martínez", ovr: 87, nat: ["Argentina"] },
  { name: "Ángel Di María", ovr: 88, nat: ["Argentina"] },
  { name: "Javier Mascherano", ovr: 87, nat: ["Argentina"] },
  { name: "Gabriel Batistuta", ovr: 91, nat: ["Argentina"] },
  { name: "Hernán Crespo", ovr: 88, nat: ["Argentina"] },
  { name: "Pablo Aimar", ovr: 85, nat: ["Argentina"] },
  { name: "Javier Saviola", ovr: 83, nat: ["Argentina"] },
  { name: "Diego Forlán", ovr: 87, nat: ["Uruguay"] },
  { name: "Edinson Cavani", ovr: 88, nat: ["Uruguay"] },
  { name: "Radamel Falcao", ovr: 88, nat: ["Colombia"] },
  { name: "James Rodríguez", ovr: 86, nat: ["Colombia"] },
  { name: "Faustino Asprilla", ovr: 85, nat: ["Colombia"] },

  // ── New coverage: attackers ───────────────────────────────────────────
  { name: "Zlatan Ibrahimovic", ovr: 92, nat: ["Sweden"] },
  { name: "Samuel Eto'o", ovr: 91, nat: ["Cameroon"] },
  { name: "Robin van Persie", ovr: 89, nat: ["Netherlands"] },
  { name: "Arjen Robben", ovr: 90, nat: ["Netherlands"] },
  { name: "Franck Ribéry", ovr: 90, nat: ["France"] },
  { name: "Antoine Griezmann", ovr: 89, nat: ["France"] },
  { name: "Ousmane Dembélé", ovr: 86, nat: ["France"] },
  { name: "Kingsley Coman", ovr: 84, nat: ["France"] },
  { name: "Olivier Giroud", ovr: 85, nat: ["France"] },
  { name: "Dimitar Berbatov", ovr: 86, nat: ["Bulgaria"] },
  { name: "Kevin Keegan", ovr: 90, nat: ["England"] },
  { name: "Paul Gascoigne", ovr: 88, nat: ["England"] },
  { name: "Robbie Fowler", ovr: 87, nat: ["England"] },
  { name: "Teddy Sheringham", ovr: 85, nat: ["England"] },
  { name: "Ruud van Nistelrooy", ovr: 90, nat: ["Netherlands"] },
  { name: "Patrick Kluivert", ovr: 89, nat: ["Netherlands"] },
  { name: "Klaas-Jan Huntelaar", ovr: 85, nat: ["Netherlands"] },
  { name: "Memphis Depay", ovr: 85, nat: ["Netherlands"] },
  { name: "Romelu Lukaku", ovr: 87, nat: ["Belgium"] },
  { name: "Dries Mertens", ovr: 85, nat: ["Belgium"] },
  { name: "Pierre-Emerick Aubameyang", ovr: 86, nat: ["Gabon"] },
  { name: "Victor Osimhen", ovr: 85, nat: ["Nigeria"] },
  { name: "Nwankwo Kanu", ovr: 85, nat: ["Nigeria"] },
  { name: "Jay-Jay Okocha", ovr: 87, nat: ["Nigeria"] },
  { name: "George Weah", ovr: 92, nat: ["Liberia"] },
  { name: "Didier Deschamps", ovr: 86, nat: ["France"] },
  { name: "Roberto Baggio", ovr: 93, nat: ["Italy"] },
  { name: "Paolo Rossi", ovr: 91, nat: ["Italy"] },
  { name: "Christian Vieri", ovr: 89, nat: ["Italy"] },
  { name: "Filippo Inzaghi", ovr: 87, nat: ["Italy"] },
  { name: "Gianfranco Zola", ovr: 88, nat: ["Italy"] },
  { name: "Gianluca Vialli", ovr: 88, nat: ["Italy"] },
  { name: "Federico Chiesa", ovr: 84, nat: ["Italy"] },
  { name: "Raúl", ovr: 91, nat: ["Spain"] },
  { name: "Fernando Morientes", ovr: 86, nat: ["Spain"] },
  { name: "Álvaro Morata", ovr: 84, nat: ["Spain"] },
  { name: "Isco", ovr: 85, nat: ["Spain"] },
  { name: "Rui Costa", ovr: 89, nat: ["Portugal"] },
  { name: "Deco", ovr: 89, nat: ["Portugal", "Brazil"] },
  { name: "Bernardo Silva", ovr: 89, nat: ["Portugal"] },
  { name: "Nani", ovr: 84, nat: ["Portugal"] },
  { name: "Rafael Leão", ovr: 86, nat: ["Portugal"] },
  { name: "Diogo Jota", ovr: 84, nat: ["Portugal"] },
  { name: "Robinho", ovr: 85, nat: ["Brazil"] },
  { name: "Hulk", ovr: 85, nat: ["Brazil"] },
  { name: "Philippe Coutinho", ovr: 86, nat: ["Brazil"] },
  { name: "Gabriel Jesus", ovr: 84, nat: ["Brazil"] },
  { name: "Richarlison", ovr: 82, nat: ["Brazil"] },
  { name: "Iván Zamorano", ovr: 86, nat: ["Chile"] },
  { name: "Marcelo Salas", ovr: 87, nat: ["Chile"] },
  { name: "Alexis Sánchez", ovr: 86, nat: ["Chile"] },
  { name: "Juan Román Riquelme", ovr: 89, nat: ["Argentina"] },
  { name: "Ariel Ortega", ovr: 85, nat: ["Argentina"] },
  { name: "Hugo Sánchez", ovr: 92, nat: ["Mexico"] },
  { name: "Cuauhtémoc Blanco", ovr: 86, nat: ["Mexico"] },
  { name: "Javier Hernández", ovr: 84, nat: ["Mexico"] },
  { name: "Hirving Lozano", ovr: 83, nat: ["Mexico"] },
  { name: "Landon Donovan", ovr: 84, nat: ["United States"] },
  { name: "Clint Dempsey", ovr: 83, nat: ["United States"] },
  { name: "Christian Pulisic", ovr: 84, nat: ["United States"] },
  { name: "Davor Šuker", ovr: 89, nat: ["Croatia"] },
  { name: "Mario Mandžukić", ovr: 85, nat: ["Croatia"] },
  { name: "Henrik Larsson", ovr: 88, nat: ["Sweden"] },
  { name: "Freddie Ljungberg", ovr: 85, nat: ["Sweden"] },
  { name: "Ole Gunnar Solskjær", ovr: 85, nat: ["Norway"] },
  { name: "Zbigniew Boniek", ovr: 89, nat: ["Poland"] },
  { name: "Hakan Sükür", ovr: 87, nat: ["Turkey"] },
  { name: "Ferenc Puskás", ovr: 95, nat: ["Hungary"] },
  { name: "Karl-Heinz Rummenigge", ovr: 92, nat: ["Germany"] },
  { name: "Rudi Völler", ovr: 89, nat: ["Germany"] },
  { name: "Hidetoshi Nakata", ovr: 85, nat: ["Japan"] },
  { name: "Shinji Kagawa", ovr: 83, nat: ["Japan"] },
  { name: "Diego Costa", ovr: 86, nat: ["Spain", "Brazil"] },
  { name: "Sadio Mané", ovr: 89, nat: ["Senegal"] },

  // ── New coverage: midfielders ─────────────────────────────────────────
  { name: "David Silva", ovr: 89, nat: ["Spain"] },
  { name: "Cesc Fàbregas", ovr: 88, nat: ["Spain"] },
  { name: "Juan Mata", ovr: 85, nat: ["Spain"] },
  { name: "Santi Cazorla", ovr: 85, nat: ["Spain"] },
  { name: "Thiago Alcántara", ovr: 87, nat: ["Spain"] },
  { name: "Mesut Özil", ovr: 88, nat: ["Germany"] },
  { name: "Marco Reus", ovr: 87, nat: ["Germany"] },
  { name: "Mario Götze", ovr: 84, nat: ["Germany"] },
  { name: "Leon Goretzka", ovr: 85, nat: ["Germany"] },
  { name: "Kai Havertz", ovr: 84, nat: ["Germany"] },
  { name: "Sami Khedira", ovr: 85, nat: ["Germany"] },
  { name: "Wesley Sneijder", ovr: 89, nat: ["Netherlands"] },
  { name: "Rafael van der Vaart", ovr: 86, nat: ["Netherlands"] },
  { name: "Edgar Davids", ovr: 88, nat: ["Netherlands"] },
  { name: "Marc Overmars", ovr: 87, nat: ["Netherlands"] },
  { name: "Johan Neeskens", ovr: 90, nat: ["Netherlands"] },
  { name: "Frenkie de Jong", ovr: 87, nat: ["Netherlands"] },
  { name: "Pavel Nedvěd", ovr: 91, nat: ["Czech"] },
  { name: "Tomáš Rosický", ovr: 84, nat: ["Czech"] },
  { name: "Ivan Rakitić", ovr: 86, nat: ["Croatia"] },
  { name: "Zvonimir Boban", ovr: 88, nat: ["Croatia"] },
  { name: "Robert Prosinečki", ovr: 86, nat: ["Croatia"] },
  { name: "Mateo Kovačić", ovr: 85, nat: ["Croatia"] },
  { name: "Marcelo Brozović", ovr: 84, nat: ["Croatia"] },
  { name: "Enzo Scifo", ovr: 87, nat: ["Belgium"] },
  { name: "Axel Witsel", ovr: 84, nat: ["Belgium"] },
  { name: "Yaya Touré", ovr: 89, nat: ["Ivory Coast", "Cote"] },
  { name: "Daniele De Rossi", ovr: 87, nat: ["Italy"] },
  { name: "Nicolò Barella", ovr: 86, nat: ["Italy"] },
  { name: "Marco Verratti", ovr: 87, nat: ["Italy"] },
  { name: "Jorginho", ovr: 85, nat: ["Italy"] },
  { name: "Fabinho", ovr: 85, nat: ["Brazil"] },
  { name: "Fernandinho", ovr: 86, nat: ["Brazil"] },
  { name: "Gilberto Silva", ovr: 85, nat: ["Brazil"] },
  { name: "Juninho Pernambucano", ovr: 87, nat: ["Brazil"] },
  { name: "Oscar", ovr: 84, nat: ["Brazil"] },
  { name: "Willian", ovr: 84, nat: ["Brazil"] },
  { name: "Michael Carrick", ovr: 85, nat: ["England"] },
  { name: "Jordan Henderson", ovr: 84, nat: ["England"] },
  { name: "Jack Grealish", ovr: 84, nat: ["England"] },
  { name: "Glenn Hoddle", ovr: 87, nat: ["England"] },
  { name: "Blaise Matuidi", ovr: 85, nat: ["France"] },
  { name: "Samir Nasri", ovr: 84, nat: ["France"] },
  { name: "Aurélien Tchouaméni", ovr: 85, nat: ["France"] },
  { name: "Eduardo Camavinga", ovr: 84, nat: ["France"] },
  { name: "Esteban Cambiasso", ovr: 86, nat: ["Argentina"] },
  { name: "Diego Simeone", ovr: 87, nat: ["Argentina"] },
  { name: "Alexis Mac Allister", ovr: 85, nat: ["Argentina"] },
  { name: "Enzo Fernández", ovr: 84, nat: ["Argentina"] },
  { name: "Rodrigo De Paul", ovr: 84, nat: ["Argentina"] },
  { name: "Arturo Vidal", ovr: 87, nat: ["Chile"] },
  { name: "Moisés Caicedo", ovr: 84, nat: ["Ecuador"] },
  { name: "Nemanja Matić", ovr: 84, nat: ["Serbia"] },
  { name: "Dominik Szoboszlai", ovr: 84, nat: ["Hungary"] },
  { name: "Hakan Çalhanoğlu", ovr: 86, nat: ["Turkey"] },
  { name: "Wojciech Szczęsny", ovr: 86, nat: ["Poland"] },
  { name: "Piotr Zieliński", ovr: 84, nat: ["Poland"] },
  { name: "Arda Güler", ovr: 80, nat: ["Turkey"] },
  { name: "Dirk Kuyt", ovr: 84, nat: ["Netherlands"] },

  // ── New coverage: defenders ───────────────────────────────────────────
  { name: "John Terry", ovr: 89, nat: ["England"] },
  { name: "Jamie Carragher", ovr: 85, nat: ["England"] },
  { name: "Sol Campbell", ovr: 87, nat: ["England"] },
  { name: "Tony Adams", ovr: 88, nat: ["England"] },
  { name: "Gary Neville", ovr: 86, nat: ["England"] },
  { name: "Harry Maguire", ovr: 82, nat: ["England"] },
  { name: "Luke Shaw", ovr: 83, nat: ["England"] },
  { name: "Carles Puyol", ovr: 90, nat: ["Spain"] },
  { name: "Fernando Hierro", ovr: 89, nat: ["Spain"] },
  { name: "Marcel Desailly", ovr: 89, nat: ["France"] },
  { name: "Laurent Blanc", ovr: 88, nat: ["France"] },
  { name: "Eric Abidal", ovr: 85, nat: ["France"] },
  { name: "Jules Koundé", ovr: 85, nat: ["France"] },
  { name: "Lucas Hernandez", ovr: 84, nat: ["France"] },
  { name: "Mats Hummels", ovr: 88, nat: ["Germany"] },
  { name: "Jérôme Boateng", ovr: 86, nat: ["Germany"] },
  { name: "Jürgen Kohler", ovr: 87, nat: ["Germany"] },
  { name: "Andreas Brehme", ovr: 88, nat: ["Germany"] },
  { name: "Giorgio Chiellini", ovr: 89, nat: ["Italy"] },
  { name: "Leonardo Bonucci", ovr: 87, nat: ["Italy"] },
  { name: "Marco Materazzi", ovr: 84, nat: ["Italy"] },
  { name: "Jaap Stam", ovr: 90, nat: ["Netherlands"] },
  { name: "Frank de Boer", ovr: 87, nat: ["Netherlands"] },
  { name: "Matthijs de Ligt", ovr: 85, nat: ["Netherlands"] },
  { name: "Vincent Kompany", ovr: 88, nat: ["Belgium"] },
  { name: "Jan Vertonghen", ovr: 85, nat: ["Belgium"] },
  { name: "Toby Alderweireld", ovr: 84, nat: ["Belgium"] },
  { name: "Thiago Silva", ovr: 89, nat: ["Brazil"] },
  { name: "Marquinhos", ovr: 87, nat: ["Brazil"] },
  { name: "Éder Militão", ovr: 85, nat: ["Brazil"] },
  { name: "David Luiz", ovr: 84, nat: ["Brazil"] },
  { name: "Kalidou Koulibaly", ovr: 86, nat: ["Senegal"] },
  { name: "Kolo Touré", ovr: 84, nat: ["Ivory Coast", "Cote"] },
  { name: "Rafael Márquez", ovr: 87, nat: ["Mexico"] },
  { name: "Pepe", ovr: 88, nat: ["Portugal"] },
  { name: "Joško Gvardiol", ovr: 85, nat: ["Croatia"] },

  // ── New coverage: goalkeepers ─────────────────────────────────────────
  { name: "Peter Schmeichel", ovr: 92, nat: ["Denmark"] },
  { name: "Edwin van der Sar", ovr: 90, nat: ["Netherlands"] },
  { name: "Oliver Kahn", ovr: 92, nat: ["Germany"] },
  { name: "Petr Čech", ovr: 90, nat: ["Czech"] },
  { name: "Gianluigi Donnarumma", ovr: 88, nat: ["Italy"] },
  { name: "Jan Oblak", ovr: 90, nat: ["Slovenia"] },
  { name: "Hugo Lloris", ovr: 87, nat: ["France"] },
  { name: "Mike Maignan", ovr: 87, nat: ["France"] },
  { name: "Fabien Barthez", ovr: 87, nat: ["France"] },
  { name: "Keylor Navas", ovr: 87, nat: ["Costa Rica"] },
  { name: "Dida", ovr: 87, nat: ["Brazil"] },
  { name: "Júlio César", ovr: 87, nat: ["Brazil"] },
  { name: "Jordan Pickford", ovr: 84, nat: ["England"] },
  { name: "André Onana", ovr: 84, nat: ["Cameroon"] },
  { name: "Samir Handanović", ovr: 85, nat: ["Slovenia"] },
];

/** Dead ids in the current file → canonical names (re-resolved above or here). */
const DEAD_ID_NAMES = new Map([
  ["r9", "Ronaldo"],
  ["ronaldo-brazil", "Ronaldo"],
  ["carlos", "Roberto Carlos"],
  ["trent", "Trent Alexander-Arnold"],
  ["dibu", "Emiliano Martínez"],
  ["james", "James Rodríguez"],
  ["renaldinho", "Ronaldinho"],
  ["yashin", "Lev Yashin"],
  ["muller", "Gerd Müller"],
  ["valderrama", "Carlos Valderrama"],
  ["dalglish", "Kenny Dalglish"],
  ["Cannavaro", "Fabio Cannavaro"],
]);

function main() {
  const players = JSON.parse(readFileSync(PLAYERS_JSON, "utf8"));
  const fame = new Map(
    JSON.parse(readFileSync(FAME_JSON, "utf8")).map((e) => [e.playerId, e.fameScore ?? 0]),
  );
  const existing = JSON.parse(readFileSync(LEGENDS_JSON, "utf8"));
  const validIds = new Set(players.map((p) => p.id));

  const byNorm = new Map();
  for (const p of players) {
    const norm = normalizeName(p.name ?? "");
    if (!norm) continue;
    const list = byNorm.get(norm) ?? [];
    list.push(p);
    byNorm.set(norm, list);
  }

  const warnings = [];

  function resolveId(name, nats) {
    let candidates = byNorm.get(normalizeName(name)) ?? [];
    if (!candidates.length) {
      warnings.push(`UNRESOLVED: ${name} — no name match`);
      return null;
    }
    if (nats?.length) {
      const natMatch = candidates.filter((p) =>
        nats.some((n) => (p.nationality ?? "").toLowerCase().includes(n.toLowerCase())),
      );
      if (natMatch.length) candidates = natMatch;
    }
    if (candidates.length === 1) return candidates[0].id;

    const famous = candidates
      .map((p) => ({ p, fame: fame.get(p.id) ?? 0 }))
      .sort((a, b) => b.fame - a.fame || (b.p.clubs?.length ?? 0) - (a.p.clubs?.length ?? 0));
    // Never anchor an obscure namesake: demand a clear fame winner.
    if ((famous[0]?.fame ?? 0) <= 0 && (famous[0]?.p.clubs?.length ?? 0) < 3) {
      warnings.push(`AMBIGUOUS: ${name} — ${candidates.length} candidates, no fame signal; skipped`);
      return null;
    }
    return famous[0].p.id;
  }

  // Known-bad resolutions from earlier runs — never keep.
  const BLOCKED_IDS = new Set([
    "not-applicable-rodri", // 1960s namesake defender, not Man City's Rodri
    "tm-14133", // Marítimo left-back named Eusébio, not the Benfica legend
    "tm-241354", // Santos/ABC journeyman named Romário
  ]);

  const output = new Map();

  // 1. Keep existing entries whose ids still resolve.
  for (const entry of existing) {
    if (validIds.has(entry.playerId) && !BLOCKED_IDS.has(entry.playerId)) {
      output.set(entry.playerId, entry);
    }
  }

  // 2. Re-resolve dead ids using their known names + original OVR.
  const anchorNames = new Set(ANCHORS.map((a) => normalizeName(a.name)));
  for (const entry of existing) {
    if (validIds.has(entry.playerId)) continue;
    const name = DEAD_ID_NAMES.get(entry.playerId) ?? entry.playerId.replace(/-/g, " ");
    if (anchorNames.has(normalizeName(name))) continue; // repaired by ANCHORS below
    const id = resolveId(name, undefined);
    if (id && !output.has(id)) {
      output.set(id, { ...entry, playerId: id });
    } else if (!id) {
      warnings.push(`DEAD ID DROPPED: ${entry.playerId} (ovr ${entry.ovr})`);
    }
  }

  // 3. Apply the vetted anchor table (authoritative — overrides earlier values).
  const playersById = new Map(players.map((p) => [p.id, p]));
  let applied = 0;
  let positionsRepaired = 0;
  for (const anchor of ANCHORS) {
    const id = anchor.id ?? resolveId(anchor.name, anchor.nat);
    if (!id) continue;
    if (anchor.id && !validIds.has(anchor.id)) {
      warnings.push(`BAD EXPLICIT ID: ${anchor.name} → ${anchor.id}`);
      continue;
    }
    output.set(id, { playerId: id, ovr: anchor.ovr });
    applied++;
    if (anchor.pos) {
      const player = playersById.get(id);
      if (player && player.position !== anchor.pos) {
        player.position = anchor.pos;
        positionsRepaired++;
      }
    }
  }
  if (positionsRepaired > 0) {
    writeFileSync(PLAYERS_JSON, JSON.stringify(players));
  }

  const merged = [...output.values()].sort((a, b) => b.ovr - a.ovr || a.playerId.localeCompare(b.playerId));
  writeFileSync(LEGENDS_JSON, JSON.stringify(merged, null, 1));

  console.log(`✓ legend-ratings.json: ${existing.length} → ${merged.length} entries (${applied}/${ANCHORS.length} anchors applied)`);
  console.log(`  positions repaired in players-extended.json: ${positionsRepaired}`);
  const stillDead = merged.filter((e) => !validIds.has(e.playerId)).length;
  console.log(`  entries with valid db ids: ${merged.length - stillDead}/${merged.length}`);
  if (warnings.length) {
    console.log(`  ${warnings.length} warnings:`);
    for (const w of warnings) console.log(`   - ${w}`);
  }
}

main();
