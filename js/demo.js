// Mode démo (?demo=1) : un faux téléphone hôte, dans la page, pour essayer
// la page web et la télé sans Firebase ni second appareil. Il imite le
// format publié par l'appli (etatPartage + pourInvites) et joue lui-même
// pour les autres joueurs. Ce n'est pas la logique officielle : les points
// et le chrono qui comptent restent ceux du téléphone qui mène.
//
// ?scene=choix|question|rallonge|correction|attente|miParcours|podium fige
// la partie sur un écran (captures, essais de mise en page).
//
// &long=1 : énoncé et propositions les plus longs (essais de mise en page).
//
// &hote=0181 imite un téléphone en 0.1.8.1 (protocole 1 : ni règles
// chiffrées, ni petite phrase, ni « bonjour ») ; &lent=1 : personne ne
// touche « Suivant » sur le téléphone qui mène.
//
// ?demo=connait : une partie On se connaît (lib/features/on_se_connait/
// partage_connait.dart), où Mamie Jo répond sur le téléphone de la tablée
// et Tom sur le sien ; ?scene=qui|secret|gardes|devinette|revelation|podium.

const QUESTIONS = {
 "petitCurieux": [
  {
   "question": "Comment appelle-t-on la maison que l'oiseau construit ?",
   "propositions": [
    "L'étable",
    "La niche",
    "Le terrier",
    "Le nid"
   ],
   "bonne_reponse_index": 3
  },
  {
   "question": "Sur quoi le peintre peint-il souvent ses tableaux ?",
   "propositions": [
    "Une toile",
    "Une assiette",
    "Une fenêtre",
    "Un ballon"
   ],
   "bonne_reponse_index": 0
  },
  {
   "question": "Quel animal est T'choupi ?",
   "propositions": [
    "Un ours",
    "Un chat",
    "Un pingouin",
    "Un lapin"
   ],
   "bonne_reponse_index": 2
  }
 ],
 "petitMalin": [
  {
   "question": "Combien de cartes compte un jeu classique, sans les jokers ?",
   "propositions": [
    "32",
    "54",
    "40",
    "52"
   ],
   "bonne_reponse_index": 3
  },
  {
   "question": "Dans « Cars », comment s'appelle la dépanneuse rouillée amie de Flash McQueen ?",
   "propositions": [
    "Martin",
    "Sally",
    "Doc Hudson",
    "Luigi"
   ],
   "bonne_reponse_index": 0
  },
  {
   "question": "Dans quel sport réussit-on un « strike » en renversant toutes les quilles ?",
   "propositions": [
    "Le golf",
    "Le bowling",
    "Le billard",
    "La pétanque"
   ],
   "bonne_reponse_index": 1
  }
 ],
 "pilierDeTable": [
  {
   "question": "Quel philosophe grec antique fut le maître d'Aristote ?",
   "propositions": [
    "Socrate",
    "Pythagore",
    "Épicure",
    "Platon"
   ],
   "bonne_reponse_index": 3
  },
  {
   "question": "Quel élément chimique est essentiel à la respiration et représente environ 21% de l'atmosphère ?",
   "propositions": [
    "L'azote",
    "Le carbone",
    "L'oxygène",
    "L'hydrogène"
   ],
   "bonne_reponse_index": 2
  },
  {
   "question": "Quel compositeur autrichien du 18e siècle a écrit « La Flûte enchantée » ?",
   "propositions": [
    "Bach",
    "Mozart",
    "Vivaldi",
    "Beethoven"
   ],
   "bonne_reponse_index": 1
  }
 ],
 "championDeLaMaison": [
  {
   "question": "Quelle bande dessinée de Riad Sattouf raconte son enfance en Libye et en Syrie ?",
   "propositions": [
    "Persepolis",
    "L'Arabe du futur",
    "Maus",
    "Les Cahiers d'Esther"
   ],
   "bonne_reponse_index": 1
  },
  {
   "question": "Quelle dynastie a régné sur la France juste avant les Bourbons ?",
   "propositions": [
    "Les Orléans",
    "Les Carolingiens",
    "Les Valois",
    "Les Capétiens directs"
   ],
   "bonne_reponse_index": 2
  },
  {
   "question": "Quel mouvement de Matisse et Derain se caractérise par des couleurs pures et violentes ?",
   "propositions": [
    "Le fauvisme",
    "Le cubisme",
    "Le pointillisme",
    "Le surréalisme"
   ],
   "bonne_reponse_index": 0
  }
 ],
 "legendeDeLaFamille": [
  {
   "question": "Qui a été le premier à courir le mile en moins de 4 minutes, en 1954 ?",
   "propositions": [
    "Roger Bannister",
    "John Landy",
    "Emil Zátopek",
    "Paavo Nurmi"
   ],
   "bonne_reponse_index": 0
  },
  {
   "question": "Lors de quelle bataille François Ier a-t-il été fait prisonnier, en 1525 ?",
   "propositions": [
    "Pavie",
    "Cérisoles",
    "Ravenne",
    "Marignan"
   ],
   "bonne_reponse_index": 0
  },
  {
   "question": "Quel élément chimique a pour numéro atomique 26 ?",
   "propositions": [
    "Le cobalt",
    "Le fer",
    "Le nickel",
    "Le cuivre"
   ],
   "bonne_reponse_index": 1
  }
 ]
};

