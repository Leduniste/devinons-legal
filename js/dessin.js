// Petits outils de dessin communs à la page joueur et à la page télé.

import { ACCESSOIRES, couleurAvatar, formatPoints, texteSur } from './etat.js';

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
    h('span', { class: 'score' }, `${formatPoints(l.score)} pts`))));
}

// Podium des trois premiers (or au centre), comme l'écran des résultats.
export function podium(lignes, { grand = false } = {}) {
  const medailles = ['#FFE800', '#C9CDD8', '#E0955A'];
  const hauteurs = grand ? [34, 25, 18] : [150, 110, 80];
  const unite = grand ? 'vh' : 'px';
  const ordre = [1, 0, 2].filter((i) => lignes[i]);
  return h('div', { class: 'podium' }, ordre.map((i) => {
    const l = lignes[i];
    return h('div', { class: 'marche' },
      avatar(l.joueur, i === 0 || grand),
      h('span', { class: 'nom' }, l.joueur.nom),
      h('span', { class: 'score' }, `${formatPoints(l.score)} pts`),
      h('div', { class: 'socle', style: { height: `${hauteurs[l.rang - 1] ?? hauteurs[2]}${unite}`, background: medailles[l.rang - 1] ?? '#fff' } }, l.rang));
  }));
}

// Garde l'écran allumé pendant la partie (si le navigateur le permet).
export async function garderEcranAllume() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen');
  } catch (_) { /* pas grave */ }
}
