// Lecture de l'état d'une partie Tour à tour publié par le téléphone qui
// la mène (parties/{code}, voir lib/data/partage/partage_partie.dart).
// Rien ici ne touche à la page : tout se teste dans tests.html.
//
// Le téléphone qui mène reste seul juge : la page ne calcule ni points ni
// chrono officiel, elle affiche ce qu'il publie. Les tables ci-dessous ne
// servent que pour un téléphone en 0.1.8 (protocole 1), qui ne publie pas
// encore les règles chiffrées.

export const PROTOCOLE_CONNU = 2;
export const LETTRES = ['A', 'B', 'C', 'D'];

// lib/domain/models/niveau_difficulte.dart et core/theme/couleurs_niveau.dart
export const NIVEAUX = [
  { id: 'petitCurieux', libelle: 'Petit curieux', couleur: '#00A95C' },
  { id: 'petitMalin', libelle: 'Petit malin', couleur: '#0078BF' },
  { id: 'pilierDeTable', libelle: 'Esprit vif', couleur: '#FFB511' },
  { id: 'championDeLaMaison', libelle: 'Champion de la maison', couleur: '#FF6C2F' },
  { id: 'legendeDeLaFamille', libelle: 'Légende de la famille', couleur: '#914E72' },
];

// core/theme/app_colors.dart : Joueur.couleur est un index ici.
const AVATARS = ['#FF48B0', '#0078BF', '#FFE800', '#00A95C', '#FF6C2F', '#914E72', '#FFB511', '#00838A'];
const AVATARS_RECOMPENSE = ['#7A3CE0', '#8BC34A', '#5C6BC0', '#B0805A'];

export function couleurAvatar(index) {
  const i = Number(index) || 0;
  if (i >= AVATARS.length && i < AVATARS.length + AVATARS_RECOMPENSE.length) return AVATARS_RECOMPENSE[i - AVATARS.length];
  return AVATARS[((i % AVATARS.length) + AVATARS.length) % AVATARS.length];
}

// Encre ou blanc, celle qui contraste le plus (comme AppColors.texteSur).
export function texteSur(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const encre = 0.0291; // luminance de #1D2B4F
  const contrasteEncre = (Math.max(l, encre) + 0.05) / (Math.min(l, encre) + 0.05);
  const contrasteBlanc = 1.05 / (l + 0.05);
  return contrasteEncre >= contrasteBlanc ? '#1D2B4F' : '#FFFFFF';
}

// domain/xp/recompenses.dart (Accessoire) : un emoji simple par accessoire.
export const ACCESSOIRES = {
  lunettes: '👓', noeud: '🎀', magicien: '🎩', astronaute: '🚀', couronne: '👑',
  plume: '🪶', bonnetDeNuit: '🌙', chapeauDeFete: '🥳', maracas: '🎶',
};

export const JOKERS = {
  cinquante: { nom: '50/50', emoji: '✂️' },
  temps: { nom: '+10 s', emoji: '⏱️' },
  appel: { nom: 'Appel', emoji: '📞' },
};

// features/tour_a_tour/regles_tour_a_tour.dart (repli pour le protocole 1).
const CHRONOS = {
  flanerie: [25, 30, 35, 35, 35],
  balade: [17, 20, 25, 25, 25],
  sprint: [11, 13, 15, 15, 15],
};
const BAREME = [[8, 0], [12, 6], [16, 8], [20, 10], [24, 14]];
const DELAI_DECISION_MS = 8000;

// Marge après la fin affichée du chrono (domain/chrono.dart).
export const GRACE_MS = 300;
// La fin du chrono attend un doigt posé à temps, au plus une seconde.
export const ATTENTE_DOIGT_MS = 1000;
// Un choix qui vient d'apparaître ignore les touchers (GardeToucher).
export const GARDE_TOUCHER_MS = 350;

const demiPoint = (v) => Math.round(v * 2) / 2;

// Nombre de points à la française : 19, 19,5, −8.
export function formatPoints(points) {
  const texte = Number.isInteger(points) ? String(points) : points.toFixed(1).replace('.', ',');
  return texte.replace('-', '−');
}

