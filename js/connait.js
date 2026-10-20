// Lecture de l'état d'une partie On se connaît publié par le téléphone qui
// la mène (champ `connait` de parties/{code}, voir
// lib/features/on_se_connait/partage_connait.dart). Rien ici ne touche à
// la page : tout se teste dans tests.html.
//
// Les secrets des joueurs ne sont jamais publiés : seulement quelles
// questions ont reçu une réponse, puis, à la révélation, ce que montre
// l'écran de la tablée.

export const MODE_CONNAIT = 'onSeConnait';
export const VERSION_CONNAIT = 1;

// lib/domain/models/question_proches.dart (CategorieProches) et
// lib/features/on_se_connait/widgets/elements_proches.dart (couleurs).
export const CATEGORIES = {
  devineMaReponse: { libelle: 'Devine ma réponse', couleur: '#FF48B0' },
  quiARepondu: { libelle: 'Devine qui a répondu ça', couleur: '#0078BF' },
  plusSusceptible: { libelle: 'Le plus susceptible de…', couleur: '#00A95C' },
  souvenirs: { libelle: 'Souvenirs communs', couleur: '#FFE800' },
};

export const estConnait = (etat) => !!etat && etat.mode === MODE_CONNAIT;

// En phase 1 (secrets), on désigne un joueur pour les questions à vote ;
// « Devine qui a répondu ça » se répond par une proposition.
export const voteSurJoueurs = (categorie) => categorie === 'plusSusceptible' || categorie === 'souvenirs';

const PHASE_SECRETS = ['passeSecrets', 'secret', 'attenteSecrets'];
const ETAPES = [...PHASE_SECRETS, 'tirage', 'devinette', 'revelation', 'terminee'];

function lireQuestion(q) {
  if (!q || typeof q.secret !== 'string' || !CATEGORIES[q.categorie]) return null;
  return {
    id: String(q.id ?? ''),
    categorie: q.categorie,
    secret: q.secret,
    propositions: Array.isArray(q.propositions) ? q.propositions.map(String) : [],
    heros: typeof q.heros === 'string' ? q.heros : null,
  };
}

const listes = (m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {})
  .map(([id, l]) => [id, Array.isArray(l) ? l.map(Number) : []]));

const nombres = (m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {})
  .map(([id, v]) => [id, Number(v) || 0]));

// Vue lisible de l'état publié ; `null` s'il est illisible ;
// `{ tropRecent: true }` pour un format plus récent que cette page.
export function lireConnait(etat) {
  if (!estConnait(etat) || !etat.connait || typeof etat.connait !== 'object') return null;
  const c = etat.connait;
  if ((Number(c.version) || 1) > VERSION_CONNAIT) return { tropRecent: true };
  if (!Array.isArray(c.joueurs) || !ETAPES.includes(c.etape)) return null;
  const joueurs = c.joueurs.map((j) => ({
    id: String(j.id), nom: String(j.nom), couleur: Number(j.couleur) || 0, accessoire: j.accessoire || null,
  }));
  if (joueurs.length === 0) return null;
  const m = c.manche;
  const manche = m && typeof m === 'object' && lireQuestion(m.question) ? {
    numero: Number(m.numero) || 1,
    question: lireQuestion(m.question),
    devineur: String(m.devineur),
    enonce: String(m.enonce ?? ''),
    revelee: typeof m.juste === 'boolean',
    juste: m.juste === true,
    vises: Array.isArray(m.vises) ? m.vises.map(String) : [],
    choixHeros: typeof m.choixHeros === 'number' ? m.choixHeros : null,
    voix: nombres(m.voix),
    gains: nombres(m.gains),
  } : null;
  const scores = nombres(c.scores);
  const vue = {
    joueurs,
    etape: c.etape,
    phaseSecrets: PHASE_SECRETS.includes(c.etape),
    nombreQuestions: Number(c.nombreQuestions) || 0,
    telephones: c.telephones && typeof c.telephones === 'object' ? { ...c.telephones } : {},
    scores,
    questions: (Array.isArray(c.questions) ? c.questions : []).map(lireQuestion),
    secrets: listes(c.secrets),
    repondus: listes(c.repondus),
    surPlace: typeof c.surPlace === 'string' ? c.surPlace : null,
    manche: manche && manche.question ? manche : null,
    classement: (Array.isArray(c.classement) ? c.classement : []).map((l, ordre) => ({
      joueur: joueurs.find((j) => j.id === l.id) || { id: String(l.id), nom: '?', couleur: 0 },
      score: Number(l.score) || 0, bonnes: Number(l.bonnes) || 0, jouees: Number(l.jouees) || 0, ordre,
    })),
  };
  vue.classement.forEach((l, i) => {
    l.rang = i > 0 && l.score === vue.classement[i - 1].score ? vue.classement[i - 1].rang : i + 1;
  });
  vue.joueur = (id) => joueurs.find((j) => j.id === id) || null;
  // Classement en cours (scores publiés), ordre des joueurs à égalité.
  vue.classementEnCours = () => {
    const lignes = joueurs.map((j, ordre) => ({ joueur: j, ordre, score: scores[j.id] || 0 }))
      .sort((a, b) => b.score - a.score || a.ordre - b.ordre);
    lignes.forEach((l, i) => { l.rang = i > 0 && l.score === lignes[i - 1].score ? lignes[i - 1].rang : i + 1; });
    return lignes;
  };
  return vue;
}

// Questions du joueur [id] encore sans réponse (sauf celles déjà parties
// de cette page, [envoyees]).
export function restants(vue, id, envoyees = new Set()) {
  const faites = new Set(vue.repondus[id] || []);
  return (vue.secrets[id] || []).filter((q) => !faites.has(q) && !envoyees.has(q));
}

// Pourquoi le joueur [id] ne peut pas répondre ici (ou null s'il le peut).
export function occupation(vue, id, uid) {
  if (!vue.phaseSecrets) return 'Phase des secrets terminée';
  if (!(vue.secrets[id] || []).length || !restants(vue, id).length) return 'Secrets gardés';
  if (vue.surPlace === id) return 'Répond sur le téléphone de la tablée';
  if (vue.telephones[id] && vue.telephones[id] !== uid) return 'Répond sur son téléphone';
  return null;
}

// « Encore 3 secrets », ou « Secrets gardés ».
export function avancement(vue, id, envoyees = new Set()) {
  const reste = restants(vue, id, envoyees).length;
  return reste === 0 ? 'Secrets gardés' : `Encore ${reste} secret${reste > 1 ? 's' : ''}`;
}
