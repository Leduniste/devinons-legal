// Joueur invité dans le navigateur : rejoindre une partie Tour à tour
// menée par un téléphone Android, sans installer l'appli. Une partie On se
// connaît (chacun ses secrets sur son téléphone) passe par
// js/invite_connait.js.
//
// Parcours : code (dans le lien du QR code, sinon saisi) → « Qui es-tu ? »
// → attendre son tour → choisir son niveau, répondre, voir la correction
// → podium → « Installe Devinons pour garder tes scores ».
//
// Le téléphone qui mène reste seul arbitre (chrono, points) : la page
// envoie des gestes, comme la page miroir de l'appli
// (lib/features/tour_a_tour/partie_miroir.dart).

import { config, configuree } from './config.js';
import {
  ATTENTE_DOIGT_MS, BOUTIQUES, CARTES, GARDE_TOUCHER_MS, GRACE_MS, JOKERS, LETTRES, NIVEAUX,
  carteJouable, cibles, codeDepuis, dureeAffichee, ecouleA, enjeu, formatPoints, libelleCarteJouee, libelleHandicapSubi,
  libellePoints, lirePartie, nomCarte, texteSur, verdict,
} from './etat.js';
import {
  AIDE_CONNAIT, AIDE_TOUR_A_TOUR, aide, avatar, garderEcranAllume, h, installerBoutonAide, lignesClassement as classementDe, logo, podium,
} from './dessin.js';
import { estConnait } from './connait.js';
import { inviteConnait } from './invite_connait.js';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const app = document.getElementById('app');

let connexion = null;
let code = null;
let vue = null;
let recuA = 0;
let moi = null; // id du joueur choisi, ou 'spectateur'
let jouerPour = -1; // tour où l'on joue à la place du joueur courant
let envoye = null; // geste envoyé, en attente de l'état suivant
let doigt = null; // proposition touchée : { index, ecouleMs, depuis }
let derniereCle = null;
let gardeJusqua = 0; // GardeToucher : touchers ignorés jusqu'à ce moment
let desabonner = null;
let arretee = false;
let connait = null; // partie On se connaît
let vuTour = null; // dernier tour où l'on a dit « Vu »
let bonjourTour = null; // dernier tour où l'on a (re)demandé sa place
const VERSION = 'web-4'; // sait dire « Vu » (protocole 3) et connaît les cartes (protocole 4)
let cibleDe = null; // handicap dont on choisit la cible

// --- Petits outils -------------------------------------------------------

const afficher = (...noeuds) => app.replaceChildren(...noeuds.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false));

function memoire(cle, valeur) {
  try {
    if (valeur === undefined) return sessionStorage.getItem(cle);
    sessionStorage.setItem(cle, valeur);
  } catch (_) { /* navigation privée : on s'en passe */ }
  return null;
}

const piedInstaller = () => [
  lienTele(),
  h('p', { class: 'pied' },
    'Devinons, le quiz en famille. ',
    h('a', { href: config.playStore }, 'L\'appli Android'), ' · ',
    h('a', { href: 'https://leduniste.github.io/devinons-legal/' }, 'Confidentialité')),
];

// Lien discret vers l'écran de suivi (ecran.html) : la télé regarde,
// les téléphones jouent.
function lienTele() {
  const adresse = config.pageJoueur.replace(/partie\.html$/, 'ecran.html');
  return h('details', { class: 'lien-tele' },
    h('summary', null, '📺 Afficher la partie sur une télé ou un ordinateur'),
    h('p', null, 'Sur la télé ou l\'ordinateur, ouvre ',
      h('strong', null, adresse.replace('https://', '')),
      code ? [' et tape le code ', h('strong', null, code)] : ' et tape le code de la partie',
      '. La partie s\'affiche en grand, juste pour regarder : on joue toujours sur les téléphones.'));
}

// --- Écrans hors partie ------------------------------------------------------

function ecranCode(erreur) {
  const champ = h('input', {
    class: 'champ-code', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters',
    spellcheck: 'false', maxlength: '6', placeholder: 'ABC234', 'aria-label': 'Code de la partie',
  });
  const valider = h('button', { class: 'bouton jaune', type: 'submit', disabled: true }, 'Rejoindre');
  champ.addEventListener('input', () => { valider.disabled = !codeDepuis(champ.value); });
  const formulaire = h('form', {
    class: 'pile',
    onsubmit: (e) => {
      e.preventDefault();
      const lu = codeDepuis(champ.value);
      if (lu) rejoindre(lu);
    },
  }, champ, valider);
  afficher(
    logo(),
    h('h1', { class: 'centre', style: { fontSize: '32px' } }, 'On t\'attend pour jouer !'),
    h('p', { class: 'centre' }, 'Saisis le code affiché sur le téléphone qui mène la partie (sous le QR code).'),
    h('div', { class: 'espace' }),
    formulaire,
    erreur ? h('p', { class: 'erreur', role: 'alert' }, erreur) : null,
    h('div', { class: 'espace' }),
    blocAppli(),
    piedInstaller(),
  );
  champ.focus();
}

