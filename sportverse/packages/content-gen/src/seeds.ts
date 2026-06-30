export const FIRST_NAMES = [
  "Lionel", "Cristiano", "Kylian", "Erling", "Kevin", "Luka", "Mohamed", "Virgil", "Sadio", "Robert",
  "Harry", "Jude", "Bukayo", "Phil", "Martin", "Victor", "Riyad", "Karim", "Luka", "Heung-min",
  "Gabriel", "Rodri", "Bernardo", "Bruno", "Marcus", "Raheem", "Jack", "Declan", "Trent", "Andrew",
  "Alisson", "Ederson", "Thibaut", "Manuel", "Gianluigi", "Iker", "Sergio", "Paolo", "Andrea", "Francesco",
  "Zinedine", "Ronaldinho", "Ronaldo", "Rivaldo", "Kaka", "Samuel", "Didier", "George", "Eric", "Dennis",
  "Thierry", "Patrick", "Michel", "Marco", "Alessandro", "Roberto", "Gareth", "Luis", "Diego", "Carlos",
  "Xavi", "Andres", "Fernando", "David", "Iker", "Gerard", "Sergio", "Cesc", "Pedro", "Neymar",
  "Vinicius", "Rodrygo", "Endrick", "Raphinha", "Casemiro", "Fabinho", "Allison", "Marquinhos", "Militao", "Aubameyang",
];

export const LAST_NAMES = [
  "Messi", "Ronaldo", "Mbappe", "Haaland", "De Bruyne", "Modric", "Salah", "Van Dijk", "Mane", "Lewandowski",
  "Kane", "Bellingham", "Saka", "Foden", "Odegaard", "Osimhen", "Mahrez", "Benzema", "Modric", "Son",
  "Jesus", "Hernandez", "Silva", "Fernandes", "Rashford", "Sterling", "Grealish", "Rice", "Alexander-Arnold", "Robertson",
  "Becker", "Moraes", "Courtois", "Neuer", "Buffon", "Casillas", "Ramos", "Maldini", "Pirlo", "Totti",
  "Zidane", "Gaucho", "Nazario", "Rivaldo", "Kaka", "Eto'o", "Drogba", "Weah", "Cantona", "Bergkamp",
  "Henry", "Vieira", "Platini", "Van Basten", "Del Piero", "Baggio", "Bale", "Suarez", "Maradona", "Puyol",
  "Hernandez", "Iniesta", "Torres", "Villa", "Casillas", "Pique", "Busquets", "Fabregas", "Pedro", "Santos",
  "Junior", "Goes", "Silva", "Dias", "Casemiro", "Henderson", "Alisson", "Marquinhos", "Aubameyang", "Martinelli",
];

export const NATIONS = [
  "Argentina", "Portugal", "France", "Norway", "Belgium", "Croatia", "Egypt", "Netherlands", "Senegal", "Poland",
  "England", "Nigeria", "Algeria", "Spain", "Brazil", "Germany", "Italy", "Uruguay", "Cameroon", "Ivory Coast",
  "Ghana", "Morocco", "Tunisia", "South Korea", "Japan", "Mexico", "USA", "Colombia", "Chile", "Wales",
];

export const POSITIONS = ["Goalkeeper", "Centre-back", "Full-back", "Defensive midfielder", "Central midfielder", "Attacking midfielder", "Winger", "Striker"];

export const CLUB_NAMES = [
  "Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal", "Tottenham",
  "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia",
  "Bayern Munich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
  "Juventus", "AC Milan", "Inter Milan", "Napoli", "Roma", "Lazio",
  "Paris Saint-Germain", "Marseille", "Lyon", "Monaco",
  "Ajax", "PSV", "Feyenoord", "Benfica", "Porto", "Sporting CP",
  "Celtic", "Rangers", "Galatasaray", "Fenerbahce", "Besiktas",
  "River Plate", "Boca Juniors", "Flamengo", "Palmeiras", "Santos",
  "LA Galaxy", "Inter Miami", "Al Nassr", "Al Hilal",
];

export const LEAGUES = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", "Eredivisie", "Primeira Liga", "MLS", "Saudi Pro League"];

export const NICKNAMES = ["The Blues", "The Reds", "The Gunners", "The Lilywhites", "The Citizens", "Los Blancos", "Blaugrana", "The Old Lady", "Rossoneri", "Nerazzurri"];