const BAREME = { petitCurieux: [8, 0], petitMalin: [12, 6], pilierDeTable: [16, 8], championDeLaMaison: [20, 10], legendeDeLaFamille: [24, 14] };
const CHRONOS = { petitCurieux: 17, petitMalin: 20, pilierDeTable: 25, championDeLaMaison: 25, legendeDeLaFamille: 25 };
const LIBELLES = { petitCurieux: 'Petit curieux', petitMalin: 'Petit malin', pilierDeTable: 'Esprit vif', championDeLaMaison: 'Champion de la maison', legendeDeLaFamille: 'Légende de la famille' };
const PHRASES_JUSTE = ['{nom} a un cerveau en or massif !', 'Et paf, dans le mille !', 'Waouh ! Même le chat est impressionné.'];
const PHRASES_FAUX = ['Pas grave, {nom}, la prochaine est pour toi.', 'Raté, mais avec panache !', 'On dira que c\'était une question piège.'];

const JOUEURS = [
  { id: 'mamie', nom: 'Mamie Jo', couleur: 5, accessoire: 'couronne' },
  { id: 'lea', nom: 'Léa', couleur: 2 },
  { id: 'tom', nom: 'Tom', couleur: 1, accessoire: 'magicien' },
];
const QUESTIONS_PAR_JOUEUR = 2;
const demi = (v) => Math.round(v * 2) / 2;

// Pire cas pour la mise en page : l'énoncé le plus long de assets/questions
// et les propositions les plus longues (essais de la télé, &long=1).
const QUESTION_LONGUE = {
  question: 'Comment appelle-t-on la technique vocale consistant à chanter deux notes simultanément, pratiquée notamment par les chanteurs mongols ?',
  propositions: ['Service municipal d\'information citoyenne', 'Système monétaire international commun', 'Société mutuelle d\'investissement collectif', 'Salaire minimum interprofessionnel de croissance'],
  bonne_reponse_index: 3,
};

