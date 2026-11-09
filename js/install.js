/* Bouton "Enstale aplikasyon an" (Chrome/Android). Sou iPhone: Pataje > Ajoute sou ekran an. */
let deferred = null;

function sync() {
  document.querySelectorAll('[data-install]').forEach((el) => { el.hidden = !deferred; });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  sync();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  sync();
});

export const canInstall = () => !!deferred;
export const syncInstallButton = sync;

export async function promptInstall() {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  sync();
}
