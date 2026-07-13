/**
 * Lightweight in-game confirm overlay (Promise-based).
 * Matches gameover / arena transition styling.
 */

function ensureOverlay() {
  let el = document.getElementById('confirm-dialog');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'confirm-dialog';
  el.className = 'confirm-dialog';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'confirm-dialog-title');
  el.setAttribute('aria-describedby', 'confirm-dialog-msg');
  el.innerHTML = `
    <div class="confirm-dialog-card">
      <h2 id="confirm-dialog-title" class="confirm-dialog-title"></h2>
      <p id="confirm-dialog-msg" class="confirm-dialog-msg"></p>
      <div class="confirm-dialog-actions">
        <button type="button" class="confirm-dialog-cancel gameover-btn-secondary">Cancel</button>
        <button type="button" class="confirm-dialog-ok" id="btn-confirm-ok">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

/**
 * @param {{
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} opts
 * @returns {Promise<boolean>} true if confirmed
 */
export function showConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  const el = ensureOverlay();
  const titleEl = el.querySelector('.confirm-dialog-title');
  const msgEl = el.querySelector('.confirm-dialog-msg');
  const okBtn = el.querySelector('.confirm-dialog-ok');
  const cancelBtn = el.querySelector('.confirm-dialog-cancel');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (okBtn) {
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle('confirm-dialog-ok--danger', Boolean(danger));
  }
  if (cancelBtn) cancelBtn.textContent = cancelLabel;

  return new Promise((resolve) => {
    const finish = (value) => {
      el.classList.remove('visible');
      el.setAttribute('aria-hidden', 'true');
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      el.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    el.addEventListener('keydown', onKey);

    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    // Prefer focusing Cancel so a hasty Enter/tap doesn't wipe progress.
    (cancelBtn || okBtn)?.focus?.();
  });
}
