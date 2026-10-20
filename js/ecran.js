// Mode télé : la partie en grand, lisible à 3 mètres, sans rien toucher.
// Sur le navigateur d'une télé, un ordinateur branché, ou un téléphone
// dont on recopie l'écran. La page ne fait que lire parties/{code} : elle
// n'envoie aucun geste.

import { config, configuree } from './config.js';
import { LETTRES, codeDepuis, dureeAffichee, ecouleA, formatPoints, lirePartie, texteSur, verdict } from './etat.js';
import { avatar, garderEcranAllume, h, lignesClassement, logo, podium } from './dessin.js';
import { CATEGORIES, estConnait, lireConnait, restants } from './connait.js';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const app = document.getElementById('app');

let code = null;
let vue = null;
let recuA = 0;
let qr = null;
let connait = null; // partie On se connaît

const afficher = (...noeuds) => app.replaceChildren(...noeuds.flat().filter((n) => n !== null && n !== undefined && n !== false));

function ecranCode(erreur) {
  const champ = h('input', {
    class: 'champ-code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    maxlength: '6', placeholder: 'ABC234', 'aria-label': 'Code de la partie',
  });
  afficher(h('div', { class: 'tele-centre' },
    logo(),
    h('h1', null, 'Afficher une partie sur la télé'),
    h('p', null, 'Saisis le code de la partie, affiché sur le téléphone qui la mène (bouton QR code, puis « Afficher sur la télé »).'),
    h('form', {
      class: 'tele-formulaire',
      onsubmit: (e) => {
        e.preventDefault();
        const lu = codeDepuis(champ.value);
        if (lu) suivre(lu);
      },
    }, champ, h('button', { class: 'bouton jaune', type: 'submit' }, 'Afficher')),
    erreur ? h('p', { class: 'erreur' }, erreur) : null));
  champ.focus();
}

function ecranMessage(titre, texte) {
  afficher(h('div', { class: 'tele-centre' }, logo(), h('h1', null, titre), texte ? h('p', null, texte) : null));
}

async function suivre(lu) {
  code = lu;
  ecranMessage('Connexion…', `Partie ${code}`);
  let connexion;
  try {
    connexion = demo
      ? (await import('./demo.js')).connexionDemo({ scene: params.get('scene'), jeu: params.get('demo') })
      : await (await import('./connexion.js')).ouvrirConnexion();
  } catch (erreur) {
    console.warn(erreur);
    return ecranMessage(configuree ? 'Connexion impossible' : 'Page pas encore prête',
      configuree ? 'Vérifie la connexion Internet, puis recharge la page.' : 'Configuration Firebase à remplir (js/config.js), ou ajoute ?demo=1 pour essayer.');
  }
  history.replaceState(null, '', `${location.pathname}?code=${code}${demo ? `&demo=${params.get('demo') || 1}` : ''}${params.get('scene') ? '&scene=' + params.get('scene') : ''}`);
  garderEcranAllume();
  chargerQr();
  let premier = true;
  connexion.suivre(code, (etat) => {
    if (!etat) {
      if (premier) return ecranCode('Aucune partie en cours avec ce code.');
      if ((vue || connait)?.etape === 'terminee') return; // le podium reste affiché
      return ecranMessage('Partie arrêtée', 'La partie a été arrêtée sur le téléphone qui la menait.');
    }
    premier = false;
    if (estConnait(etat)) {
      const lue = lireConnait(etat);
      if (!lue) return;
      if (lue.tropRecent) return ecranMessage('Page à mettre à jour', 'Recharge la page pour afficher cette partie.');
      connait = lue;
      return rendre();
    }
    const nouvelle = lirePartie(etat);
    if (!nouvelle) return;
    if (nouvelle.tropRecent) return ecranMessage('Page à mettre à jour', 'Recharge la page pour afficher cette partie.');
    vue = nouvelle;
    recuA = performance.now();
    rendre();
  }, (erreur) => {
    console.warn(erreur);
    ecranMessage('Connexion perdue', 'Recharge la page pour revenir dans la partie.');
  });
}

// QR code pour rejoindre la partie depuis un téléphone (bibliothèque
// qrcode-generator, chargée seulement ici).
function chargerQr() {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  script.onload = () => {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(`${config.pageJoueur}?code=${code}`);
      q.make();
      qr = q.createDataURL(8, 2);
      rendre();
    } catch (_) { /* sans QR code, le code suffit */ }
  };
  document.head.append(script);
}

function blocRejoindre() {
  return h('div', { class: 'tele-rejoindre' },
    qr ? h('img', { src: qr, alt: '' }) : null,
    h('div', null, h('div', { class: 'petit' }, 'Pour jouer : scanne, ou code'), h('div', { class: 'tele-code' }, code)));
}

