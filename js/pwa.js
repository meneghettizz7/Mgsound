// Este arquivo registra o Service Worker para permitir o funcionamento da aplicação como PWA.


// Verifica se o navegador oferece suporte a Service Workers.
if ("serviceWorker" in navigator) {
    // Registra o Service Worker somente depois que a página terminar de carregar.
  window.addEventListener("load", () => {
        // O Service Worker cuida do cache e dos recursos offline da aplicação.
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .then(registration => {
        console.log("PWA ativa:", registration.scope);
      })
      .catch(error => {
        console.error("Erro ao registrar a PWA:", error);
      });
  });
}
