// Connexion à Firebase depuis la page web : connexion anonyme (ni compte,
// ni e-mail), puis lecture de parties/{code} et dépôt des gestes dans
// parties/{code}/commandes, exactement comme un téléphone invité
// (lib/data/partage/partage_partie.dart, suivre et envoyer).
//
// Le SDK Firebase JS modulaire est chargé à la demande depuis le CDN de
// Google : seulement Firebase App, Auth et Firestore (~185 Ko compressés).

import { config, configuree } from './config.js';

export const VERSION_PAGE = 'web-1';

export async function ouvrirConnexion() {
  if (!configuree) throw new Error('config');
  const base = `https://www.gstatic.com/firebasejs/${config.versionFirebase}`;
  const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config.firebase);

  // App Check (reCAPTCHA Enterprise) : prêt, activé dès qu'une clé est réglée.
  if (config.recaptchaEnterprise) {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(`${base}/firebase-app-check.js`);
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.recaptchaEnterprise),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = getAuth(app);
  const { user } = await signInAnonymously(auth);
  const db = fs.getFirestore(app);

  const envoyer = (code, commande) => fs.addDoc(fs.collection(db, 'parties', code, 'commandes'), {
    ...commande,
    uid: user.uid,
    date: fs.serverTimestamp(),
  });

  return {
    uid: user.uid,

    // surEtat(données ou null quand la partie n'existe pas ou plus).
    suivre(code, surEtat, surErreur) {
      return fs.onSnapshot(fs.doc(db, 'parties', code), (doc) => surEtat(doc.exists() ? doc.data() : null), surErreur);
    },

    // Geste pour le téléphone qui mène ; les erreurs réseau sont rendues
    // à l'appelant (la page affiche « connexion perdue »).
    envoyer,
  };
}
