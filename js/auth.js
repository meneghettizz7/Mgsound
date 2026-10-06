// Este arquivo controla login, cadastro e mensagens de erro da autenticação.


// Pega do arquivo de configuração a autenticação, o banco e o status da configuração.
import { auth, db, firebaseConfigured } from "../config/firebase.js";

// Funções do Firebase usadas para criar contas, fazer login e atualizar o perfil.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Funções do Firestore usadas para salvar o perfil do usuário.
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Atalho para buscar elementos HTML pelo ID.
const $ = id => document.getElementById(id);

// Área onde os erros de login ou cadastro são mostrados.
const errorBox = $("authError");

// Exibe uma mensagem de erro para o usuário.
function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

// Converte códigos técnicos do Firebase em mensagens mais fáceis de entender.
function friendlyError(error) {
  const messages = {
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/user-not-found": "Conta não encontrada.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente."
  };

  return messages[error.code] || error.message || "Ocorreu um erro. Tente novamente.";
}

// Impede tentativas de login quando o Firebase ainda não foi configurado.
if (!firebaseConfigured) {
  showError("Configure o Firebase em js/firebase.js antes de entrar ou criar uma conta.");
}


// Quando o formulário de login for enviado, valida e autentica o usuário.
$("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  errorBox.classList.add("hidden");

  if (!auth) {
    return showError("Firebase ainda não está configurado.");
  }

  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Entrando...";

  try {
    // Confere o e-mail e a senha no Firebase Authentication.
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );

    // Depois do login, abre a página principal.
    location.href = "index.html";
  } catch (error) {
    showError(friendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});


// Quando o formulário de cadastro for enviado, cria a conta e salva o perfil.
$("registerForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  errorBox.classList.add("hidden");

  if (!auth || !db) {
    return showError("Configure o Firebase antes de criar uma conta.");
  }

  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "Criando conta...";

  try {
    // Cria a conta no Firebase Authentication.
    const credential = await createUserWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );

    // Define o nome exibido no perfil do usuário autenticado.
    await updateProfile(credential.user, {
      displayName: $("name").value.trim()
    });

    // Salva informações adicionais do usuário no Firestore.
    await setDoc(
      doc(db, "usuarios", credential.user.uid),
      {
        nome: $("name").value.trim(),
        email: credential.user.email,
        tipo: "usuario",
        criadoEm: serverTimestamp()
      }
    );

    location.href = "index.html";
  } catch (error) {
    showError(friendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = "Criar conta";
  }
});
