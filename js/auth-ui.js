/* Ekran koneksyon admin. */
import { signInWithEmailAndPassword, signOut } from './firebase.js';
import { esc, toast } from './ui.js';

export function showLogin(app) {
  app.innerHTML = `
    <div class="hero">
      <div class="wrap">
        <div class="brand"><h1>SòlPèp</h1></div>
        <p class="tagline">Konekte pou jere sòl ou.</p>
      </div>
    </div>
    <main class="wrap">
      <form class="stack login-form" novalidate>
        <label class="field"><span>Imèl</span>
          <input name="email" type="email" autocomplete="username" data-autofocus></label>
        <label class="field"><span>Modpas</span>
          <input name="password" type="password" autocomplete="current-password"></label>
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="submit" class="btn primary">Konekte</button>
        </div>
      </form>
    </main>`;

  const form = app.querySelector('form');
  const err = app.querySelector('[data-error]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    err.hidden = true;
    try {
      await signInWithEmailAndPassword(email, password);
      toast('Konekte.');
    } catch (ex) {
      const map = {
        'auth/invalid-credential': 'Imèl oswa modpas pa kòrèk.',
        'auth/user-not-found': 'Pa gen kont ak imèl sa a.',
        'auth/wrong-password': 'Modpas la pa kòrèk.',
        'auth/too-many-requests': 'Twòp eseye. Tann yon ti moman.'
      };
      err.textContent = map[ex.code] || ('Erè: ' + ex.code);
      err.hidden = false;
    }
  });
}

export async function doLogout() {
  await signOut();
}