function blocAppli() {
  return h('div', { class: 'carte petit' },
    h('strong', null, 'Tu as Devinons sur Android ? '),
    'Tu peux aussi ouvrir l\'appli et toucher « Rejoindre une partie ». Ici, on joue sans rien installer, iPhone compris.');
}

function ecranMessage(titre, texte, bouton) {
  afficher(
    logo(),
    h('div', { class: 'carte centre pile' }, h('h2', null, titre), texte ? h('p', null, texte) : null),
    h('div', { class: 'espace' }),
    bouton || null,
    piedInstaller(),
  );
}

const boutonAutrePartie = () => h('button', {
  class: 'bouton jaune',
  onclick: () => { history.replaceState(null, '', location.pathname + (demo ? '?demo=1' : '')); location.reload(); },
}, 'Rejoindre une autre partie');

// --- Connexion à la partie ---------------------------------------------------

async function rejoindre(lu) {
  code = lu;
  ecranMessage('Connexion…', 'On cherche la partie ' + code + '.');
  try {
    if (!connexion) {
      if (demo) connexion = (await import('./demo.js')).connexionDemo({ scene: params.get('scene'), jeu: params.get('demo') });
      else connexion = await (await import('./connexion.js')).ouvrirConnexion();
    }
  } catch (erreur) {
    console.warn(erreur);
    return ecranMessage(
      configuree ? 'Connexion impossible' : 'Page pas encore prête',
      configuree ? 'Vérifie que le téléphone a Internet, puis réessaie.' : 'La configuration Firebase de cette page reste à remplir (js/config.js). Pour l\'essayer : ajoute ?demo=1 à l\'adresse.',
      h('button', { class: 'bouton jaune', onclick: () => location.reload() }, 'Réessayer'),
    );
  }
  history.replaceState(null, '', `${location.pathname}?code=${code}${demo ? `&demo=${params.get('demo') || 1}` : ''}${params.get('scene') ? '&scene=' + params.get('scene') : ''}`);
  let premier = true;
  desabonner = connexion.suivre(code, (etat) => {
    if (premier && !etat) return ecranCode('Aucune partie en cours avec ce code : elle est peut-être terminée.');
    premier = false;
    recevoir(etat);
  }, (erreur) => {
    console.warn(erreur);
    ecranMessage('Connexion perdue', 'Le lien avec la partie s\'est coupé.', h('button', { class: 'bouton jaune', onclick: () => location.reload() }, 'Revenir dans la partie'));
  });
}

function recevoir(etat) {
  if (etat) installerBoutonAide(connait || estConnait(etat) ? AIDE_CONNAIT : AIDE_TOUR_A_TOUR);
  if (connait || estConnait(etat)) {
    connait ??= inviteConnait({
      afficher, code, uid: connexion.uid, memoire, ecranMessage, boutonAutrePartie, piedInstaller, carteInstaller,
      envoyer: (commande) => envoyer(commande, true),
    });
    return connait.recevoir(etat);
  }
  if (!etat) {
    // Une partie finie disparaît quelques secondes après le podium.
    if (vue && vue.etape === 'terminee') return;
    arretee = true;
    desabonner?.();
    return ecranMessage('Partie arrêtée', 'La partie a été arrêtée sur le téléphone qui la menait.', boutonAutrePartie());
  }
  const nouvelle = lirePartie(etat);
  if (!nouvelle) return ecranMessage('Partie illisible', 'Cette partie ne peut pas s\'afficher ici.', boutonAutrePartie());
  if (nouvelle.tropRecent) {
    return ecranMessage('Page à mettre à jour', 'Cette partie vient d\'une version plus récente de Devinons. Recharge la page.',
      h('button', { class: 'bouton jaune', onclick: () => location.reload() }, 'Recharger'));
  }
  const boutique = (v) => (v && v.cartes.boutique ? `${v.cartes.boutique.moment}|${v.cartes.boutique.prets.includes(moi)}` : '');
  if (!vue || nouvelle.tour !== vue.tour || nouvelle.etape !== vue.etape || nouvelle.rallonge !== vue.rallonge
    || boutique(nouvelle) !== boutique(vue)) {
    envoye = null;
    doigt = null;
    cibleDe = null;
  }
  vue = nouvelle;
  recuA = performance.now();
  if (!moi) {
    const garde = memoire(`devinons-joueur-${code}`);
    if (garde && (garde === 'spectateur' || vue.joueurs.some((j) => j.id === garde))) choisirJoueur(garde, false);
  }
  apresEtat();
  rendre();
}