export function formatPointsSigne(points) {
  return points > 0 ? `+${formatPoints(points)}` : formatPoints(points);
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Code de partie lu dans un lien ou saisi (comme PartagePartie.codeDepuis).
export function codeDepuis(texte) {
  if (!texte) return null;
  let brut = String(texte).trim();
  try {
    const lien = new URL(brut);
    if (lien.pathname.endsWith('groupe.html')) return null;
    brut = lien.searchParams.get('code') || '';
  } catch (_) { /* pas un lien : le code seul */ }
  brut = brut.toUpperCase().replace(/\s/g, '');
  return brut.length === 6 && [...brut].every((c) => ALPHABET.includes(c)) ? brut : null;
}

// Classement (domain/classement/classement_partie.dart) : cumul des points,
// ex aequo au même rang, ordre de passage conservé à égalité.
export function classement(joueurs, reponses) {
  const lignes = joueurs.map((j, ordre) => ({ joueur: j, ordre, score: 0, bonnes: 0, jouees: 0 }));
  const parId = Object.fromEntries(lignes.map((l) => [l.joueur.id, l]));
  for (const r of reponses) {
    const l = parId[r.joueurId];
    if (!l) continue;
    l.score += r.points;
    l.jouees += 1;
    if (r.correcte) l.bonnes += 1;
  }
  lignes.sort((a, b) => b.score - a.score || a.ordre - b.ordre);
  lignes.forEach((l, i) => {
    l.rang = i > 0 && l.score === lignes[i - 1].score ? lignes[i - 1].rang : i + 1;
  });
  return lignes;
}

// Vue lisible de l'état publié. `null` si l'état est illisible.
export function lirePartie(etat) {
  if (!etat || !Array.isArray(etat.joueurs) || typeof etat.etape !== 'string') return null;
  const protocole = Number(etat.protocole) || 1;
  const joueurs = etat.joueurs.map((j) => ({
    id: String(j.id),
    nom: String(j.nom),
    couleur: Number(j.couleur) || 0,
    accessoire: j.accessoire || null,
  }));
  if (joueurs.length === 0) return null;
  const vitesse = CHRONOS[etat.vitesse] ? etat.vitesse : 'balade';
  const questionsParJoueur = Number(etat.questionsParJoueur) || ({ eclair: 4, classique: 8, marathon: 12 }[etat.style] ?? 8);
  const tour = Number(etat.tour) || 0;
  const indexNiveau = NIVEAUX.findIndex((n) => n.id === etat.niveau);
  const niveau = indexNiveau >= 0 ? NIVEAUX[indexNiveau] : null;
  const surprise = !!etat.surprise;
  const rallonge = !!etat.rallonge;
  const bonusTempsMs = Number(etat.bonusTempsMs) || 0;
  const q = etat.question;
  const question = q && Array.isArray(q.propositions) ? {
    id: q.id,
    enonce: String(q.question ?? ''),
    propositions: q.propositions.map(String),
    bonne: Number(q.bonne_reponse_index),
  } : null;
  const reponses = (Array.isArray(etat.reponses) ? etat.reponses : []).map((r) => ({
    joueurId: r.joueurId,
    niveau: r.niveau,
    proposition: r.propositionChoisie ?? null,
    correcte: !!r.correcte,
    points: Number(r.points) || 0,
    tempsMs: Number(r.tempsReponseMs) || 0,
    rallonge: !!r.rallonge,
  }));

  // Enjeux de chaque niveau : publiés (protocole 2) ou tables de repli.
  const enjeux = {};
  NIVEAUX.forEach((n, i) => {
    const publie = etat.enjeux && etat.enjeux[n.id];
    enjeux[n.id] = publie
      ? { gain: Number(publie.gain), perte: Number(publie.perte), chronoMs: Number(publie.chronoMs) }
      : { gain: BAREME[i][0], perte: BAREME[i][1], chronoMs: CHRONOS[vitesse][i] * 1000 };
  });
  let dureeChronoMs = Number(etat.dureeChronoMs) || 0;
  let gainEnJeu = Number(etat.gainEnJeu);
  let perteEnJeu = Number(etat.perteEnJeu);
  let prixRallonge = Number(etat.prixRallonge);
  let dureeRallongeMs = Number(etat.dureeRallongeMs);
  if (niveau && !etat.dureeChronoMs) {
    const base = BAREME[indexNiveau];
    const chrono = CHRONOS[vitesse][indexNiveau];
    dureeRallongeMs = Math.ceil(chrono * 0.5) * 1000;
    dureeChronoMs = (rallonge ? dureeRallongeMs : chrono * 1000) + bonusTempsMs;
    gainEnJeu = base[0] * (surprise ? 2 : 1);
    perteEnJeu = surprise ? gainEnJeu : base[1];
    prixRallonge = demiPoint(base[0] * 0.5);
  }

  const vue = {
    protocole,
    tropRecent: protocole > PROTOCOLE_CONNU,
    joueurs,
    etape: etat.etape,
    tour,
    questionsParJoueur,
    nombreTours: joueurs.length * questionsParJoueur,
    niveau,
    surprise,
    rallonge,
    question,
    reponses,
    jokers: Array.isArray(etat.jokers) ? etat.jokers.filter((j) => JOKERS[j]) : [],
    jokersJoues: etat.jokersJoues || {},
    retirees: Array.isArray(etat.retirees) ? etat.retirees.map(Number) : [],
    bonusTempsMs,
    appel: !!etat.appel,
    ecouleMs: Number(etat.ecouleMs) || 0,
    disponibles: Array.isArray(etat.disponibles) ? etat.disponibles : NIVEAUX.map((n) => n.id),
    enjeux,
    dureeChronoMs,
    gainEnJeu,
    perteEnJeu,
    prixRallonge,
    dureeRallongeMs,
    delaiDecisionMs: Number(etat.delaiDecisionMs) || DELAI_DECISION_MS,
    taquinerie: typeof etat.taquinerie === 'string' ? etat.taquinerie : null,
  };
  vue.joueurCourant = joueurs[tour % joueurs.length];
  vue.numeroQuestion = Math.floor(tour / joueurs.length) + 1;
  vue.dernierTour = tour === vue.nombreTours - 1;
  vue.derniereReponse = reponses.length ? reponses[reponses.length - 1] : null;
  vue.classement = classement(joueurs, reponses);
  vue.scorePour = (id) => reponses.filter((r) => r.joueurId === id).reduce((t, r) => t + r.points, 0);
  vue.jokerJoue = (id, joker) => Array.isArray(vue.jokersJoues[id]) && vue.jokersJoues[id].includes(joker);
  return vue;
}

// Temps écoulé dans l'étape chronométrée, à [maintenant], d'après l'état
// reçu à [recuA] (même calcul que PartieMiroir.ecouleEtape).
export function ecouleA(vue, recuA, maintenant) {
  if (vue.etape === 'question' && vue.appel) return vue.ecouleMs;
  if (vue.etape === 'question' || vue.etape === 'tempsEcoule') return vue.ecouleMs + Math.max(0, maintenant - recuA);
  return 0;
}

// Durée du chrono affiché : la question (ou la rallonge), ou le temps de
// décider s'il faut prendre la rallonge.
export function dureeAffichee(vue) {
  return vue.etape === 'tempsEcoule' ? vue.delaiDecisionMs : vue.dureeChronoMs;
}

// Verdict d'une réponse, comme sur le téléphone : « Bravo ! +14 pts ».
export function verdict(reponse) {
  const p = reponse.points;
  if (reponse.correcte) return `Bravo ! ${formatPointsSigne(p)} pts`;
  const suite = p < 0 ? ` ${formatPoints(p)} pts` : '';
  return reponse.proposition === null ? `Temps écoulé !${suite}` : `Raté !${suite}`;
}

// Enjeu d'un niveau, comme sur l'étiquette : « +12 / −6 ».
export function enjeu(e) {
  return `+${e.gain} / ${e.perte === 0 ? '0' : `−${e.perte}`}`;
}
