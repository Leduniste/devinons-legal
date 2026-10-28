// Petits outils de dessin communs à la page joueur et à la page télé.

import { ACCESSOIRES, couleurAvatar, formatPoints, libellePoints, texteSur } from './etat.js';

// Crée un élément : h('p', { class: 'petit', onclick: f }, 'texte', enfant…).
export function h(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return el;
}

// Pastille du joueur : sa couleur, son initiale, son accessoire.
export function avatar(joueur, grand = false) {
  const fond = couleurAvatar(joueur.couleur);
  return h('span', { class: `avatar${grand ? ' grand' : ''}`, style: { background: fond, color: texteSur(fond) }, 'aria-hidden': 'true' },
    [...joueur.nom.trim()][0]?.toUpperCase() || '?',
    joueur.accessoire && ACCESSOIRES[joueur.accessoire] ? h('span', { class: 'accessoire' }, ACCESSOIRES[joueur.accessoire]) : null);
}

export const logo = () => h('div', { class: 'logo', 'aria-label': 'Devinons' }, [...'Devinons'].map((l) => h('span', null, l)));

export function lignesClassement(lignes, moi = null) {
  return h('div', { class: 'classement' }, lignes.map((l) => h('div', { class: `ligne${l.joueur.id === moi ? ' moi' : ''}` },
    h('span', { class: 'rang' }, l.rang),
    avatar(l.joueur),
    h('span', { class: 'nom' }, l.joueur.nom),
    h('span', { class: 'score' }, libellePoints(l.score)))));
}

// Podium des trois premiers (or au centre), comme l'écran des résultats.
export function podium(lignes, { grand = false } = {}) {
  const medailles = ['#FFE800', '#C9CDD8', '#E0955A'];
  // Télé : hauteurs en unité --u de la page télé (ecran.css), pour suivre la taille de l'écran.
  const hauteurs = grand ? [19.1, 14.1, 10.1] : [150, 110, 80];
  const hauteur = (n) => (grand ? `calc(${n} * var(--u))` : `${n}px`);
  const ordre = [1, 0, 2].filter((i) => lignes[i]);
  return h('div', { class: 'podium' }, ordre.map((i) => {
    const l = lignes[i];
    return h('div', { class: 'marche' },
      avatar(l.joueur, i === 0 || grand),
      h('span', { class: 'nom' }, l.joueur.nom),
      h('span', { class: 'score' }, libellePoints(l.score)),
      h('div', { class: 'socle', style: { height: hauteur(hauteurs[l.rang - 1] ?? hauteurs[2]), background: medailles[l.rang - 1] ?? '#fff' } }, l.rang));
  }));
}

// Garde l'écran allumé pendant la partie (si le navigateur le permet).
export async function garderEcranAllume() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen');
  } catch (_) { /* pas grave */ }
}

// « Comment ça marche ? » : les mêmes puces que dans l'appli (fenêtre du
// QR code, lib/features/partage/inviter_telephone.dart).
export const AIDE_TOUR_A_TOUR = [
  ['📱', 'Tu joues ici, dans le navigateur : rien à installer.'],
  ['🙋', 'Touche ton prénom.'],
  ['🎯', 'À ton tour, choisis ton niveau et réponds avant la fin du chrono.'],
  ['👀', 'Le reste du temps, suis la partie en direct. Le téléphone qui mène compte les points.'],
];
export const AIDE_CONNAIT = [
  ['📱', 'Tu joues ici, dans le navigateur : rien à installer.'],
  ['🙋', 'Touche ton prénom.'],
  ['🤫', 'Réponds à tes secrets en cachette, sur ton téléphone.'],
  ['👀', 'Ensuite, on devine tous ensemble sur le téléphone de la tablée.'],
];

export const listeAide = (puces) => h('ul', { class: 'aide-puces' },
  puces.map(([emoji, texte]) => h('li', null, h('span', { class: 'aide-emoji', 'aria-hidden': 'true' }, emoji), h('span', null, texte))));

// Encart repliable, ouvert à l'arrivée ; replié, il le reste.
let aideOuverte = true;
export function aide(puces) {
  const encart = h('details', { class: 'aide carte droite', open: aideOuverte }, h('summary', null, 'Comment ça marche ?'), listeAide(puces));
  encart.addEventListener('toggle', () => { aideOuverte = encart.open; });
  return encart;
}

// Petit « ? » toujours à portée de doigt pendant la partie.
export function installerBoutonAide(puces) {
  let fenetre = document.querySelector('.aide-fenetre');
  if (fenetre) {
    fenetre.querySelector('.aide-puces').replaceWith(listeAide(puces));
    return;
  }
  fenetre = h('div', { class: 'aide-fenetre', hidden: true, role: 'dialog', 'aria-label': 'Comment ça marche ?' },
    h('div', { class: 'carte droite pile' },
      h('h2', null, 'Comment ça marche ?'),
      listeAide(puces),
      h('button', { class: 'bouton jaune', onclick: () => { fenetre.hidden = true; } }, 'Compris !')));
  fenetre.addEventListener('click', (e) => { if (e.target === fenetre) fenetre.hidden = true; });
  const bouton = h('button', { class: 'aide-bouton', 'aria-label': 'Comment ça marche ?', onclick: () => { fenetre.hidden = false; } }, '?');
  document.body.append(bouton, fenetre);
}

// Page télé : une seule ligne, lisible de loin.
export const AIDE_TELE = 'Cet écran montre la partie. Pour jouer : scanne le QR code avec ton téléphone, choisis ton prénom, puis joue quand c\'est ton tour.';
export const AIDE_TELE_CONNAIT = 'Cet écran montre la partie. Pour jouer : scanne le QR code avec ton téléphone, choisis ton prénom, puis réponds à tes secrets.';