// « Vu » au début de son tour ; si le lien s'est défait (main reprise, ou
// arrivée en cours de partie), on redemande sa place au tour suivant.
function apresEtat() {
  if (!moi || moi === 'spectateur' || !vue.lienPossible) return;
  if (lie()) {
    const enJeu = ['choixNiveau', 'question', 'tempsEcoule', 'correction'].includes(vue.etape);
    if (enJeu && vue.joueurCourant.id === moi && vuTour !== vue.tour) {
      vuTour = vue.tour;
      envoyer({ action: 'vu', valeur: null, tour: vue.tour, etape: vue.etape }, true);
      try { navigator.vibrate?.(200); } catch (_) { /* pas de vibreur */ }
    }
  } else if (!vue.telephones[moi] && bonjourTour !== vue.tour) {
    bonjourTour = vue.tour;
    envoyer({ action: 'bonjour', appareil: 'web', joueurId: moi }, true);
  }
}

function choisirJoueur(id, nouveau = true) {
  moi = id;
  memoire(`devinons-joueur-${code}`, id);
  if (id !== 'spectateur') {
    if (vue) bonjourTour = vue.tour;
    souvenirPrenom(vue?.joueurs.find((j) => j.id === id)?.nom);
  }
  envoyer({ action: 'bonjour', appareil: 'web', ...(id !== 'spectateur' ? { joueurId: id } : {}) }, true);
  garderEcranAllume();
  if (nouveau) rendre();
}

function envoyer(commande, discret = false) {
  if (arretee) return;
  connexion.envoyer(code, { ...commande, version: VERSION }).catch((erreur) => {
    console.warn(erreur);
    if (discret) return;
    envoye = null;
    rendre('Ton geste n\'est pas parti : vérifie Internet et réessaie.');
  });
}

// Geste pour l'étape en cours, comme PartieMiroir._commande.
function geste(action, valeur = null, extra = {}) {
  if (performance.now() < gardeJusqua) return;
  envoye = { action, valeur, tour: vue.tour, etape: vue.etape };
  envoyer({ action, valeur, tour: vue.tour, etape: vue.etape, ...extra });
  rendre();
}

// --- La partie ---------------------------------------------------------------

// Ce navigateur est lié à son joueur sur le téléphone qui mène.
const lie = () => !!moi && moi !== 'spectateur' && vue.telephones[moi] === connexion.uid;

// Sur un téléphone qui sait lier (protocole 3) : on ne joue que ses tours.
// Sinon, comme avant (on peut aussi jouer à la place du joueur courant).
const cEstMoi = () => (vue.lienPossible ? lie() && vue.joueurCourant.id === moi : vue.joueurCourant.id === moi || jouerPour === vue.tour);

// Dernier prénom choisi sur ce navigateur : proposé en un toucher.
function souvenirPrenom(nom) {
  try { if (nom) localStorage.setItem('devinons-mon-prenom', nom); } catch (_) { /* navigation privée */ }
}
function prenomSouvenir() {
  try { return localStorage.getItem('devinons-mon-prenom'); } catch (_) { return null; }
}

// Joueur déjà sur un autre téléphone (protocole 3).
const pris = (j) => vue.lienPossible && !!vue.telephones[j.id] && vue.telephones[j.id] !== connexion.uid;

function ecranQui() {
  const propose = vue.lienPossible ? vue.joueurs.find((j) => j.nom === prenomSouvenir() && !pris(j)) : null;
  const bouton = (j) => h('button', { class: 'choix-joueur', disabled: pris(j), onclick: () => choisirJoueur(j.id) },
    avatar(j), h('span', null, j.nom, pris(j) ? h('span', { class: 'detail' }, 'Sur un autre téléphone') : null));
  afficher(
    logo(),
    aide(AIDE_TOUR_A_TOUR),
    h('h1', { class: 'centre', style: { fontSize: '34px' } }, 'Qui es-tu ?'),
    h('p', { class: 'centre' }, 'Touche ton prénom : tu joueras tes tours depuis ce téléphone.'),
    propose ? h('div', { class: 'pile' },
      h('button', { class: 'choix-joueur propose', onclick: () => choisirJoueur(propose.id) }, avatar(propose), h('span', null, propose.nom, h('span', { class: 'detail' }, 'C\'est moi'))),
      h('p', { class: 'centre petit' }, 'Ou un autre joueur')) : null,
    h('div', { class: 'pile' }, vue.joueurs.filter((j) => !propose || j.id !== propose.id).map(bouton)),
    h('div', { class: 'espace' }),
    h('div', { class: 'carte petit' },
      h('strong', null, 'Ton prénom n\'est pas là ? '),
      'Les joueurs se choisissent sur le téléphone qui mène, avant de lancer la partie. Pour celle-ci, tu peux regarder et encourager.'),
    h('div', { class: 'espace' }),
    h('button', { class: 'bouton blanc', onclick: () => choisirJoueur('spectateur') }, 'Je regarde seulement'),
    piedInstaller(),
  );
}