function bandeau() {
  const enJeu = vue.etape !== 'terminee' && vue.etape !== 'miParcours';
  return h('header', { class: 'tele-bandeau' },
    logo(),
    enJeu ? h('div', { class: 'tele-compteur' }, `Question ${vue.numeroQuestion} / ${vue.questionsParJoueur}`) : h('div'),
    blocRejoindre());
}

function rendre() {
  if (connait) return rendreConnait();
  if (!vue) return;
  const contenu = {
    choixNiveau: ecranTour,
    question: ecranQuestion,
    tempsEcoule: ecranQuestion,
    correction: ecranQuestion,
    miParcours: ecranMiParcours,
    terminee: ecranFin,
  }[vue.etape];
  if (contenu) afficher(bandeau(), h('section', { class: `tele-scene tele-${vue.etape}` }, contenu()));
}

function ecranTour() {
  const j = vue.joueurCourant;
  return [
    h('div', { class: 'tele-tour' },
      h('p', null, 'Au tour de'),
      avatar(j, true),
      h('h1', null, j.nom),
      h('p', null, `${formatPoints(vue.scorePour(j.id))} pts`),
      h('p', { class: 'points-attente tele-discret' }, 'Choix du niveau')),
    vue.joueurs.length > 1 ? h('div', { class: 'tele-cote' }, lignesClassement(vue.classement)) : null,
  ];
}

function ecranQuestion() {
  const q = vue.question;
  if (!q) return [];
  const j = vue.joueurCourant;
  const correction = vue.etape === 'correction';
  const reponse = correction ? vue.derniereReponse : null;
  const decision = vue.etape === 'tempsEcoule';
  const couleur = decision ? 'var(--faux)' : vue.niveau ? vue.niveau.couleur : 'var(--bleu)';
  const chrono = h('div', { class: 'chrono', 'data-chrono': correction || vue.appel ? 'pause' : '' },
    h('div', { class: 'piste' }, h('div', { class: 'reste', style: { background: couleur } })),
    h('span', { class: 'secondes' }));
  majChrono(chrono);
  return [
    h('div', { class: 'tele-joueur' },
      avatar(j),
      h('span', { class: 'nom' }, j.nom),
      vue.niveau ? h('span', { class: 'tele-niveau', style: { background: vue.niveau.couleur, color: texteSur(vue.niveau.couleur) } }, vue.surprise ? `🎲 ${vue.niveau.libelle}` : vue.niveau.libelle) : null,
      vue.rallonge ? h('span', { class: 'tele-niveau', style: { background: 'var(--jaune)' } }, 'Temps bonus') : null),
    chrono,
    vue.appel ? h('div', { class: 'carte jaune droite tele-appel' }, '📞 Appel à la famille : chrono arrêté !') : null,
    decision
      ? h('div', { class: 'tele-decision' }, h('h1', null, 'Temps écoulé !'), h('p', { class: 'points-attente' }, `${j.nom} se décide : du temps bonus, ou pas`))
      : [
        h('div', { class: 'carte tele-enonce' }, q.enonce),
        h('div', { class: 'tele-propositions' }, q.propositions.map((texte, i) => {
          let etat = '';
          if (reponse) etat = i === q.bonne ? ' juste' : i === reponse.proposition ? ' faux' : ' estompe';
          else if (vue.retirees.includes(i)) etat = ' estompe';
          return h('div', { class: `proposition${etat}` }, h('span', { class: 'lettre' }, LETTRES[i]), h('span', null, texte));
        })),
      ],
    reponse ? h('div', { class: 'tele-verdict' },
      h('div', { class: `verdict ${reponse.correcte ? 'juste' : 'faux'}` }, `${j.nom} : ${verdict(reponse)}`),
      vue.taquinerie ? h('div', { class: 'bulle' }, vue.taquinerie) : null) : null,
  ];
}

function majChrono(el) {
  const duree = dureeAffichee(vue) || 1;
  const fige = el.dataset.chrono === 'pause' && vue.etape === 'correction';
  const ecoule = fige ? Math.min(duree, vue.derniereReponse?.tempsMs ?? duree) : ecouleA(vue, recuA, performance.now());
  const reste = Math.max(0, duree - ecoule);
  el.querySelector('.reste').style.transform = `scaleX(${reste / duree})`;
  el.querySelector('.secondes').textContent = `${Math.ceil(reste / 1000)} s`;
}

function boucle() {
  for (const el of app.querySelectorAll('[data-chrono=""]')) majChrono(el);
  requestAnimationFrame(boucle);
}

function ecranMiParcours() {
  const faites = vue.numeroQuestion - 1;
  return [
    h('div', { class: 'tele-centre' },
      h('h1', null, 'Mi-parcours !'),
      h('p', null, `${faites} question${faites > 1 ? 's' : ''} chacun, encore ${vue.questionsParJoueur - faites} à jouer`),
      lignesClassement(vue.classement)),
  ];
}

