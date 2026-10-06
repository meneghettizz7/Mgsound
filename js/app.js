// Este arquivo concentra a lógica principal do MgSound: catálogo, playlist, player, Firebase e permissões.



// Importa os serviços e configurações do projeto.
import {
  auth,
  db,
  firebaseConfigured,
  cloudinaryConfig,
  cloudinaryConfigured
} from "../config/firebase.js";

// Funções de autenticação usadas para detectar o usuário e sair da conta.
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Funções do Firestore usadas para consultar, criar, editar, excluir e acompanhar dados em tempo real.
import {
  addDoc,
  arrayUnion,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Atalho para localizar elementos HTML pelo ID.
const $ = id => document.getElementById(id);
// Elemento de áudio que funciona como player do site.
const audio = $("audio");

// Guarda o usuário atualmente conectado.
let user = null;
// Lista local das músicas recebidas do Firestore.
let songs = [];
// Estilo musical selecionado como filtro.
let activeGenre = "";
// ID da música que está sendo reproduzida.
let currentId = null;
// Função que encerra o listener do catálogo quando necessário.
let unsubscribe = null;
// Controla o tempo de exibição das notificações rápidas.
let toastTimer;
// Define se o usuário possui permissão de administrador.
let isAdmin = false;

// Controla se o usuário está vendo o catálogo ou a biblioteca pessoal.
let currentView = "home";
// Guarda os IDs das músicas adicionadas à playlist do usuário.
let playlistSongIds = [];
// Função usada para parar o acompanhamento da playlist anterior.
let unsubscribePlaylist = null;

// Cores utilizadas nos cartões de estilos musicais.
const colors = [
  "#a82e83",
  "#28644f",
  "#294b91",
  "#b94d20",
  "#7650b7",
  "#246b7a",
  "#9b3345"
];

// Protege textos vindos do banco antes de inseri-los no HTML.
const safe = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

// Converte segundos do player para o formato minutos:segundos.
const time = n =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "0:00";

// Mostra uma pequena mensagem temporária na interface.
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    $("toast").classList.remove("show");
  }, 2800);
}

// Atualiza o indicador visual de conexão com o Firebase.
function status(message, good = false) {
  $("firebaseStatus").textContent = message;

  const dot = document.querySelector(".online-dot");

  if (dot) {
    dot.style.background = good ? "#1ed760" : "#e0a52c";
  }
}

// Mostra ou esconde ações administrativas conforme a permissão do usuário.
function atualizarBotoesAdmin() {
  const addButton = $("addButton");

  if (addButton) {
    addButton.classList.toggle("hidden", !isAdmin);
  }

  console.log("UID conectado:", user?.uid);
  console.log("E-mail conectado:", user?.email);
  console.log("Administrador:", isAdmin);
}

// Abre o formulário para adicionar uma música ou editar uma existente.
function openModal(song = null) {
  if (!isAdmin) {
    return toast("Somente o administrador pode cadastrar músicas.");
  }

  $("songForm").reset();
  $("formError").classList.add("hidden");
  $("songId").value = song?.id || "";

  $("modalTitle").textContent = song
    ? "Editar música"
    : "Adicionar música";

  $("saveSong").textContent = song
    ? "Salvar alterações"
    : "Salvar música";

  $("songName").value = song?.nome || "";
  $("artist").value = song?.artista || "";
  $("genre").value = song?.genero || "";
  $("album").value = song?.album || "";
  $("year").value = song?.ano || "";

  $("coverCurrent").textContent = song?.capaUrl
    ? "Capa atual: imagem salva (selecione outra para substituir)."
    : "";

  $("coverCurrent").classList.toggle("hidden", !song?.capaUrl);

  $("audioCurrent").textContent = song?.musicaUrl
    ? "Áudio atual: MP3 salvo (selecione outro para substituir)."
    : "";

  $("audioCurrent").classList.toggle("hidden", !song?.musicaUrl);

  $("songModal").classList.remove("hidden");
  $("songName").focus();
}

// Fecha o formulário de cadastro/edição.
function closeModal() {
  $("songModal").classList.add("hidden");
}