function rendre(alerte) {
  if (!vue || arretee) return;
  if (!moi) return ecranQui();
  const cle = `${vue.etape}|${vue.tour}|${vue.rallonge}|${vue.cartes.boutique ? vue.cartes.boutique.moment : ''}`;
  const nouvelleCle = cle !== derniereCle;
  derniereCle = cle;
  const contenu = vue.cartes.boutique ? ecranBoutique : {
    choixNiveau: ecranChoixNiveau,
    question: ecranQuestion,
    tempsEcoule: ecranQuestion,
    correction: ecranQuestion,
    miParcours: ecranMiParcours,
    terminee: ecranFin,
  }[vue.etape];
  if (!contenu) return ecranMessage('Un instant…', 'La partie continue sur l\'autre téléphone.');
  const noeuds = contenu();
  const autreTelephone = vue.lienPossible && moi && moi !== 'spectateur' && vue.joueurCourant.id === moi && !lie()
    && ['choixNiveau', 'question', 'tempsEcoule'].includes(vue.etape);
  afficher(...noeuds, autreTelephone ? h('p', { class: 'centre petit' }, 'Ton tour se joue sur l\'autre téléphone') : null, alerte ? h('p', { class: 'erreur', role: 'alert' }, alerte) : null);
  // Un choix qui vient d'apparaître ignore les touchers un court instant.
  const choix = app.querySelector('[data-choix]');
  if (choix && nouvelleCle) {
    gardeJusqua = performance.now() + GARDE_TOUCHER_MS;
    choix.classList.add('garde');
    setTimeout(() => choix.classList.remove('garde'), GARDE_TOUCHER_MS);
  }
}

function entete() {
  const j = vue.joueurCourant;
  return h('div', { class: 'entete' },
    avatar(j),
    h('span', { class: 'nom' }, j.nom),
    !cEstMoi() ? h('span', { class: 'en-direct' }, 'En direct') : null,
    h('span', { class: 'compteur' }, `${vue.numeroQuestion} / ${vue.questionsParJoueur}`));
}

// Niveau choisi, sur sa couleur : « Petit malin · +12 / −6 ».
function etiquetteNiveau() {
  if (!vue.niveau) return null;
  const e = vue.enjeux[vue.niveau.id];
  return h('p', { class: 'centre' }, h('span', { class: 'etiquette', style: { background: vue.niveau.couleur, color: texteSur(vue.niveau.couleur) } },
    `${vue.surprise ? '🎲 ' : ''}${vue.niveau.libelle} · ${vue.surprise ? `+${vue.gainEnJeu} / −${vue.perteEnJeu}` : enjeu(e)}`));
}

// Tours avant que [id] joue, en comptant depuis [tour] (0 : c'est à lui).
function toursAvant(id, tour) {
  const n = vue.joueurs.length;
  const i = vue.joueurs.findIndex((j) => j.id === id);
  return i < 0 ? -1 : (i - (tour % n) + n) % n;
}

// « Tu joues juste après ! », pour patienter en sachant quand.
function prochainTour() {
  if (!vue.joueurs.some((j) => j.id === moi)) return null;
  const k = toursAvant(moi, vue.tour);
  if (k <= 0) return null;
  const restants = vue.nombreTours - vue.tour;
  if (k >= restants) return h('p', { class: 'centre petit' }, 'Tu as joué toutes tes questions : place au suspense !');
  return h('p', { class: 'centre prochain' }, k === 1 ? 'Tu joues juste après !' : `Ton tour dans ${k} questions`);
}

// Dernière réponse donnée, pour qui vient de regarder ailleurs.
function derniereReponseEnBref() {
  const r = vue.derniereReponse;
  if (!r) return null;
  const j = vue.joueurs.find((x) => x.id === r.joueurId);
  return j ? h('p', { class: 'centre petit discret' }, `Dernière réponse : ${j.nom}, ${verdict(r)}`) : null;
}

const lignesClassement = (lignes) => classementDe(lignes, moi, vue.cartes.actives ? vue.nombreCartes : null);