export function connexionDemo({ scene = null, jeu = null } = {}) {
  if (jeu === 'connait') return connexionDemoConnait({ scene });
  const options = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const ancien = options.get('hote') === '0181';
  const lent = options.has('lent');
  const ecouteurs = new Set();
  const s = {
    etape: 'choixNiveau', tour: 0, niveau: null, surprise: false, question: null, reponses: [], rallonge: false,
    bonus: 0, retirees: [], joues: {}, appel: false, debut: 0, decision: 0, fige: !!scene, invite: null, minuterie: null, auto: null,
  };
  const pioche = Object.fromEntries(Object.entries(QUESTIONS).map(([k, v]) => [k, [...v]]));
  const total = JOUEURS.length * QUESTIONS_PAR_JOUEUR;
  const courant = () => JOUEURS[s.tour % JOUEURS.length];
  const duree = () => ((s.rallonge ? Math.ceil(CHRONOS[s.niveau] / 2) : CHRONOS[s.niveau]) * 1000) + s.bonus;
  const ecoule = () => (s.etape === 'question' ? Date.now() - s.debut : s.etape === 'tempsEcoule' ? Date.now() - s.decision : 0);

  function etat() {
    const enCours = ['question', 'tempsEcoule', 'correction'].includes(s.etape);
    const [gain, perte] = s.niveau ? BAREME[s.niveau] : [0, 0];
    const r = s.reponses[s.reponses.length - 1];
    const phrases = r && r.correcte ? PHRASES_JUSTE : PHRASES_FAUX;
    const publie = JSON.parse(JSON.stringify({
      protocole: 2, hote: 'demo', joueurs: JOUEURS, style: 'eclair', questionsParJoueur: QUESTIONS_PAR_JOUEUR, vitesse: 'balade',
      etape: s.etape, tour: s.tour, niveau: s.niveau, surprise: s.surprise, question: s.question,
      reponses: s.reponses, rallonge: s.rallonge, jokers: ['cinquante', 'temps'], jokersJoues: s.joues,
      retirees: s.retirees, bonusTempsMs: s.bonus, appel: s.appel, ecouleMs: ecoule(),
      disponibles: Object.keys(BAREME), derniersAMiParcours: [],
      enjeux: Object.fromEntries(Object.keys(BAREME).map((k) => [k, { libelle: LIBELLES[k], gain: BAREME[k][0], perte: BAREME[k][1], chronoMs: CHRONOS[k] * 1000 }])),
      delaiDecisionMs: 8000,
      ...(enCours ? { dureeChronoMs: duree(), dureeRallongeMs: Math.ceil(CHRONOS[s.niveau] / 2) * 1000, prixRallonge: demi(gain / 2), gainEnJeu: gain, perteEnJeu: perte } : {}),
      ...(s.etape === 'correction' && r ? { taquinerie: phrases[s.reponses.length % phrases.length].replace('{nom}', courant().nom) } : {}),
    }));
    if (ancien) {
      for (const champ of ['protocole', 'enjeux', 'delaiDecisionMs', 'dureeChronoMs', 'dureeRallongeMs', 'prixRallonge', 'gainEnJeu', 'perteEnJeu', 'taquinerie']) delete publie[champ];
    }
    return publie;
  }

  function publier() {
    const e = etat();
    // Le temps du réseau.
    setTimeout(() => ecouteurs.forEach((f) => f(e)), 120);
    if (!s.fige) planifierAuto();
  }

  function minuter(ms, f) { clearTimeout(s.minuterie); s.minuterie = setTimeout(f, ms); }

  function choisirNiveau(niveau) {
    if (s.etape !== 'choixNiveau' || !BAREME[niveau]) return;
    s.niveau = niveau;
    const q = pioche[niveau].shift() || QUESTIONS[niveau][0];
    s.question = { id: niveau + s.tour, niveau, domaine: '', ...q };
    s.etape = 'question';
    s.debut = Date.now();
    if (!s.fige) minuter(duree() + 300, finDuChrono);
    publier();
  }

  function finDuChrono() {
    if (s.etape !== 'question') return;
    if (s.rallonge) return enregistrer(null);
    s.etape = 'tempsEcoule';
    s.decision = Date.now();
    minuter(8000, () => enregistrer(null));
    publier();
  }

  function enregistrer(proposition) {
    clearTimeout(s.minuterie);
    const [gain, perte] = BAREME[s.niveau];
    const t = Math.min(ecoule(), duree());
    const correcte = proposition === s.question.bonne_reponse_index;
    const prix = s.rallonge ? demi(gain / 2) : 0;
    const bonus = t / duree() <= 1 / 3 ? 0.3 : t / duree() <= 2 / 3 ? 0.1 : 0;
    const points = !correcte ? -perte - prix : s.rallonge ? gain - prix : demi(gain * (1 + bonus));
    s.reponses.push({ questionId: s.question.id, joueurId: courant().id, niveau: s.niveau, propositionChoisie: proposition, correcte, tempsReponseMs: t, points, rallonge: s.rallonge });
    s.etape = 'correction';
    publier();
  }

  function suivant() {
    if (s.etape !== 'correction') return;
    Object.assign(s, { tour: s.tour + 1, niveau: null, question: null, rallonge: false, bonus: 0, retirees: [], appel: false });
    s.etape = s.tour >= total ? 'terminee' : s.tour === JOUEURS.length ? 'miParcours' : 'choixNiveau';
    publier();
  }

  function appliquer(c) {
    if (c.action === 'bonjour') { s.invite = c.joueurId || null; return publier(); }
    if (c.tour !== s.tour || c.etape !== s.etape) return;
    switch (c.action) {
      case 'niveau': return choisirNiveau(c.valeur);
      case 'repondre': return s.etape === 'question' && enregistrer(typeof c.valeur === 'number' ? c.valeur : null);
      case 'prendreRallonge':
        if (s.etape !== 'tempsEcoule') return;
        Object.assign(s, { rallonge: true, bonus: 0, etape: 'question', debut: Date.now() });
        if (!s.fige) minuter(duree() + 300, finDuChrono);
        return publier();
      case 'refuserRallonge': return s.etape === 'tempsEcoule' && enregistrer(null);
      case 'joker': {
        const id = courant().id;
        if ((s.joues[id] || []).includes(c.valeur)) return;
        s.joues[id] = [...(s.joues[id] || []), c.valeur];
        if (c.valeur === 'cinquante') s.retirees = [0, 1, 2, 3].filter((i) => i !== s.question.bonne_reponse_index).slice(0, 2);
        if (c.valeur === 'temps') { s.bonus += 10000; minuter(duree() - ecoule() + 300, finDuChrono); }
        return publier();
      }
      case 'suivant': return suivant();
      case 'reprendre': if (s.etape === 'miParcours') { s.etape = 'choixNiveau'; publier(); } return;
      default:
    }
  }

  // Les autres joueurs jouent tout seuls, pour qu'on voie la partie avancer.
  function planifierAuto() {
    clearTimeout(s.auto);
    const moi = s.invite && courant().id === s.invite;
    const quand = (ms, f) => { s.auto = setTimeout(f, ms); };
    if (s.etape === 'choixNiveau' && !moi) quand(2200, () => choisirNiveau(Object.keys(BAREME)[1 + (s.tour % 3)]));
    else if (s.etape === 'question' && !moi && !s.rallonge) {
      const bonne = s.question.bonne_reponse_index;
      quand(3500, () => enregistrer(s.tour % 3 === 2 ? (bonne + 1) % 4 : bonne));
    } else if (s.etape === 'correction' && !moi && !lent) quand(3500, suivant);
    else if (s.etape === 'miParcours') quand(4000, () => { s.etape = 'choixNiveau'; publier(); });
  }

  // Scènes figées pour les captures.
  function preparer(nom) {
    const reponse = (j, niveau, correcte, points) => ({ questionId: 'x' + j + niveau, joueurId: j, niveau, propositionChoisie: correcte ? 0 : 1, correcte, tempsReponseMs: 4000, points, rallonge: false });
    const passe = [reponse('mamie', 'championDeLaMaison', true, 26), reponse('lea', 'petitMalin', true, 15.5), reponse('tom', 'pilierDeTable', false, -8)];
    if (nom === 'podium') { s.reponses = [...passe, reponse('mamie', 'legendeDeLaFamille', false, -14), reponse('lea', 'pilierDeTable', true, 21), reponse('tom', 'petitMalin', true, 12)]; s.tour = total; s.etape = 'terminee'; return; }
    if (nom === 'miParcours') { s.reponses = passe; s.tour = 3; s.etape = 'miParcours'; return; }
    s.reponses = passe; s.tour = nom === 'attente' ? 5 : 4; // 4 = Léa, 5 = Tom
    if (nom === 'choix') return;
    if (nom === 'attente') { choisirNiveau('pilierDeTable'); s.debut = Date.now() - 6000; return; }
    choisirNiveau('petitMalin');
    s.question = { id: 'demo', niveau: 'petitMalin', domaine: '', ...QUESTIONS.petitMalin[2] };
    // &long=1 : le pire cas des fichiers de questions (énoncé et propositions les plus longs).
    if (options.has('long')) s.question = { id: 'demo-long', niveau: 'petitMalin', domaine: '', ...QUESTION_LONGUE };
    s.debut = Date.now() - 7000;
    if (nom === 'rallonge') { s.etape = 'tempsEcoule'; s.decision = Date.now() - 2000; }
    if (nom === 'correction') { s.debut = Date.now() - 4000; enregistrer(s.question.bonne_reponse_index); }
  }
  if (scene) preparer(scene);

  return {
    uid: 'demo-invite',
    suivre(code, surEtat) {
      ecouteurs.add(surEtat);
      setTimeout(() => surEtat(etat()), 300);
      return () => ecouteurs.delete(surEtat);
    },
    async envoyer(code, commande) { setTimeout(() => appliquer(commande), 120); },
  };
}