function ecranFin() {
  const premiers = vue.classement.filter((l) => l.rang === 1).map((l) => l.joueur.nom);
  return [
    h('div', { class: 'tele-centre' },
      h('h1', null, vue.joueurs.length > 1 ? `Bravo ${premiers.join(' et ')} !` : 'Partie terminée !'),
      podium(vue.classement, { grand: true }),
      vue.classement.length > 3 ? lignesClassement(vue.classement.slice(3)) : null),
  ];
}

// --- On se connaît ---------------------------------------------------------
// Phase 1 : qui a fini ses secrets (jamais les réponses). Phase 2 : la
// question que la tablée devine, puis la vérité, en grand.

function rendreConnait() {
  const c = connait;
  const titre = c.manche ? `Question ${c.manche.numero} / ${c.nombreQuestions}` : c.phaseSecrets ? 'Phase 1 · Les secrets' : '';
  const contenu = c.etape === 'terminee' ? finConnait() : c.manche ? mancheConnait() : c.phaseSecrets ? secretsConnait() : [];
  afficher(
    h('header', { class: 'tele-bandeau' }, logo(), h('div', { class: 'tele-compteur' }, titre), c.etape === 'terminee' ? h('div') : blocRejoindre()),
    h('section', { class: `tele-scene tele-connait-${c.manche ? 'manche' : c.etape}` }, contenu));
}

function secretsConnait() {
  const c = connait;
  return [
    h('div', { class: 'tele-centre' },
      h('h1', null, 'Chut, les secrets arrivent…'),
      h('p', null, 'Chacun répond en cachette, sur son téléphone ou sur celui de la tablée. Scannez le QR code pour répondre sur le vôtre.'),
      h('div', { class: 'tele-secrets' }, c.joueurs.filter((j) => (c.secrets[j.id] || []).length).map((j) => {
        const fini = restants(c, j.id).length === 0;
        return h('div', { class: `ligne${fini ? ' fini' : ''}` }, avatar(j), h('span', { class: 'nom' }, j.nom),
          h('span', { class: 'score' }, fini ? '🔒' : c.telephones[j.id] || c.surPlace === j.id ? '✍️' : '⏳'));
      }))),
  ];
}

function mancheConnait() {
  const m = connait.manche;
  const devineur = connait.joueur(m.devineur) || { id: m.devineur, nom: '?', couleur: 0 };
  const cat = CATEGORIES[m.question.categorie];
  const vises = connait.joueurs.filter((j) => m.vises.includes(j.id));
  let verite = null;
  if (m.revelee) {
    if (m.question.categorie === 'devineMaReponse' && m.choixHeros !== null) {
      verite = h('div', { class: 'tele-propositions' }, m.question.propositions.map((texte, i) => h('div', { class: `proposition${i === m.choixHeros ? ' juste' : ' estompe'}` },
        h('span', { class: 'lettre' }, LETTRES[i]), h('span', null, texte))));
    } else {
      verite = h('div', { class: 'tele-vises' }, h('span', { class: 'titre' }, m.question.categorie === 'quiARepondu' ? (vises.length > 1 ? 'C\'étaient' : 'C\'était') : 'Le plus de voix'),
        vises.map((j) => h('span', { class: 'tele-vise' }, avatar(j), j.nom, m.voix[j.id] ? ` · ${m.voix[j.id]} voix` : '')));
    }
  }
  return [
    h('div', { class: 'tele-joueur' }, avatar(devineur), h('span', { class: 'nom' }, `${devineur.nom} devine`),
      h('span', { class: 'tele-niveau', style: { background: cat.couleur, color: texteSur(cat.couleur) } }, cat.libelle)),
    h('div', { class: 'carte tele-enonce tele-enonce-long' }, m.enonce),
    verite,
    m.revelee
      ? h('div', { class: 'tele-verdict' }, h('div', { class: `verdict ${m.juste ? 'juste' : 'faux'}` }, m.juste ? `Bien joué, ${devineur.nom} !` : `Raté, ${devineur.nom} !`))
      : h('p', { class: 'centre points-attente tele-discret' }, `${devineur.nom} réfléchit`),
    h('div', { class: 'tele-scores' }, lignesClassement(connait.classementEnCours())),
  ];
}

function finConnait() {
  const lignes = connait.classement;
  const premiers = lignes.filter((l) => l.rang === 1).map((l) => l.joueur.nom);
  return [
    h('div', { class: 'tele-centre' },
      h('h1', null, `Bravo ${premiers.join(' et ')} !`),
      podium(lignes, { grand: true }),
      lignes.length > 3 ? lignesClassement(lignes.slice(3)) : null),
  ];
}

document.addEventListener('visibilitychange', garderEcranAllume);
requestAnimationFrame(boucle);
const lu = codeDepuis(location.href) || (demo ? 'DEMO23' : null);
if (lu) suivre(lu);
else ecranCode();