function ecranChoixNiveau() {
  const j = vue.joueurCourant;
  const score = `Question ${vue.numeroQuestion} / ${vue.questionsParJoueur}  •  ${libellePoints(vue.scorePour(j.id))}`;
  if (!cEstMoi()) {
    // En direct : qui joue, son score, quand vient mon tour, le classement.
    return [
      h('div', { class: 'attente pile' },
        h('span', { class: 'en-direct' }, 'En direct'),
        avatar(j, true),
        h('h1', null, j.nom),
        h('p', null, score),
        h('p', { class: 'points-attente' }, `${j.nom} choisit son niveau`)),
      carteJoueeEnBref(),
      prochainTour(),
      derniereReponseEnBref(),
      h('div', { class: 'espace' }),
      vue.reponses.length ? lignesClassement(vue.classement) : null,
      vue.lienPossible ? null : h('button', { class: 'bouton lien', onclick: () => { jouerPour = vue.tour; rendre(); } }, `Jouer à la place de ${j.nom}`),
      lienTele(),
    ];
  }
  const attente = envoye && envoye.action === 'niveau';
  return [
    h('div', { class: 'centre' },
      h('p', null, moi === j.id ? 'À toi de jouer,' : 'Tu joues pour'),
      h('h1', null, j.nom),
      h('p', null, score)),
    bandeauCartes(),
    mainCartes(true),
    h('div', { class: 'espace' }),
    h('h2', { class: 'centre' }, vue.cartes.effets.niveauImpose ? '🎲 Le dé a choisi ton niveau' : 'Choisis ton niveau'),
    h('div', { class: 'espace', style: { height: '12px' } }),
    // Dé forcé : un seul niveau, tiré par le dé.
    h('div', { class: 'pile', 'data-choix': '' }, NIVEAUX.filter((n) => !vue.cartes.effets.niveauImpose || n.id === vue.cartes.effets.niveauImpose).map((n) => {
      const e = vue.enjeux[n.id];
      const texte = texteSur(n.couleur);
      const dispo = vue.disponibles.includes(n.id);
      return h('button', {
        class: 'niveau',
        style: { background: n.couleur, color: texte },
        disabled: !dispo || attente,
        'aria-label': `${n.libelle}, ${enjeu(e)} points, ${Math.round(e.chronoMs / 1000)} secondes`,
        onclick: () => geste('niveau', n.id),
      },
      h('span', { class: 'oeillet' }),
      h('span', { class: 'libelle' }, n.libelle),
      h('span', { class: 'enjeu' }, enjeu(e), h('small', null, `${Math.round(e.chronoMs / 1000)} s`)));
    })),
    attente ? h('p', { class: 'centre points-attente' }, 'C\'est parti') : null,
  ];
}

function chrono(enPause) {
  const decision = vue.etape === 'tempsEcoule';
  const couleur = decision ? 'var(--faux)' : vue.niveau ? vue.niveau.couleur : 'var(--bleu)';
  const el = h('div', { class: 'chrono', 'data-chrono': enPause ? 'pause' : '' },
    h('div', { class: 'piste' }, h('div', { class: 'reste', style: { background: couleur } })),
    h('span', { class: 'secondes' }, ''));
  majChrono(el);
  return [el, decision ? h('p', { class: 'chrono-legende' }, 'Décide-toi : sans choix, la question est perdue')
    : vue.rallonge ? h('p', { class: 'chrono-legende' }, 'Temps bonus !') : null];
}

function majChrono(el) {
  const duree = dureeAffichee(vue) || 1;
  const figeCorrection = el.dataset.chrono === 'pause' && vue.etape === 'correction';
  const ecoule = figeCorrection ? Math.min(duree, vue.derniereReponse?.tempsMs ?? duree) : ecouleA(vue, recuA, performance.now());
  const reste = Math.max(0, duree - ecoule);
  el.querySelector('.reste').style.transform = `scaleX(${reste / duree})`;
  el.querySelector('.secondes').textContent = `${Math.ceil(reste / 1000)} s`;
}

function boucleChrono() {
  for (const el of app.querySelectorAll('[data-chrono=""]')) majChrono(el);
  // Chrono fini ici, sans doigt posé à temps : plus de réponse possible,
  // le téléphone qui mène va passer à la suite.
  if (vue && vue.etape === 'question' && !vue.appel) {
    const fini = ecouleA(vue, recuA, performance.now()) > vue.dureeChronoMs + GRACE_MS;
    const doigtValable = doigt && performance.now() - doigt.depuis < ATTENTE_DOIGT_MS;
    app.querySelectorAll('.proposition[data-libre]').forEach((b) => { b.disabled = fini && !doigtValable; });
  }
  requestAnimationFrame(boucleChrono);
}

