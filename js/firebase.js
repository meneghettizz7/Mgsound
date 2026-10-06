// Este arquivo centraliza as configurações usadas pelos serviços externos do projeto.


// Importa o Firebase App, responsável por inicializar o projeto.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Importa o serviço de autenticação do Firebase.
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// Importa o Firestore, banco de dados usado para usuários, músicas e playlists.
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Dados que identificam o projeto Firebase utilizado pelo MgSound.
export const firebaseConfig = {
  apiKey: "AIzaSyC6LDZ0m0ezNYogqIsl-XCk43mmsRbG-_Q",
  authDomain: "meneghetti-music.firebaseapp.com",
  projectId: "meneghetti-music",
  storageBucket: "meneghetti-music.firebasestorage.app",
  messagingSenderId: "254127200481",
  appId: "1:254127200481:web:5056a069bbb102c5d67fa0",
  measurementId: "G-6KQKQNXMRQ"
};

// Configurações do Cloudinary, usado para armazenar capas e arquivos MP3.
export const cloudinaryConfig = {
  cloudName: "jf82l8hr",
  uploadPreset: "Meneghetti_upload"
};

// Verifica se os dados do Firebase foram preenchidos.
export const firebaseConfigured = !Object.values(firebaseConfig)
  .some(v => v.startsWith("SUA_") || v.startsWith("SEU_"));

// Verifica se o Cloudinary está configurado antes de permitir uploads.
export const cloudinaryConfigured = !Object.values(cloudinaryConfig)
  .some(v => v.startsWith("SEU_"));

// As variáveis começam vazias e são preenchidas somente quando o Firebase está configurado.
let app = null;
export let auth = null;
export let db = null;

// Inicializa os serviços do Firebase.
if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
