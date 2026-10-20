// Réglages de la page web de Devinons (joueur invité et écran télé).
//
// La configuration Firebase vient de la console Firebase : Paramètres du
// projet → Vos applications → Ajouter une application Web (sans
// Hosting). Ces valeurs ne sont pas secrètes (elles sont visibles par tout
// navigateur) ; la protection vient des règles Firestore, de la
// restriction de la clé aux adresses du site et, plus tard, d'App Check.
export const config = {
  firebase: {
    apiKey: 'AIzaSyB95fjVaTzMQQAdnvIaneAzT8dNj3dtOz0',
    authDomain: 'devinons.firebaseapp.com',
    projectId: 'devinons',
    storageBucket: 'devinons.firebasestorage.app',
    messagingSenderId: '67446112688',
    appId: '1:67446112688:web:4c26318df5c9bc7ebb5675',
  },

  // Clé de site reCAPTCHA Enterprise pour App Check (0.1.9 ou après) :
  // laisser vide tant qu'App Check n'est pas activé pour le web.
  recaptchaEnterprise: '',

  // Version du SDK Firebase JS chargée depuis le CDN de Google.
  versionFirebase: '12.4.0',

  // Liens affichés sur la page.
  playStore: 'https://play.google.com/store/apps/details?id=com.leduniste.devinons',
  pageJoueur: 'https://leduniste.github.io/devinons-legal/partie.html',
};

// La page a reçu sa vraie configuration Firebase.
export const configuree = !Object.values(config.firebase).includes('A_REMPLIR');