function ecranQuestion() {
  const q = vue.question;
  if (!q) return [h('p', { class: 'centre points-attente' }, 'La question arrive')];
  const correction = vue.etape === 'correction';
  const tempsEcoule = vue.etape === 'tempsEcoule';
  const reponse = correction ? vue.derniereReponse : null;
  const joue = cEstMoi();
  const attente = envoye !== null;
  const noeuds = [entete()];

  noeuds.push(etiquetteNiveau());
  if (vue.surprise && joue) noeuds.push(h('p', { class: 'centre petit' }, `🎲 Niveau surprise : +${vue.gainEnJeu} si c'est juste, −${vue.perteEnJeu} sinon`));
  noeuds.push(...chrono(correction || vue.appel || vue.cartes.effets.chronoAttend));
  if (!correction) noeuds.push(bandeauCartes());
  if (!joue && !correction) noeuds.push(carteJoueeEnBref());

  if (!correction && !tempsEcoule && joue && vue.jokers.length) {
    const bloque = (jk) => vue.cartes.actives && ((vue.cartes.effets.subi && vue.cartes.effets.subi.carte === 'gel')
      || vue.cartes.effets.flou || vue.cartes.effets.utilises.includes(jk));
    noeuds.push(h('div', { class: 'jokers', style: { marginTop: '10px' } }, vue.jokers.map((jk) => h('button', {
      class: 'joker',
      disabled: vue.jokerJoue(vue.joueurCourant.id, jk) || vue.appel || attente || bloque(jk),
      onclick: () => { envoye = null; envoyer({ action: 'joker', valeur: jk, tour: vue.tour, etape: vue.etape }); },
    }, h('span', null, JOKERS[jk].emoji), JOKERS[jk].nom))));
  }
  if (!correction && !tempsEcoule && joue) noeuds.push(mainCartes(false));
  if (vue.appel) {
    noeuds.push(h('div', { class: 'carte jaune droite', style: { marginTop: '10px' } },
      h('strong', { class: 'titre', style: { fontSize: '18px' } }, '📞 Appel à la famille !'),
      h('p', { class: 'petit' }, 'Chrono arrêté : demande conseil à quelqu\'un. (Pas de bonus de rapidité.)'),
      joue ? h('button', { class: 'bouton blanc', onclick: () => envoyer({ action: 'finAppel', valeur: null, tour: vue.tour, etape: vue.etape }) }, 'Fini') : null));
  }
  noeuds.push(h('div', { class: 'espace' }));

  if (tempsEcoule) {
    // Question masquée le temps de décider (comme sur le téléphone).
    if (!joue) {
      noeuds.push(h('div', { class: 'centre pile' }, h('h2', { style: { color: 'var(--faux)' } }, 'Temps écoulé !'),
        h('p', { class: 'points-attente' }, `${vue.joueurCourant.nom} décide de prendre du temps bonus ou non`)));
      return noeuds;
    }
    const perte = vue.perteEnJeu;
    noeuds.push(h('div', { class: 'pile', 'data-choix': '' },
      h('h2', { class: 'centre', style: { color: 'var(--faux)', fontSize: '30px' } }, 'Temps écoulé !'),
      h('button', { class: 'bouton jaune', disabled: attente, onclick: () => geste('prendreRallonge') },
        `+${Math.round(vue.dureeRallongeMs / 1000)} s pour −${formatPoints(vue.prixRallonge)} pts`),
      h('button', { class: 'bouton blanc', disabled: attente, onclick: () => geste('refuserRallonge') },
        perte > 0 ? `J'abandonne (−${formatPoints(perte)} pts)` : 'J\'abandonne')));
    return noeuds;
  }

  // Brouillard (handicap) : question et réponses floues un instant.
  const flou = !correction && vue.cartes.effets.flou;
  noeuds.push(h('div', { class: `carte${flou ? ' flou' : ''}` }, h('div', { class: 'enonce' }, q.enonce)));
  noeuds.push(h('div', { class: 'espace' }));
  noeuds.push(h('div', { class: `propositions${flou ? ' flou' : ''}`, 'data-choix': correction || !joue ? null : '' }, q.propositions.map((texte, i) => {
    const retiree = !correction && vue.retirees.includes(i);
    let etat = '';
    if (reponse) etat = i === q.bonne ? ' juste' : i === reponse.proposition ? ' faux' : ' estompe';
    else if (retiree) etat = ' estompe';
    else if (attente && envoye.valeur === i) etat = ' choisie';
    const libre = !correction && joue && !retiree && !attente && !flou;
    const bouton = h('button', {
      class: `proposition${etat}`,
      disabled: !libre,
      'data-libre': libre ? '' : null,
      onpointerdown: () => {
        doigt = { index: i, ecouleMs: ecouleA(vue, recuA, performance.now()), depuis: performance.now() };
        bouton.classList.add('appuyee');
      },
      onpointerleave: () => bouton.classList.remove('appuyee'),
      onpointercancel: () => { doigt = null; bouton.classList.remove('appuyee'); },
      onclick: () => repondre(i),
    }, h('span', { class: 'lettre' }, LETTRES[i]), h('span', null, texte));
    return bouton;
  })));

  if (correction && reponse) {
    noeuds.push(h('div', { class: 'espace' }));
    noeuds.push(h('div', { class: `verdict ${reponse.correcte ? 'juste' : 'faux'}` }, verdict(reponse)));
    if (vue.taquinerie) noeuds.push(h('div', { class: 'bulle', style: { marginTop: '12px' } }, vue.taquinerie));
    noeuds.push(h('div', { class: 'espace' }));
    // Tout le monde peut passer à la suite (comme sur les téléphones) :
    // le joueur suivant n'attend pas qu'on touche « Suivant » ailleurs.
    const suivant = vue.joueurs[(vue.tour + 1) % vue.joueurs.length];
    if (joue) {
      noeuds.push(h('button', { class: 'bouton', disabled: attente, onclick: () => geste('suivant') },
        vue.dernierTour ? 'Voir les résultats' : 'Suivant →'));
    } else if (!vue.dernierTour && suivant.id === moi) {
      noeuds.push(h('button', { class: 'bouton jaune', disabled: attente, onclick: () => geste('suivant') }, 'À moi de jouer ! →'));
    } else {
      noeuds.push(h('button', { class: 'bouton blanc', disabled: attente, onclick: () => geste('suivant') },
        vue.dernierTour ? 'Voir les résultats' : `Au tour de ${suivant.nom} →`));
    }
    if (!joue) noeuds.push(prochainTour());
  } else if (!joue) {
    noeuds.push(h('p', { class: 'centre petit', style: { marginTop: '16px' } }, `${vue.joueurCourant.nom} réfléchit… chut !`));
  }
  return noeuds;
}

