/* Bouton "Telechaje aplikasyon an": toujou vizib sou paj dakèy la (sof si app la deja enstale).
 * - Chrome/Edge/Android: fenèt enstalasyon natif la (beforeinstallprompt).
 * - Lòt ka (iPhone/Safari, Firefox, òdinatè): yon fèy ak etap yo. */
import { openSheet, esc } from './ui.js';

let deferred = null;
let installed = false;

export const isStandalone = () =>
  installed ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
  navigator.standalone === true;

function sync() {
  document.querySelectorAll('[data-install]').forEach((el) => { el.hidden = isStandalone(); });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  sync();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  installed = true;
  sync();
});

export const canInstall = () => !!deferred;
export const syncInstallButton = sync;

function platform() {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /crios|fxios|edgios|opios/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/android/i.test(ua)) return /firefox/i.test(ua) ? 'android-firefox' : 'android';
  return 'desktop';
}

const HELP = {
  'ios-safari': ['Tape bouton <b>Pataje</b> a (kare ak yon flèch) anba ekran an.', 'Desann epi chwazi <b>« Sou ekran dakèy »</b>.', 'Tape <b>Ajoute</b> anlè a.'],
  'ios-other': ['Sou iPhone, enstalasyon an mache sèlman nan <b>Safari</b>. Kopye adrès sit la epi louvri l nan Safari.', 'Tape bouton <b>Pataje</b> a, epi chwazi <b>« Sou ekran dakèy »</b>.', 'Tape <b>Ajoute</b>.'],
  'android': ['Tape meni <b>⋮</b> (twa pwen) anlè a nan Chrome.', 'Chwazi <b>« Enstale aplikasyon an »</b> oswa <b>« Ajoute sou ekran dakèy »</b>.', 'Konfime ak <b>Enstale</b>.'],
  'android-firefox': ['Tape meni <b>⋮</b> nan Firefox.', 'Chwazi <b>« Enstale »</b> oswa <b>« Ajoute sou ekran dakèy »</b>.'],
  'desktop': ['Nan Chrome oswa Edge, chèche ikòn <b>enstalasyon</b> an (yon ekran ak yon flèch) sou bò dwat bar adrès la.', 'Oswa louvri meni <b>⋮</b> epi chwazi <b>« Enstale SòlPèp »</b>.']
};

function openInstallHelp() {
  const steps = HELP[platform()];
  openSheet({
    title: 'Telechaje SòlPèp',
    html: `<div class="stack">
      <p class="hint">SòlPèp enstale sou telefòn ou tankou yon aplikasyon, gratis, epi li mache menm san entènèt.</p>
      <ol class="install-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      <button type="button" class="btn primary" data-close>Konprann</button>
    </div>`
  });
}

/** Rele nan klik bouton an. */
export async function promptInstall() {
  if (!deferred) { openInstallHelp(); return; }
  deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  if (choice && choice.outcome === 'accepted') installed = true;
  sync();
}