export const STADIUMS = ["Old Trafford", "Anfield", "Stamford Bridge", "Emirates Stadium", "Etihad Stadium", "Camp Nou", "Santiago Bernabeu", "Allianz Arena", "San Siro", "Parc des Princes"];

export const TROPHIES = ["Champions League", "World Cup", "Ballon d'Or", "Premier League", "La Liga", "Copa America", "AFCON", "Europa League"];

export const TF_TEMPLATES: { text: string; answer: boolean; explain: string }[] = [
  { text: "A throw-in cannot result directly in a goal.", answer: true, explain: "Goals from throw-ins must touch another player first." },
  { text: "The offside rule applies in your own half.", answer: false, explain: "You cannot be offside in your own half." },
  { text: "A goalkeeper can hold the ball for a maximum of six seconds.", answer: true, explain: "Law 12 — six-second rule when ball is in hands." },
  { text: "A direct free kick can be scored without touching another player.", answer: true, explain: "Direct free kicks may enter the goal directly." },
  { text: "Substituted players may return to the pitch in standard football.", answer: false, explain: "Except concussion subs in some competitions, return is not allowed." },
  { text: "VAR checks all offside decisions automatically.", answer: false, explain: "VAR intervenes for clear errors in defined situations." },
  { text: "A penalty shootout uses five kicks per team initially.", answer: true, explain: "Best of five, then sudden death." },
  { text: "The NBA three-point line is the same distance in all arenas.", answer: false, explain: "Corner vs arc distances differ historically." },
  { text: "Cricket overs consist of six legal deliveries.", answer: true, explain: "Standard over = 6 balls." },
  { text: "A tennis tiebreak is won at seven points.", answer: false, explain: "Win by two with minimum seven." },
];

export const SPEED_TEMPLATES: { prompt: string; options: string[]; answerIndex: number }[] = [
  { prompt: "How many players per team on the pitch in football?", options: ["9", "10", "11", "12"], answerIndex: 2 },
  { prompt: "Which country won the 2022 FIFA World Cup?", options: ["France", "Argentina", "Brazil", "Croatia"], answerIndex: 1 },
  { prompt: "Champions League winners 2024?", options: ["Man City", "Real Madrid", "Bayern", "Inter"], answerIndex: 1 },
  { prompt: "Ballon d'Or is awarded for excellence in…", options: ["Coaching", "Football", "Refereeing", "Commentary"], answerIndex: 1 },
  { prompt: "AFCON 2024 host nation?", options: ["Nigeria", "Ivory Coast", "Egypt", "South Africa"], answerIndex: 1 },
  { prompt: "Length of a football match (standard)?", options: ["80 min", "90 min", "100 min", "120 min"], answerIndex: 1 },
  { prompt: "Maximum substitutions (most modern leagues)?", options: ["3", "4", "5", "6"], answerIndex: 2 },
  { prompt: "Penalty spot distance from goal line?", options: ["9m", "11m", "12m", "16m"], answerIndex: 2 },
];

export const FIQ_TEMPLATES = [
  { title: "Counter-attack", ctx: "You win the ball. {n} runners ahead. High line.", best: "through_ball" as const },
  { title: "Wide overload", ctx: "Winger beats full-back. {n} defenders in box.", best: "cross" as const },
  { title: "1v1 chance", ctx: "Striker facing keeper. Defender recovering.", best: "shoot" as const },
  { title: "Offside trap", ctx: "Line steps up. Attacker times run.", best: "pass_left" as const },
  { title: "Final third", ctx: "Crowded box. Cut-back available.", best: "cut_inside" as const },
  { title: "Late equalizer", ctx: "90th minute. Need a goal. Crowd pressure.", best: "shoot" as const },
  { title: "Low block", ctx: "Deep defence. Space for edge-of-box shot.", best: "shoot" as const },
  { title: "Overlap", ctx: "Full-back overlapping. Striker near post.", best: "cross" as const },
];

export const OPTION_LABELS: Record<string, string> = {
  shoot: "Shoot",
  pass_left: "Pass wide / hold shape",
  through_ball: "Through ball",
  cut_inside: "Cut inside",
  cross: "Cross",
};