// --- On se connaît ---------------------------------------------------------

const QUESTIONS_CONNAIT = [
  { id: 'd1', categorie: 'devineMaReponse', secret: 'Ton dessert préféré ?', devinette: 'Le dessert préféré de {nom} ?', propositions: ['La mousse au chocolat', 'La tarte aux pommes', 'Les crêpes', 'La glace'], heros: 'mamie' },
  { id: 'q1', categorie: 'quiARepondu', secret: 'Le super-pouvoir que tu choisirais ?', propositions: ['Voler', 'Être invisible', 'Parler aux animaux', 'Arrêter le temps'] },
  { id: 'd2', categorie: 'devineMaReponse', secret: 'Où partirais-tu demain ?', devinette: 'Où {nom} partirait-elle demain ?', propositions: ['À la mer', 'À la montagne', 'Au Japon', 'Chez mamie'], heros: 'lea' },
  { id: 'v1', categorie: 'plusSusceptible', secret: 'Qui est le plus susceptible de danser sous la pluie ?', propositions: [] },
  { id: 'd3', categorie: 'devineMaReponse', secret: 'Ton animal préféré ?', devinette: 'L\'animal préféré de {nom} ?', propositions: ['Le chat', 'Le dauphin', 'Le loup', 'Le hibou'], heros: 'tom' },
  { id: 's1', categorie: 'souvenirs', secret: 'Qui a déjà oublié quelqu\'un sur une aire d\'autoroute ?', propositions: [] },
];

