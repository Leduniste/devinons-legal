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
  ATTENTE_DOIGT_MS, GARDE_TOUCHER_MS, GRACE_MS, JOKERS, LETTRES, NIVEAUX,
  codeDepuis, dureeAffichee, ecouleA, enjeu, formatPoints, lirePartie, texteSur, verdict,
} from './etat.js';
import { avatar, garderEcranAllume, h, lignesClassement as classementDe, logo, podium } from './dessin.js';
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

// --- Petits outils -------------------------------------------------------

const afficher = (...noeuds) => app.replaceChildren(...noeuds.flat().filter((n) => n !== null && n !== undefined && n !== false));

function memoire(cle, valeur) {
  try {
    if (valeur === undefined) return sessionStorage.getItem(cle);
    sessionStorage.setItem(cle, valeur);
  } catch (_) { /* navigation privée : on s'en passe */ }
  return null;
}

const piedInstaller = () => h('p', { class: 'pied' },
  'Devinons, le quiz en famille. ',
  h('a', { href: config.playStore }, 'L\'appli Android'), ' · ',
  h('a', { href: 'https://leduniste.github.io/devinons-legal/' }, 'Confidentialité'));

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
  if (!vue || nouvelle.tour !== vue.tour || nouvelle.etape !== vue.etape || nouvelle.rallonge !== vue.rallonge) {
    envoye = null;
    doigt = null;
  }
  vue = nouvelle;
  recuA = performance.now();
  if (!moi) {
    const garde = memoire(`devinons-joueur-${code}`);
    if (garde && (garde === 'spectateur' || vue.joueurs.some((j) => j.id === garde))) choisirJoueur(garde, false);
  }
  rendre();
}

function choisirJoueur(id, nouveau = true) {
  moi = id;
  memoire(`devinons-joueur-${code}`, id);
  envoyer({ action: 'bonjour', appareil: 'web', ...(id !== 'spectateur' ? { joueurId: id } : {}) }, true);
  garderEcranAllume();
  if (nouveau) rendre();
}

function envoyer(commande, discret = false) {
  if (arretee) return;
  connexion.envoyer(code, { ...commande, version: 'web-1' }).catch((erreur) => {
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

const cEstMoi = () => vue.joueurCourant.id === moi || jouerPour === vue.tour;

function ecranQui() {
  afficher(
    logo(),
    h('h1', { class: 'centre', style: { fontSize: '34px' } }, 'Qui es-tu ?'),
    h('p', { class: 'centre' }, 'Touche ton prénom : tu joueras tes tours depuis ce téléphone.'),
    h('div', { class: 'pile' },
      vue.joueurs.map((j) => h('button', { class: 'choix-joueur', onclick: () => choisirJoueur(j.id) }, avatar(j), j.nom))),
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
  const cle = `${vue.etape}|${vue.tour}|${vue.rallonge}`;
  const nouvelleCle = cle !== derniereCle;
  derniereCle = cle;
  const contenu = {
    choixNiveau: ecranChoixNiveau,
    question: ecranQuestion,
    tempsEcoule: ecranQuestion,
    correction: ecranQuestion,
    miParcours: ecranMiParcours,
    terminee: ecranFin,
  }[vue.etape];
  if (!contenu) return ecranMessage('Un instant…', 'La partie continue sur l\'autre téléphone.');
  const noeuds = contenu();
  afficher(...noeuds, alerte ? h('p', { class: 'erreur', role: 'alert' }, alerte) : null);
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
    h('span', { class: 'compteur' }, `${vue.numeroQuestion} / ${vue.questionsParJoueur}`));
}

const lignesClassement = (lignes) => classementDe(lignes, moi);

function ecranChoixNiveau() {
  const j = vue.joueurCourant;
  const score = `Question ${vue.numeroQuestion} / ${vue.questionsParJoueur}  •  ${formatPoints(vue.scorePour(j.id))} pts`;
  if (!cEstMoi()) {
    return [
      h('div', { class: 'attente pile' },
        h('p', null, 'C\'est au tour de'),
        avatar(j, true),
        h('h1', null, j.nom),
        h('p', null, score),
        h('p', { class: 'points-attente' }, `${j.nom} choisit son niveau`)),
      h('div', { class: 'espace' }),
      vue.reponses.length ? lignesClassement(vue.classement) : null,
      h('button', { class: 'bouton lien', onclick: () => { jouerPour = vue.tour; rendre(); } }, `Jouer à la place de ${j.nom}`),
    ];
  }
  const attente = envoye && envoye.action === 'niveau';
  return [
    h('div', { class: 'centre' },
      h('p', null, moi === j.id ? 'À toi de jouer,' : 'Tu joues pour'),
      h('h1', null, j.nom),
      h('p', null, score)),
    h('div', { class: 'espace' }),
    h('h2', { class: 'centre' }, 'Choisis ton niveau'),
    h('div', { class: 'espace', style: { height: '12px' } }),
    h('div', { class: 'pile', 'data-choix': '' }, NIVEAUX.map((n) => {
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

  if (vue.surprise) noeuds.push(h('p', { class: 'centre petit' }, `🎲 Niveau surprise : +${vue.gainEnJeu} si c'est juste, −${vue.perteEnJeu} sinon`));
  noeuds.push(...chrono(correction || vue.appel));

  if (!correction && !tempsEcoule && joue && vue.jokers.length) {
    noeuds.push(h('div', { class: 'jokers', style: { marginTop: '10px' } }, vue.jokers.map((jk) => h('button', {
      class: 'joker',
      disabled: vue.jokerJoue(vue.joueurCourant.id, jk) || vue.appel || attente,
      onclick: () => { envoye = null; envoyer({ action: 'joker', valeur: jk, tour: vue.tour, etape: vue.etape }); },
    }, h('span', null, JOKERS[jk].emoji), JOKERS[jk].nom))));
  }
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

  noeuds.push(h('div', { class: 'carte' }, h('div', { class: 'enonce' }, q.enonce)));
  noeuds.push(h('div', { class: 'espace' }));
  noeuds.push(h('div', { class: 'propositions', 'data-choix': correction || !joue ? null : '' }, q.propositions.map((texte, i) => {
    const retiree = !correction && vue.retirees.includes(i);
    let etat = '';
    if (reponse) etat = i === q.bonne ? ' juste' : i === reponse.proposition ? ' faux' : ' estompe';
    else if (retiree) etat = ' estompe';
    else if (attente && envoye.valeur === i) etat = ' choisie';
    const libre = !correction && joue && !retiree && !attente;
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
    if (joue) {
      noeuds.push(h('button', { class: 'bouton', disabled: attente, onclick: () => geste('suivant') },
        vue.dernierTour ? 'Voir les résultats' : 'Suivant →'));
    } else {
      noeuds.push(h('p', { class: 'centre points-attente' }, `On attend que ${vue.joueurCourant.nom} passe à la suite`));
    }
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