// Réponse touchée : part avec le chrono tel qu'il s'affichait quand le
// doigt s'est posé (un appui lent d'enfant compte, comme sur le téléphone).
function repondre(i) {
  if (envoye || vue.etape !== 'question' || performance.now() < gardeJusqua) return;
  const maintenant = performance.now();
  const pose = doigt && doigt.index === i && maintenant - doigt.depuis < ATTENTE_DOIGT_MS + 4000 ? doigt.ecouleMs : null;
  const ecouleMs = Math.round(pose ?? ecouleA(vue, recuA, maintenant));
  if (ecouleMs > vue.dureeChronoMs + GRACE_MS && !vue.appel) return;
  doigt = null;
  geste('repondre', i, { ecouleMs });
}

// --- Cartes (protocole 4) ----------------------------------------------------

// « Léa joue 🧊 Joker gelé sur Tom », pour ceux qui regardent.
function carteJoueeEnBref() {
  const l = libelleCarteJouee(vue);
  return l ? h('p', { class: 'centre petit' }, l) : null;
}

// Ce qui pèse sur ce tour : handicap reçu, Double ou rien, Zéro faute, Brouillard.
function bandeauCartes() {
  const e = vue.cartes.effets;
  const enfant = vue.cartes.enfants.includes(vue.joueurCourant.id);
  const lignes = [
    libelleHandicapSubi(vue),
    e.double ? `🎯 ${nomCarte('double', enfant)} : +${vue.gainEnJeu || ''} si c'est juste` : null,
    e.zeroFaute ? '🛡️ Zéro faute : une erreur ne coûte rien' : null,
    e.flou ? '🌫️ Brouillard…' : null,
  ].filter(Boolean);
  return lignes.length ? h('div', { class: 'carte jaune droite petit', role: 'status', style: { marginTop: '10px' } }, lignes.map((l) => h('div', null, l))) : null;
}

// Cartes du joueur jouables à cette étape : handicaps et Double ou rien
// avant la question ([avant]), les autres jokers pendant la question.
function mainCartes(avant) {
  const id = vue.joueurCourant.id;
  const enfant = vue.cartes.enfants.includes(id);
  const cartes = (vue.cartes.main[id] || []).filter((c) => !!(CARTES[c].handicap || CARTES[c].avant) === avant);
  if (!cartes.length) return null;
  const attente = envoye !== null;
  if (avant && cibleDe && cartes.includes(cibleDe)) {
    const carte = cibleDe;
    return h('div', { class: 'pile', style: { marginTop: '10px' } },
      h('p', { class: 'centre' }, `${CARTES[carte].emoji} ${CARTES[carte].nom} : pour qui ?`),
      cibles(vue).map((j) => h('button', {
        class: 'bouton blanc',
        onclick: () => {
          cibleDe = null;
          envoyer({ action: 'carte', valeur: `${carte}:${vue.joueurs.findIndex((x) => x.id === j.id)}`, tour: vue.tour, etape: vue.etape });
          rendre();
        },
      }, j.nom)),
      h('button', { class: 'bouton lien', onclick: () => { cibleDe = null; rendre(); } }, 'Garder la carte'));
  }
  return h('div', { class: 'jokers cartes', style: { marginTop: '10px' } }, cartes.map((c) => h('button', {
    class: `joker${CARTES[c].handicap ? ' handicap' : ''}`,
    disabled: !carteJouable(vue, c) || attente,
    onclick: () => {
      if (CARTES[c].handicap) { cibleDe = c; return rendre(); }
      envoyer({ action: 'carte', valeur: c, tour: vue.tour, etape: vue.etape });
    },
  }, h('span', null, CARTES[c].emoji), nomCarte(c, enfant))));
}

