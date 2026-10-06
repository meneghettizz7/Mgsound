// Registro e atualização segura do PWA MgSound.
(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none"
      });

      // Verifica se existe uma versão nova do aplicativo.
      registration.update().catch(() => {});

      // Quando uma versão nova assumir o controle, recarrega uma única vez
      // para que o celular passe a usar os arquivos novos.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

      console.log("MgSound PWA ativo:", registration.scope);
    } catch (error) {
      console.error("Erro ao registrar o PWA:", error);
    }
  });
})();
