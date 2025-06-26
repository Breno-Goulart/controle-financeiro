// firebase-config.js
// Configurações do Firebase - substituído pelas suas próprias credenciais
const firebaseConfig = {
    apiKey: "AIzaSyD998NH9Vco8Yfk-7n3XgMjLW-LkQkAgLA",
    authDomain: "controle-financeiro-c1a0b.firebaseapp.com",
    projectId: "controle-financeiro-c1a0b",
    storageBucket: "controle-financeiro-c1a0b.firebasestorage.app",
    messagingSenderId: "471645962387",
    appId: "1:471645962387:web:fd500fdeb62475596c0d66"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Exporta os serviços que serão usados em app.js (tornando-os globais)
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Configuração opcional para persistência offline do Firestore
// db.enablePersistence()
//   .catch((err) => {
//     if (err.code == 'failed-precondition') {
//       console.warn("Múltiplas abas abertas, persistência não habilitada.");
//     } else if (err.code == 'unimplemented') {
//       console.warn("O navegador atual não suporta persistência offline.");
//     }
//   });