function connexionDemoConnait({ scene = null }) {
  const ecouteurs = new Set();
  const n = QUESTIONS_CONNAIT.length;
  const aFaire = Object.fromEntries(JOUEURS.map((j) => [j.id, QUESTIONS_CONNAIT.map((q, i) => (!q.heros || q.heros === j.id ? i : -1)).filter((i) => i >= 0)]));
  // Les secrets restent ici : seul « repondus » est publié.
  const s = {
    etape: 'secret', surPlace: 'mamie', telephones: { tom: 'demo-tom' }, secrets: {}, scores: {}, bonnes: {}, jouees: {},
    question: 0, devineur: null, devinette: null, revelation: null, fige: !!scene, minuterie: null, auto: null,
  };
  const reste = (id) => aFaire[id].filter((q) => !(s.secrets[q] && id in s.secrets[q]));
  const fini = () => JOUEURS.every((j) => reste(j.id).length === 0);
  const nom = (id) => JOUEURS.find((j) => j.id === id).nom;
  const choixDemo = (q, id) => (QUESTIONS_CONNAIT[q].propositions.length ? (id.length + q) % 4 : (q + id.length) % JOUEURS.length);

  function noter(id, q, choix) {
    s.secrets[q] = { ...(s.secrets[q] || {}), [id]: choix };
    if (fini() && ['passeSecrets', 'secret', 'attenteSecrets'].includes(s.etape)) commencerManche(0);
  }

  function commencerManche(i) {
    const q = QUESTIONS_CONNAIT[i];
    s.question = i;
    s.devinette = null;
    s.revelation = null;
    s.surPlace = null;
    const permis = JOUEURS.filter((j) => j.id !== q.heros);
    s.devineur = permis[i % permis.length].id;
    s.etape = 'devinette';
    if (q.categorie === 'quiARepondu') {
      const choix = Object.values(s.secrets[i] || {});
      s.affichee = choix.find((c) => choix.filter((d) => d === c).length === 1) ?? choix[0] ?? 0;
    }
  }

  function vises() {
    const q = QUESTIONS_CONNAIT[s.question];
    const sec = s.secrets[s.question] || {};
    if (q.categorie === 'devineMaReponse') return [q.heros];
    if (q.categorie === 'quiARepondu') return Object.keys(sec).filter((id) => sec[id] === s.affichee);
    const voix = voixDe();
    const max = Math.max(...Object.values(voix));
    return Object.keys(voix).filter((id) => voix[id] === max);
  }

  function voixDe() {
    const voix = Object.fromEntries(JOUEURS.map((j) => [j.id, 0]));
    for (const c of Object.values(s.secrets[s.question] || {})) voix[JOUEURS[c].id] += 1;
    return voix;
  }

  function deviner() {
    const q = QUESTIONS_CONNAIT[s.question];
    const sec = s.secrets[s.question] || {};
    const juste = s.question % 3 !== 2;
    const v = vises();
    s.devinette = q.categorie === 'devineMaReponse'
      ? (juste ? sec[q.heros] : (sec[q.heros] + 1) % 4)
      : JOUEURS.findIndex((j) => (juste ? v.includes(j.id) : !v.includes(j.id) && j.id !== s.devineur));
    const gains = Object.fromEntries(JOUEURS.map((j) => [j.id, 0]));
    s.jouees[s.devineur] = (s.jouees[s.devineur] || 0) + 1;
    if (juste) {
      gains[s.devineur] += 1;
      s.bonnes[s.devineur] = (s.bonnes[s.devineur] || 0) + 1;
      if (q.heros) gains[q.heros] += 1;
    }
    for (const [id, g] of Object.entries(gains)) s.scores[id] = (s.scores[id] || 0) + g;
    s.revelation = { juste, gains, vises: v };
    s.etape = 'revelation';
  }

  function enonce() {
    const q = QUESTIONS_CONNAIT[s.question];
    if (q.categorie === 'devineMaReponse') return q.devinette.replace('{nom}', nom(q.heros));
    if (q.categorie === 'quiARepondu') return `« ${q.secret} »\nQuelqu’un a répondu « ${q.propositions[s.affichee]} ». Qui ?`;
    return `« ${q.secret} »\nQui a reçu le plus de voix ?`;
  }

  function etat() {
    const phase = ['passeSecrets', 'secret', 'attenteSecrets'].includes(s.etape);
    const enManche = ['tirage', 'devinette', 'revelation'].includes(s.etape);
    const q = QUESTIONS_CONNAIT[s.question];
    const classement = JOUEURS.map((j, o) => ({ id: j.id, score: s.scores[j.id] || 0, bonnes: s.bonnes[j.id] || 0, jouees: s.jouees[j.id] || 0, o }))
      .sort((a, b) => b.score - a.score || a.o - b.o);
    return JSON.parse(JSON.stringify({
      protocole: 2, hote: 'demo', mode: 'onSeConnait',
      joueurs: [{ id: '-', nom: 'Mets à jour Devinons', couleur: 0 }], style: 'eclair', vitesse: 'balade', etape: 'choixNiveau', tour: 0,
      connait: {
        version: 1, joueurs: JOUEURS, etape: s.etape, nombreQuestions: n, telephones: s.telephones,
        scores: Object.fromEntries(JOUEURS.map((j) => [j.id, s.scores[j.id] || 0])),
        ...(phase ? {
          questions: QUESTIONS_CONNAIT, secrets: aFaire,
          repondus: Object.fromEntries(JOUEURS.map((j) => [j.id, aFaire[j.id].filter((i) => !reste(j.id).includes(i))])),
          surPlace: s.surPlace,
        } : {}),
        ...(enManche ? {
          manche: {
            numero: s.question + 1, question: q, devineur: s.devineur, enonce: enonce(),
            ...(s.revelation ? {
              juste: s.revelation.juste, devinette: s.devinette, gains: s.revelation.gains, vises: s.revelation.vises,
              ...(q.categorie === 'devineMaReponse' ? { choixHeros: s.secrets[s.question][q.heros] } : {}),
              ...(q.categorie === 'plusSusceptible' || q.categorie === 'souvenirs' ? { voix: voixDe() } : {}),
            } : {}),
          },
        } : {}),
        ...(s.etape === 'terminee' ? { classement: classement.map(({ o, ...l }) => l) } : {}),
      },
    }));
  }

  function publier() {
    const e = etat();
    setTimeout(() => ecouteurs.forEach((f) => f(e)), 120);
    if (!s.fige) planifierAuto();
  }

  function appliquer(c) {
    if (c.action === 'bonjour' || c.action === 'aurevoir') return;
    const id = c.joueurId;
    if (!aFaire[id]) return;
    const phase = ['passeSecrets', 'secret', 'attenteSecrets'].includes(s.etape);
    if (c.action === 'prendre' && phase && !s.telephones[id] && s.surPlace !== id && reste(id).length) {
      for (const [k, v] of Object.entries(s.telephones)) if (v === 'demo-invite') delete s.telephones[k];
      s.telephones[id] = 'demo-invite';
    } else if (c.action === 'rendre' && s.telephones[id] === 'demo-invite') {
      delete s.telephones[id];
    } else if (c.action === 'secret' && phase && s.telephones[id] === 'demo-invite' && aFaire[id].includes(c.tour)) {
      noter(id, c.tour, c.valeur);
    } else return;
    publier();
  }

  // Mamie Jo répond sur le téléphone de la tablée, Tom sur le sien, puis la
  // tablée devine toute seule.
  function planifierAuto() {
    clearTimeout(s.auto);
    const quand = (ms, f) => { s.auto = setTimeout(() => { f(); publier(); }, ms); };
    if (['passeSecrets', 'secret', 'attenteSecrets'].includes(s.etape)) {
      const tom = reste('tom');
      const mamie = reste('mamie');
      if (mamie.length) {
        quand(1500, () => {
          s.etape = 'secret';
          s.surPlace = 'mamie';
          noter('mamie', mamie[0], choixDemo(mamie[0], 'mamie'));
          if (tom.length) noter('tom', tom[0], choixDemo(tom[0], 'tom'));
          if (!reste('mamie').length && s.etape === 'secret') { s.surPlace = null; s.etape = 'attenteSecrets'; }
        });
      } else if (tom.length || (reste('lea').length && !s.telephones.lea)) {
        // Léa, si personne ne l'a prise ici, répond à son tour sur la tablée.
        quand(1500, () => {
          if (tom.length) noter('tom', tom[0], choixDemo(tom[0], 'tom'));
          const lea = s.telephones.lea ? [] : reste('lea');
          if (lea.length) { s.etape = 'secret'; s.surPlace = 'lea'; noter('lea', lea[0], choixDemo(lea[0], 'lea')); }
          if (['secret', 'passeSecrets'].includes(s.etape) && !reste('lea').length) { s.surPlace = null; s.etape = 'attenteSecrets'; }
        });
      }
    } else if (s.etape === 'devinette') quand(2500, deviner);
    else if (s.etape === 'revelation') {
      quand(3500, () => { if (s.question + 1 < n) commencerManche(s.question + 1); else s.etape = 'terminee'; });
    }
  }

  function preparer(nomScene) {
    const tous = (ids) => { for (const id of ids) for (const q of aFaire[id]) s.secrets[q] = { ...(s.secrets[q] || {}), [id]: choixDemo(q, id) }; };
    if (nomScene === 'qui') { s.etape = 'secret'; s.surPlace = 'mamie'; return; }
    if (nomScene === 'secret') { s.telephones.lea = 'demo-invite'; s.etape = 'secret'; s.surPlace = 'mamie'; return; }
    if (nomScene === 'gardes') { s.telephones.lea = 'demo-invite'; tous(['lea', 'mamie']); s.etape = 'attenteSecrets'; return; }
    tous(['lea', 'mamie', 'tom']);
    commencerManche(3);
    s.scores = { mamie: 3, lea: 2, tom: 1 };
    if (nomScene === 'revelation') deviner();
    if (nomScene === 'podium') { s.etape = 'terminee'; s.bonnes = { mamie: 2, lea: 2, tom: 1 }; s.jouees = { mamie: 2, lea: 2, tom: 2 }; }
  }
  if (scene) preparer(scene);

  return {
    uid: 'demo-invite',
    suivre(code, surEtat) {
      ecouteurs.add(surEtat);
      setTimeout(() => { surEtat(etat()); if (!s.fige) planifierAuto(); }, 300);
      return () => ecouteurs.delete(surEtat);
    },
    async envoyer(code, commande) { setTimeout(() => appliquer(commande), 120); },
  };
}