// Boutique des cartes (départ, podium) : sur la page web, la carte offerte
// seulement, puis « C'est prêt ». Rien de pré-sélectionné, pas de minuteur.
function ecranBoutique() {
  const b = vue.cartes.boutique;
  const titre = h('h1', { class: 'centre' }, `🎴 ${BOUTIQUES[b.moment]}`);
  const pret = b.prets.includes(moi);
  const joueur = vue.joueurs.some((j) => j.id === moi);
  const etats = lignesBoutique(b);
  if (!joueur || pret || (vue.lienPossible && !lie())) {
    return [titre, h('p', { class: 'centre' }, pret ? 'Prêt ! On attend les autres.' : 'Chacun choisit ses cartes, pour cette partie seulement.'),
      h('div', { class: 'espace' }), etats];
  }
  const enfant = vue.cartes.enfants.includes(moi);
  const offertes = b.moment === 'depart' ? vue.cartes.offertesPossibles : [];
  const choisie = vue.cartes.offertes[moi];
  const attente = envoye !== null;
  return [
    titre,
    h('p', { class: 'centre' }, 'Valable pour cette partie seulement.'),
    offertes.length ? h('h2', null, '🎁 Ta carte offerte') : null,
    offertes.length ? h('div', { class: 'jokers cartes', 'data-choix': '' }, offertes.map((c) => h('button', {
      class: `joker${choisie === c ? ' choisie' : ''}`,
      'aria-pressed': choisie === c ? 'true' : 'false',
      disabled: attente,
      onclick: () => envoyer({ action: 'offerte', valeur: c, joueurId: moi, tour: vue.tour, etape: vue.etape }),
    }, h('span', null, CARTES[c].emoji), nomCarte(c, enfant)))) : null,
    h('p', { class: 'petit' }, offertes.length ? 'Ici, seule la carte offerte se choisit.' : 'Rien à choisir ici pour cette boutique.'),
    h('div', { class: 'espace' }),
    h('button', { class: 'bouton blanc', disabled: attente, onclick: () => geste('pret', b.moment, { joueurId: moi }) }, 'C\'est prêt'),
    h('div', { class: 'espace' }),
    etats,
  ];
}

function lignesBoutique(b) {
  return h('div', { class: 'classement' }, vue.joueurs.map((j) => h('div', { class: `ligne${j.id === moi ? ' moi' : ''}` },
    h('span', { class: 'nom' }, j.nom),
    h('span', { class: 'score' }, b.prets.includes(j.id) ? '✓' : '…'))));
}

function ecranMiParcours() {
  return [
    h('h1', { class: 'centre', style: { marginTop: '16px' } }, 'Mi-parcours !'),
    h('p', { class: 'centre' }, `${vue.numeroQuestion - 1} question${vue.numeroQuestion > 2 ? 's' : ''} chacun, encore ${vue.questionsParJoueur - vue.numeroQuestion + 1} à jouer`),
    h('div', { class: 'espace' }),
    lignesClassement(vue.classement),
    h('div', { class: 'espace' }),
    h('button', { class: 'bouton jaune', disabled: envoye !== null, onclick: () => geste('reprendre') }, 'On continue'),
  ];
}

function ecranFin() {
  const lignes = vue.classement;
  const moiLigne = lignes.find((l) => l.joueur.id === moi);
  return [
    logo(),
    h('h1', { class: 'centre' }, lignes.length > 1 ? `Bravo ${lignes.filter((l) => l.rang === 1).map((l) => l.joueur.nom).join(' et ')} !` : 'Partie terminée !'),
    podium(lignes),
    lignes.length > 3 ? lignesClassement(lignes.slice(3)) : null,
    moiLigne ? h('p', { class: 'centre' }, `Toi, ${moiLigne.joueur.nom} : ${moiLigne.bonnes} bonne${moiLigne.bonnes > 1 ? 's' : ''} réponse${moiLigne.bonnes > 1 ? 's' : ''} sur ${moiLigne.jouees}.`) : null,
    h('div', { class: 'espace' }),
    carteInstaller(),
    piedInstaller(),
  ];
}

function carteInstaller() {
  return h('div', { class: 'carte rose pile', style: { color: '#fff' } },
    h('h2', null, 'Installe Devinons pour garder tes scores'),
    h('p', null, 'Ta progression, tes accessoires, le défi du jour et l\'XP du groupe… Gratuit, sans compte.'),
    h('a', { class: 'bouton jaune', href: config.playStore }, 'Devinons sur Google Play'),
    h('p', { class: 'petit' }, 'Sur iPhone, pas encore d\'appli : cette page suffit pour rejouer, il suffit de rescanner un QR code.'));
}

// --- Démarrage ---------------------------------------------------------------

function demarrer() {
  requestAnimationFrame(boucleChrono);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !moi || !code) return;
    garderEcranAllume();
    envoyer({ action: 'bonjour', appareil: 'web', ...(moi !== 'spectateur' ? { joueurId: moi } : {}) }, true);
  });
  // Onglet fermé : le téléphone qui mène le saura s'il reçoit ce mot.
  window.addEventListener('pagehide', () => {
    connait?.auRevoir();
    if ((moi || connait) && code && !arretee) envoyer({ action: 'aurevoir' }, true);
  });
  const lu = codeDepuis(location.href) || (demo ? 'DEMO23' : null);
  // ?qui=lea : joueur déjà choisi (essais, captures).
  if (params.get('qui') && lu) {
    memoire(`devinons-joueur-${lu}`, params.get('qui'));
    memoire(`devinons-connait-${lu}`, params.get('qui'));
  }
  if (lu) rejoindre(lu);
  else ecranCode();
}

demarrer();
