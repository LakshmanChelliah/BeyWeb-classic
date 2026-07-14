/**
 * Smoke: tournament Change Bey shows a progress-loss confirm.
 * Usage: node scripts/verify-change-bey-confirm.mjs [url]
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8000/pc.html?capture=1';
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => errors.push(err.message));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(() => window.__beyCapture?.enabled, { timeout: 30000 });

const api = await page.evaluate(async () => {
  const cap = window.__beyCapture;
  await cap.waitBootReady();
  // Tournament is the default mode - just pick a bey.
  await cap.pickBey('pegasus');
  await cap.waitUntil(() => {
    const btn = document.getElementById('btn-start');
    return btn && !btn.disabled;
  }, { timeoutMs: 8000 });
  return { mode: document.querySelector('.play-setup')?.dataset?.mode || null };
});

// Show game-over chrome so Change Bey is clickable (tournament already active).
await page.evaluate(() => {
  document.getElementById('gameover-overlay')?.classList.add('visible');
});

await page.click('#btn-change-bey');
await page.waitForSelector('#confirm-dialog.visible', { timeout: 5000 });

const dialogText = await page.evaluate(() => ({
  title: document.getElementById('confirm-dialog-title')?.textContent?.trim(),
  msg: document.getElementById('confirm-dialog-msg')?.textContent?.trim(),
}));

if (!/progress/i.test(dialogText.msg || '')) {
  console.error('FAIL: confirm message missing progress warning', dialogText);
  process.exitCode = 1;
}

await page.click('.confirm-dialog-cancel');
await page.waitForFunction(
  () => !document.getElementById('confirm-dialog')?.classList.contains('visible'),
  { timeout: 3000 }
);

const stillOnStart = await page.evaluate(() => ({
  selectHidden: document.getElementById('select-overlay')?.classList.contains('hidden'),
  startHidden: document.getElementById('start-overlay')?.classList.contains('hidden'),
}));

if (!stillOnStart.selectHidden || stillOnStart.startHidden) {
  console.error('FAIL: cancel should keep tournament start overlay', stillOnStart);
  process.exitCode = 1;
}

await page.click('#btn-change-bey');
await page.waitForSelector('#confirm-dialog.visible', { timeout: 5000 });
await page.click('.confirm-dialog-ok');
await page.waitForFunction(
  () => !document.getElementById('select-overlay')?.classList.contains('hidden'),
  { timeout: 5000 }
);

// Casual: Change Bey should skip confirm.
await page.evaluate(async () => {
  const cap = window.__beyCapture;
  await cap.setCasualMode();
  await cap.pickBey('leone');
  await cap.waitUntil(() => {
    const btn = document.getElementById('btn-start');
    return btn && !btn.disabled;
  }, { timeoutMs: 8000 });
  document.getElementById('gameover-overlay')?.classList.add('visible');
});

await page.click('#btn-change-bey');
await page.waitForTimeout(400);
const casualConfirm = await page.evaluate(() =>
  Boolean(document.getElementById('confirm-dialog')?.classList.contains('visible'))
);
const casualSelect = await page.evaluate(
  () => !document.getElementById('select-overlay')?.classList.contains('hidden')
);

if (casualConfirm) {
  console.error('FAIL: casual Change Bey should not show confirm');
  process.exitCode = 1;
}
if (!casualSelect) {
  console.error('FAIL: casual Change Bey should return to select');
  process.exitCode = 1;
}

if (errors.length) {
  console.error('PAGE ERRORS:', errors);
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log('OK: tournament Change Bey confirm + casual skip', { api, dialogText });
}

await browser.close();