// Monta uma lista única com os estilos presentes no catálogo.
function catalogGenres() {
  return [
    ...new Set(songs.map(s => s.genero).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Desenha os cartões de estilos e as opções de filtro na tela.
function renderGenres() {
  const catalogList = catalogGenres();

  $("genreCards").innerHTML = catalogList.length
    ? catalogList.map((g, i) => `
        <button
          class="genre-card"
          data-genre="${safe(g)}"
          style="background:${colors[i % colors.length]}">
          <span>${safe(g)}</span>
          <small>${songs.filter(s => s.genero === g).length} faixas</small>
          <b>♫</b>
        </button>
      `).join("")
    : '<div class="empty compact">Nenhuma música cadastrada.</div>';

  $("genreOptions").innerHTML = catalogList
    .map(g => `<option value="${safe(g)}"></option>`)
    .join("");
}

// Filtra as músicas e monta os cartões exibidos no catálogo.
function renderSongs() {
  const term = $("searchInput").value
    .trim()
    .toLocaleLowerCase("pt-BR");

  const list = songs.filter(s =>
  (currentView !== "library" || playlistSongIds.includes(s.id)) &&
  (!activeGenre || s.genero === activeGenre) &&
  (
    !term ||
    [s.nome, s.artista, s.album, s.genero].some(v =>
      String(v || "")
        .toLocaleLowerCase("pt-BR")
        .includes(term)
    )
  )
);

  $("songsTitle").textContent =
    activeGenre ||
    (term
      ? "Resultados da pesquisa"
      : currentView === "library"
        ? "Sua biblioteca"
        : "Todas as músicas");

  $("songsCount").textContent = currentView === "library"
    ? `${list.length} ${list.length === 1 ? "música" : "músicas"} na sua biblioteca`
    : `${list.length} ${list.length === 1 ? "música" : "músicas"} disponíveis no catálogo`;

  $("showAll").classList.toggle("hidden", !activeGenre);

  if (!list.length) {
    $("songsGrid").innerHTML = `
      <div class="empty">
        <div class="empty-note">♫</div>
        <h3>
          ${songs.length
            ? "Nenhuma música encontrada"
            : currentView === "library"
              ? "Sua biblioteca está vazia"
              : "Nenhuma música no catálogo"}
        </h3>
        <p>
          ${songs.length
            ? "Tente outro termo ou estilo."
            : currentView === "library"
              ? "Volte ao Início e clique em ＋ nas músicas que quiser adicionar."
              : (isAdmin
                ? "Adicione uma música ao catálogo para começar."
                : "O administrador ainda não cadastrou músicas.")}
        </p>
        ${!songs.length && isAdmin
          ? '<button class="green-button" id="emptyAdd">＋ Adicionar música</button>'
          : ""}
      </div>
    `;

    $("emptyAdd")?.addEventListener("click", () => openModal());
    return;
  }

  $("songsGrid").innerHTML = list.map(s => `
    <article class="song-card">
      <div class="artwork">
        ${s.capaUrl
          ? `<img
              src="${safe(s.capaUrl)}"
              alt="Capa de ${safe(s.nome)}"
              loading="lazy"
              onerror="this.style.display='none'">`
          : '<span>♫</span>'}

        <button
          class="card-play"
          data-play="${safe(s.id)}"
          title="Reproduzir">
          ▶
        </button>
      </div>

      <h3 title="${safe(s.nome)}">${safe(s.nome)}</h3>

      <p>
        ${safe(s.artista)}
        ${s.album ? " · " + safe(s.album) : ""}
      </p>

      <div class="card-bottom">
        <span class="genre-tag">${safe(s.genero)}</span>

        <div>
          <button
            data-playlist="${safe(s.id)}"
            title="${playlistSongIds.includes(s.id) ? "Remover da playlist" : "Adicionar à playlist"}">
            ${playlistSongIds.includes(s.id) ? "−" : "＋"}
          </button>

          ${isAdmin && currentView === "home"
            ? `
              <button
                data-edit="${safe(s.id)}"
                title="Editar música do catálogo">
                ✎
              </button>

              <button
                data-delete="${safe(s.id)}"
                title="Excluir definitivamente do catálogo">
                ×
              </button>
            `
            : ""}
        </div>
      </div>
    </article>
  `).join("");
}

// Atualiza as principais áreas da interface depois de qualquer mudança de estado.
function render() {
  const catalogSection = $("catalogGenresSection");
  if (catalogSection) {
    catalogSection.classList.toggle("hidden", currentView !== "home");
  }

  $("welcomeOverline").textContent =
    currentView === "library" ? "SUA BIBLIOTECA, SEU SOM" : "SEU CATÁLOGO, SEU SOM";

  $("welcomeText").textContent =
    currentView === "library"
      ? "Aqui aparecem somente as músicas que você adicionou à playlist."
      : "Encontre todas as músicas disponíveis no MgSound.";

  renderGenres();
  renderSongs();
}

// Envia uma capa ou arquivo MP3 para o Cloudinary e retorna a URL pública.
async function uploadFile(file, type) {
  if (!file) return null;

  if (!cloudinaryConfigured) {
    throw new Error(
      "Configure cloudName e uploadPreset em js/firebase.js para enviar arquivos."
    );
  }

  const isImage = type === "image";

  if (
    isImage &&
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    throw new Error("A capa deve ser JPG, PNG ou WebP.");
  }

  if (
    !isImage &&
    file.type !== "audio/mpeg" &&
    !file.name.toLowerCase().endsWith(".mp3")
  ) {
    throw new Error("Selecione um arquivo MP3.");
  }

  const max = isImage ? 5 : 20;

  if (file.size > max * 1024 * 1024) {
    throw new Error(
      `O arquivo excede o limite sugerido de ${max} MB.`
    );
  }

  const endpoint =
    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/` +
    `${isImage ? "image" : "video"}/upload`;

  const body = new FormData();

  body.append("file", file);
  body.append("upload_preset", cloudinaryConfig.uploadPreset);

  const response = await fetch(endpoint, {
    method: "POST",
    body
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message || "Falha ao enviar arquivo."
    );
  }

  return result.secure_url;
}

// Valida o formulário e salva uma música nova ou atualiza uma existente no Firestore.
async function saveSong(event) {
  event.preventDefault();

  $("formError").classList.add("hidden");

  if (!isAdmin) {
    $("formError").textContent =
      "Somente o administrador pode cadastrar ou editar músicas.";

    $("formError").classList.remove("hidden");
    return;
  }

  if (!db || !user) {
    $("formError").textContent =
      "Firebase não configurado ou usuário desconectado.";

    $("formError").classList.remove("hidden");
    return;
  }

  const id = $("songId").value;
  const old = songs.find(s => s.id === id);

  const button = $("saveSong");

  button.disabled = true;
  button.textContent = "Enviando e salvando...";

  try {
    const coverFile = $("coverFile").files[0];
    const audioFile = $("audioFile").files[0];

    const capaUrl = coverFile
      ? await uploadFile(coverFile, "image")
      : (old?.capaUrl || "");

    const musicaUrl = audioFile
      ? await uploadFile(audioFile, "audio")
      : (old?.musicaUrl || "");

    const data = {
      nome: $("songName").value.trim(),
      artista: $("artist").value.trim(),
      genero: $("genre").value.trim(),
      album: $("album").value.trim(),
      ano: $("year").value
        ? Number($("year").value)
        : null,
      capaUrl,
      musicaUrl,
      usuarioId: user.uid,
      atualizadoEm: serverTimestamp()
    };

    if (!data.nome || !data.artista || !data.genero) {
      throw new Error(
        "Preencha nome, artista e estilo musical."
      );
    }

    if (id) {
      await updateDoc(doc(db, "musicas", id), data);
    } else {
      await addDoc(
        collection(db, "musicas"),
        {
          ...data,
          criadoEm: serverTimestamp()
        }
      );
    }

    closeModal();

    toast(
      id
        ? "Música atualizada!"
        : "Música cadastrada!"
    );

  } catch (error) {
    console.error("Erro ao salvar música:", error);

    $("formError").textContent = error.message;
    $("formError").classList.remove("hidden");

  } finally {
    button.disabled = false;

    button.textContent = id
      ? "Salvar alterações"
      : "Salvar música";
  }
}

// Exclui uma música do catálogo depois de confirmar com o administrador.
async function removeSong(id) {
  if (!isAdmin) {
    return toast(
      "Somente o administrador pode excluir músicas."
    );
  }

  const song = songs.find(s => s.id === id);

  if (
    !song ||
    !confirm(`Excluir "${song.nome}" da biblioteca?`)
  ) {
    return;
  }

  try {
    await deleteDoc(doc(db, "musicas", id));
    toast("Música excluída!");

  } catch (error) {
    console.error("Erro ao excluir música:", error);
    toast(`Erro: ${error.message}`);
  }
}

// Adiciona uma música à playlist pessoal do usuário.
async function addToPlaylist(id) {
  if (!user || !db) return;

  try {
    const ref = doc(db, "playlists", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists() || snap.data()?.manualizada !== true) {
      await setDoc(ref, {
        usuarioId: user.uid,
        musicas: [id],
        manualizada: true,
        atualizadoEm: serverTimestamp()
      });
    } else {
      await updateDoc(ref, {
        musicas: arrayUnion(id),
        manualizada: true,
        atualizadoEm: serverTimestamp()
      });
    }

    toast("Música adicionada à sua playlist!");

  } catch (error) {
    console.error("Erro na playlist:", error);
    toast(`Não foi possível adicionar: ${error.message}`);
  }
}

// Remove uma música da playlist pessoal sem apagar a música do catálogo.
async function removeFromPlaylist(id) {
  if (!user || !db) return;

  try {
    const ref = doc(db, "playlists", user.uid);

    await updateDoc(ref, {
      musicas: arrayRemove(id),
      manualizada: true,
      atualizadoEm: serverTimestamp()
    });

    toast("Saiu da sua playlist. A música continua no catálogo para todos.");

  } catch (error) {
    console.error("Erro ao remover da playlist:", error);
    toast(`Não foi possível remover: ${error.message}`);
  }
}

// Carrega a música escolhida no player e inicia a reprodução.
function playSong(id) {
  const song = songs.find(s => s.id === id);

  if (!song) return;

  currentId = id;

  $("playerTitle").textContent = song.nome;
  $("playerArtist").textContent = song.artista;

  $("playerCover").innerHTML = song.capaUrl
    ? `<img src="${safe(song.capaUrl)}" alt="">`
    : "♫";

  if (!song.musicaUrl) {
    toast("Esta música ainda não tem MP3 cadastrado.");
    return;
  }

  audio.src = song.musicaUrl;

  audio.play()
    .then(() => {
      $("playPause").textContent = "Ⅱ";
    })
    .catch(() => {
      toast("Não foi possível reproduzir o MP3.");
    });
}

// Avança ou volta uma posição na lista de músicas.
function stepSong(delta) {
  if (!songs.length) return;

  let i = songs.findIndex(s => s.id === currentId);

  i = (i + delta + songs.length) % songs.length;

  playSong(songs[i].id);
}

// Executa uma alteração da playlist e evita que um erro interrompa a interface.
async function awaitPlaylistAction(action, id) {
  try {
    await action(id);
  } catch (error) {
    console.error("Erro na ação da playlist:", error);
  }
}

// Eventos dos botões principais da interface.
$("addButton").addEventListener("click", () => openModal());

// Botões que fecham o modal.
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", closeModal);
});

// Envio do formulário de música.
$("songForm").addEventListener("submit", saveSong);

// Pesquisa atualiza os resultados conforme o usuário digita.
$("searchInput").addEventListener("input", renderSongs);

// Remove o filtro de estilo e mostra todas as músicas.
$("showAll").addEventListener("click", () => {
  activeGenre = "";
  render();
});


// Clique em um estilo aplica o filtro correspondente.
$("genreCards").addEventListener("click", event => {
  const button = event.target.closest("[data-genre]");

  if (button) {
    activeGenre = button.dataset.genre;
    render();
  }
});

// Um único listener trata play, edição, exclusão e playlist dos cartões.
$("songsGrid").addEventListener("click", event => {
  const playButton = event.target.closest("[data-play]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const playlistButton = event.target.closest("[data-playlist]");

  if (playButton) {
    playSong(playButton.dataset.play);
  }

  if (editButton && isAdmin) {
    const song = songs.find(
      s => s.id === editButton.dataset.edit
    );

    if (song) {
      openModal(song);
    }
  }

  if (deleteButton && isAdmin) {
    removeSong(deleteButton.dataset.delete);
  }

  if (playlistButton) {
    const id = playlistButton.dataset.playlist;

    if (playlistSongIds.includes(id)) {
      awaitPlaylistAction(removeFromPlaylist, id);
    } else {
      awaitPlaylistAction(addToPlaylist, id);
    }

    return;
  }
});

// Alterna entre a página inicial e a biblioteca pessoal.
document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    currentView = button.dataset.view === "library"
      ? "library"
      : "home";

    activeGenre = "";

    render();
  });
});

// Encerra a sessão atual e volta para a tela de login.
$("logoutButton").addEventListener("click", () => {
  signOut(auth).then(() => {
    location.href = "login.html";
  });
});

// Controla o botão de tocar/pausar.
$("playPause").addEventListener("click", () => {
  if (!currentId) {
    if (songs[0]) {
      playSong(songs[0].id);
    }
    return;
  }

  if (audio.paused) {
    audio.play()
      .then(() => {
        $("playPause").textContent = "Ⅱ";
      })
      .catch(() => {});
  } else {
    audio.pause();
    $("playPause").textContent = "▶";
  }
});

// Botões para mudar de faixa.
$("previous").addEventListener("click", () => stepSong(-1));
$("next").addEventListener("click", () => stepSong(1));

// Controla o volume do elemento de áudio.
$("volume").addEventListener("input", event => {
  audio.volume = Number(event.target.value);
});

// Permite arrastar a posição atual da música.
$("seek").addEventListener("input", event => {
  if (audio.duration) {
    audio.currentTime =
      Number(event.target.value) / 100 * audio.duration;
  }
});

// Atualiza tempo decorrido, duração e barra de progresso.
audio.addEventListener("timeupdate", () => {
  $("elapsed").textContent = time(audio.currentTime);
  $("duration").textContent = time(audio.duration);

  $("seek").value = audio.duration
    ? audio.currentTime / audio.duration * 100
    : 0;
});

// Quando uma música termina, reproduz a próxima.
audio.addEventListener("ended", () => stepSong(1));

// Sem Firebase configurado, a aplicação entra em modo de configuração.
if (!firebaseConfigured || !auth || !db) {
  status("Configure o Firebase");

  $("userEmail").textContent = "Modo de configuração";

  $("songsGrid").innerHTML = `
    <div class="empty">
      <div class="empty-note">⚙</div>
      <h3>Configure o Firebase</h3>
      <p>
        Abra js/firebase.js e preencha as configurações
        do seu projeto. Consulte o README.
      </p>
    </div>
  `;

} else {

  // Monitora o estado do login e executa o carregamento somente para usuários autenticados.
  onAuthStateChanged(auth, async account => {

    if (!account) {
      location.href = "login.html";
      return;
    }

    // Guarda os dados básicos da conta para serem usados no restante da aplicação.
    user = account;

    $("userEmail").textContent =
      account.displayName ||
      account.email ||
      "Usuário";

    status("Conectado ao Firebase", true);

    try {
      // Busca o documento do perfil do usuário no Firestore.
      const profileRef = doc(
        db,
        "usuarios",
        account.uid
      );

      let profile = await getDoc(profileRef);

      if (!profile.exists()) {
        await setDoc(profileRef, {
          nome: account.displayName || "",
          email: account.email || "",
          tipo: "usuario",
          criadoEm: serverTimestamp()
        });

        profile = await getDoc(profileRef);
      }

      const profileData = profile.data();

      console.log("UID da conta:", account.uid);
      console.log("Dados do perfil:", profileData);

    isAdmin = String(profileData?.tipo ?? "")
    .trim()
    .toLowerCase() === "admin";

    console.log("Tipo do perfil:", JSON.stringify(profileData?.tipo));
console.log("É administrador?", isAdmin);

atualizarBotoesAdmin();

      console.log("É administrador?", isAdmin);

      atualizarBotoesAdmin();

      if (unsubscribePlaylist) {
  unsubscribePlaylist();
}

// Cada usuário possui uma playlist identificada pelo próprio UID.
const playlistRef = doc(db, "playlists", account.uid);

// Acompanha a playlist em tempo real para atualizar a biblioteca sem recarregar a página.
unsubscribePlaylist = onSnapshot(
  playlistRef,
  snapshot => {
    const data = snapshot.exists() ? snapshot.data() : null;

    playlistSongIds = data?.manualizada === true
      ? (data.musicas || [])
      : [];

    renderSongs();
  },
  error => {
    console.error("Erro ao carregar playlist:", error);
    toast("Não foi possível carregar sua biblioteca.");
  }
);

      if (unsubscribe) {
        unsubscribe();
      }

      // Acompanha a coleção de músicas em tempo real. Qualquer alteração aparece automaticamente no catálogo.
      unsubscribe = onSnapshot(
  query(collection(db, "musicas")),
  snapshot => {
    songs = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    render();
  },
  error => {
    console.error("Erro ao carregar músicas:", error);
    status("Erro ao carregar músicas");
    toast(error.message);
  }
);

    } catch (error) {
      console.error(
        "Erro ao verificar perfil do usuário:",
        error
      );

      status("Erro ao verificar perfil");

      toast(
        "Não foi possível verificar sua permissão: " +
        error.message
      );
    }
  });
}