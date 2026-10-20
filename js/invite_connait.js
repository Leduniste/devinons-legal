// Joueur invité d'une partie On se connaît, dans le navigateur : chacun
// répond à ses secrets sur son téléphone, en cachette et en même temps que
// les autres, puis suit les devinettes qui se jouent autour du téléphone
// de la tablée (comme lib/features/on_se_connait/ecrans/connait_suivie_screen.dart).
//
// Gestes envoyés au téléphone qui mène, seul juge :
//   prendre (joueurId)                       ce téléphone répond pour ce joueur
//   secret  (joueurId, tour: question, valeur: choix)
//   rendre  (joueurId)                       il finira sur le téléphone de la tablée

import { GARDE_TOUCHER_MS, LETTRES, formatPoints, formatPointsSigne } from './etat.js';
import { CATEGORIES, avancement, lireConnait, occupation, restants, voteSurJoueurs } from './connait.js';
import { avatar, garderEcranAllume, h, lignesClassement, logo, podium } from './dessin.js';

export function inviteConnait({ afficher, envoyer, uid, code, memoire, ecranMessage, boutonAutrePartie, piedInstaller, carteInstaller }) {
  let vue = null;
  let moi = null; // joueur choisi ici
  let confirme = false; // le téléphone qui mène nous l'a confié
  let spectateur = false;
  let message = null;
  let envoyes = new Set(); // secrets partis d'ici, pas encore confirmés
  let finie = false;
  let derniereCle = null;
  let gardeJusqua = 0;

  const cleMemoire = `devinons-connait-${code}`;
  const geste = (action, autres = {}) => envoyer({ action, joueurId: moi, ...autres });

  function recevoir(etat) {
    if (!etat) {
      if (vue && vue.etape === 'terminee') return;
      finie = true;
      return ecranMessage('Partie arrêtée', 'La partie a été arrêtée sur le téléphone qui la menait.', boutonAutrePartie());
    }
    const nouvelle = lireConnait(etat);
    if (!nouvelle) return ecranMessage('Partie illisible', 'Cette partie ne peut pas s\'afficher ici.', boutonAutrePartie());
    if (nouvelle.tropRecent) {
      return ecranMessage('Page à mettre à jour', 'Cette partie vient d\'une version plus récente de Devinons. Recharge la page.',
        h('button', { class: 'bouton jaune', onclick: () => location.reload() }, 'Recharger'));
    }
    const premiere = !vue;
    vue = nouvelle;
    // Page rechargée en plein milieu : on reprend son joueur.
    if (premiere && !moi) {
      const garde = memoire(cleMemoire);
      if (garde && vue.telephones[garde] === uid) { moi = garde; confirme = true; }
    }
    suivreMonJoueur();
    rendre();
  }

  // Le téléphone qui mène a-t-il accepté, refusé ou repris notre joueur ?
  function suivreMonJoueur() {
    if (!moi || !vue.phaseSecrets) return;
    const tenu = vue.telephones[moi];
    if (tenu === uid) confirme = true;
    else if (confirme) { message = 'Tu finis tes secrets sur le téléphone de la tablée.'; lacher(true); }
    else if (tenu || vue.surPlace === moi) { message = `${vue.joueur(moi)?.nom || 'Ce joueur'} répond déjà sur un autre téléphone.`; lacher(false); }
  }

  function lacher(enSpectateur) {
    moi = null;
    confirme = false;
    spectateur = enSpectateur;
    envoyes = new Set();
    memoire(cleMemoire, '');
  }

  function choisir(joueur) {
    moi = joueur.id;
    confirme = false;
    spectateur = false;
    message = null;
    envoyes = new Set();
    memoire(cleMemoire, joueur.id);
    geste('prendre');
    envoyer({ action: 'bonjour', appareil: 'web', joueurId: joueur.id });
    garderEcranAllume();
    rendre();
  }

  function repondre(question, choix) {
    if (performance.now() < gardeJusqua || envoyes.has(question)) return;
    envoyes.add(question);
    geste('secret', { tour: question, valeur: choix });
    rendre();
  }

  // Page fermée avant la fin de ses secrets : il les finira sur le téléphone
  // de la tablée (il peut aussi revenir et reprendre son prénom).
  function auRevoir() {
    if (confirme && vue && vue.phaseSecrets && restants(vue, moi, envoyes).length) geste('rendre');
  }

  function rendre() {
    if (!vue || finie) return;
    let noeuds;
    let cle = vue.etape;
    if (vue.etape === 'terminee') noeuds = ecranFin();
    else if (vue.manche) { noeuds = ecranManche(); cle += vue.manche.numero; }
    else if (!vue.phaseSecrets) noeuds = [h('p', { class: 'centre points-attente' }, 'Un instant')];
    else if (!moi) noeuds = spectateur ? ecranSecretsEnCours() : ecranQui();
    else if (!confirme) noeuds = [logo(), h('p', { class: 'centre points-attente', style: { marginTop: '40px' } }, 'Un instant')];
    else {
      const reste = restants(vue, moi, envoyes);
      if (reste.length) { noeuds = ecranSecret(reste); cle += reste[0]; } else noeuds = ecranSecretsEnCours();
    }
    afficher(...noeuds);
    // Une question qui vient d'apparaître ignore les touchers un court instant.
    const choix = document.querySelector('[data-choix]');
    if (choix && cle !== derniereCle) {
      gardeJusqua = performance.now() + GARDE_TOUCHER_MS;
      choix.classList.add('garde');
      setTimeout(() => choix.classList.remove('garde'), GARDE_TOUCHER_MS);
    }
    derniereCle = cle;
  }

  const phase = (texte) => h('p', { class: 'centre titre', style: { color: 'var(--bleu)', fontSize: '20px', margin: '4px 0' } }, texte);

  const etiquette = (categorie) => {
    const c = CATEGORIES[categorie];
    return h('span', { class: 'etiquette', style: { background: c.couleur, color: categorie === 'souvenirs' ? 'var(--encre)' : '#fff' } }, c.libelle);
  };

  function ecranQui() {
    return [
      logo(),
      phase('Phase 1 · Les secrets'),
      h('h1', { class: 'centre', style: { fontSize: '36px' } }, 'Qui es-tu ?'),
      h('p', { class: 'centre' }, 'Touche ton prénom : tu réponds à tes secrets sur ce téléphone, en cachette, pendant que les autres répondent sur le leur.'),
      message ? h('p', { class: 'centre', role: 'alert' }, message) : null,
      h('div', { class: 'pile' }, vue.joueurs.filter((j) => (vue.secrets[j.id] || []).length).map((j) => {
        const occupe = occupation(vue, j.id, uid);
        return h('button', { class: 'choix-joueur', disabled: !!occupe, onclick: () => choisir(j) },
          avatar(j), h('span', null, j.nom, occupe ? h('small', { class: 'detail' }, occupe) : null));
      })),
      h('div', { class: 'espace' }),
      h('button', { class: 'bouton lien', onclick: () => { spectateur = true; rendre(); } }, 'Je regarde seulement'),
      piedInstaller(),
    ];
  }

  function ecranSecret(reste) {
    const q = vue.questions[reste[0]];
    const total = (vue.secrets[moi] || []).length;
    const joueur = vue.joueur(moi);
    if (!q) return [h('p', { class: 'centre points-attente' }, 'La question arrive')];
    const choix = voteSurJoueurs(q.categorie)
      ? vue.joueurs.map((j, i) => h('button', { class: 'choix-joueur', onclick: () => repondre(reste[0], i) }, avatar(j), j.nom))
      : q.propositions.map((texte, i) => h('button', { class: 'proposition', onclick: () => repondre(reste[0], i) },
        h('span', { class: 'lettre' }, LETTRES[i]), h('span', null, texte)));
    return [
      h('div', { class: 'entete' }, avatar(joueur), h('span', { class: 'nom' }, joueur.nom),
        h('span', { class: 'compteur' }, `secret ${total - reste.length + 1} / ${total}`)),
      h('div', { class: 'espace', style: { height: '10px' } }),
      etiquette(q.categorie),
      h('div', { class: 'espace', style: { height: '12px' } }),
      h('div', { class: 'carte' }, h('div', { class: 'enonce' }, q.secret)),
      h('div', { class: 'espace' }),
      h('div', { class: 'pile', 'data-choix': '' }, choix),
      h('p', { class: 'centre petit', style: { marginTop: '16px' } }, '🤫 Personne ne verra ta réponse avant la révélation.'),
    ];
  }

  function ecranSecretsEnCours() {
    const fini = moi && confirme;
    return [
      logo(),
      phase('Phase 1 · Les secrets'),
      fini
        ? h('div', { class: 'centre' },
          h('div', { style: { fontSize: '48px' } }, '🔒'),
          h('h1', { style: { fontSize: '34px' } }, 'Secrets bien gardés !'),
          h('p', null, 'Personne ne les verra avant la révélation. Pose le téléphone et rejoins la tablée : les devinettes commencent dès que tout le monde a répondu.'))
        : h('h2', { class: 'centre' }, message || 'Les secrets arrivent…'),
      h('div', { class: 'espace' }),
      h('div', { class: 'classement' }, vue.joueurs.filter((j) => (vue.secrets[j.id] || []).length).map((j) => h('div', { class: `ligne${j.id === moi ? ' moi' : ''}` },
        avatar(j), h('span', { class: 'nom' }, j.nom), h('span', { class: 'petit' }, avancement(vue, j.id, j.id === moi ? envoyes : new Set()))))),
      !fini ? h('button', { class: 'bouton lien', onclick: () => { spectateur = false; message = null; rendre(); } }, 'Répondre à mes secrets ici') : null,
    ];
  }

  function verite() {
    const m = vue.manche;
    const q = m.question;
    const vises = vue.joueurs.filter((j) => m.vises.includes(j.id));
    if (q.categorie === 'devineMaReponse') {
      const heros = vue.joueur(q.heros);
      if (!heros || m.choixHeros === null) return [];
      return [h('h2', null, `${heros.nom} a répondu :`),
        h('div', { class: 'proposition juste', style: { marginTop: '10px' } }, h('span', { class: 'lettre' }, LETTRES[m.choixHeros]), h('span', null, q.propositions[m.choixHeros]))];
    }
    if (q.categorie === 'quiARepondu') {
      return [h('h2', null, vises.length > 1 ? 'C\'étaient :' : 'C\'était :'),
        h('div', { class: 'pile', style: { marginTop: '10px' } }, vises.map((j) => h('div', { class: 'choix-joueur juste' }, avatar(j), j.nom)))];
    }
    return [h('h2', null, 'Le plus de voix :'),
      h('div', { class: 'pile', style: { marginTop: '10px' } }, vises.map((j) => h('div', { class: 'choix-joueur juste' }, avatar(j), j.nom,
        h('span', { class: 'voix' }, `${m.voix[j.id] || 0} voix`))))];
  }

  function ecranManche() {
    const m = vue.manche;
    const devineur = vue.joueur(m.devineur) || { id: m.devineur, nom: '?', couleur: 0 };
    const gain = m.revelee ? m.gains[devineur.id] || 0 : 0;
    return [
      phase(`Phase 2 · Question ${m.numero} / ${vue.nombreQuestions}`),
      h('div', { class: 'entete' }, avatar(devineur), h('span', { class: 'nom' }, devineur.id === moi ? 'À toi de deviner !' : `${devineur.nom} devine`)),
      h('div', { class: 'espace', style: { height: '10px' } }),
      etiquette(m.question.categorie),
      h('div', { class: 'espace', style: { height: '12px' } }),
      h('div', { class: 'carte' }, h('div', { class: 'enonce enonce-long' }, m.enonce)),
      h('div', { class: 'espace' }),
      m.revelee
        ? [verite(), h('div', { class: 'espace' }),
          h('div', { class: `verdict ${m.juste ? 'juste' : 'faux'}` }, m.juste ? `Bien joué, ${devineur.nom} ! ${formatPointsSigne(gain)}` : 'Raté !')]
        : h('p', { class: 'centre points-attente' }, devineur.id === moi
          ? 'Réponds sur le téléphone de la tablée, devant tout le monde'
          : `Les yeux sur le téléphone de la tablée : ${devineur.nom} réfléchit`),
      h('div', { class: 'espace' }),
      lignesClassement(vue.classementEnCours(), moi),
    ];
  }

  function ecranFin() {
    const lignes = vue.classement;
    const premiers = lignes.filter((l) => l.rang === 1).map((l) => l.joueur.nom);
    const moiLigne = lignes.find((l) => l.joueur.id === moi);
    return [
      logo(),
      h('h1', { class: 'centre' }, `Bravo ${premiers.join(' et ')} !`),
      podium(lignes),
      lignes.length > 3 ? lignesClassement(lignes.slice(3), moi) : null,
      moiLigne ? h('p', { class: 'centre' }, `Toi, ${moiLigne.joueur.nom} : ${formatPoints(moiLigne.score)} pts, ${moiLigne.bonnes} bonne${moiLigne.bonnes > 1 ? 's' : ''} devinette${moiLigne.bonnes > 1 ? 's' : ''} sur ${moiLigne.jouees}.`) : null,
      h('div', { class: 'espace' }),
      carteInstaller(),
      piedInstaller(),
    ];
  }

  return { recevoir, auRevoir };
}
