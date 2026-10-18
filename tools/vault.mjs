#!/usr/bin/env node
// Encrypts the site's data with a passphrase, or decrypts it again. No dependencies (Node 18+).
//
//   node tools/vault.mjs lock   <dir with sheet.json + seed.json> <vault.json to write> [--new-passphrase]
//   node tools/vault.mjs unlock <vault.json> <dir to write sheet.json + seed.json>
//
// Format: gzip(JSON {sheet, seed}) encrypted with AES-256-GCM; the key comes from the passphrase
// via PBKDF2-SHA256. assets/app.js decrypts the same format in the browser.
// The passphrase is typed at a hidden prompt (or read from VAULT_PASSPHRASE for scripted runs).
import { webcrypto as crypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ITERATIONS = 600000;
const MIN_LENGTH = 10;

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function ask(prompt) {
  return new Promise((done) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      const onData = (d) => {
        buf += d;
        const i = buf.indexOf('\n');
        if (i >= 0) { stdin.off('data', onData); stdin.pause(); done(buf.slice(0, i).replace(/\r$/, '')); }
      };
      stdin.on('data', onData);
      stdin.resume();
      return;
    }
    let s = '';
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          done(s);
          return;
        }
        if (c === '\u0003') { stdin.setRawMode(false); stdout.write('\n'); process.exit(130); }
        if (c === '\u007f' || c === '\b') {
          if (s.length) { s = s.slice(0, -1); stdout.write('\b \b'); }
          continue;
        }
        if (c < ' ') continue;
        s += c;
        stdout.write('*');
      }
    };
    stdin.on('data', onData);
    stdin.resume();
  });
}

async function choosePassphrase() {
  if (process.env.VAULT_PASSPHRASE) return process.env.VAULT_PASSPHRASE;
  console.log('Choose the passphrase that will open your DSA Prep Sheet.');
  console.log(`Use at least ${MIN_LENGTH} characters; a few random words work well. Save it in your password manager.`);
  for (;;) {
    const p = await ask('Passphrase: ');
    if (p.length < MIN_LENGTH) { console.log(`Too short: use at least ${MIN_LENGTH} characters.`); continue; }
    const again = await ask('Type it again: ');
    if (again !== p) { console.log('The two entries did not match. Try again.'); continue; }
    return p;
  }
}

// When the vault already exists, re-lock with the same passphrase and salt (asked once, checked against the current
// vault), so devices that remember the passphrase stay unlocked. --new-passphrase picks a new one instead.
async function currentPassphrase(old) {
  const passphrase = process.env.VAULT_PASSPHRASE || (await ask('Current passphrase: '));
  const key = await deriveKey(passphrase, unb64(old.salt), old.iter);
  try {
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(old.iv) }, key, unb64(old.data));
  } catch {
    console.error('That passphrase does not open the current vault. Nothing was changed.\nTo set a different passphrase, run the same command with --new-passphrase.');
    process.exit(1);
  }
  return passphrase;
}

async function lock(inDir, outFile, newPassphrase) {
  const sheet = JSON.parse(readFileSync(join(inDir, 'sheet.json'), 'utf8'));
  const seed = JSON.parse(readFileSync(join(inDir, 'seed.json'), 'utf8'));
  const old = !newPassphrase && existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
  const passphrase = old ? await currentPassphrase(old) : await choosePassphrase();
  const salt = old ? unb64(old.salt) : crypto.getRandomValues(new Uint8Array(16));
  const iterations = old ? old.iter : ITERATIONS;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plain = JSON.stringify({ sheet, seed });
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, gzipSync(Buffer.from(plain), { level: 9 })));

  // decrypt again with a freshly derived key before writing anything
  const check = await deriveKey(passphrase, salt, iterations);
  const back = gunzipSync(Buffer.from(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, check, sealed))).toString();
  if (back !== plain) throw new Error('Verification failed; nothing was written.');

  const vault = { v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, cipher: 'AES-256-GCM', salt: b64(salt), iv: b64(iv), data: b64(sealed) };
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(vault));
  console.log(`Locked ${Object.keys(sheet.problems).length} problems and ${Object.keys(seed).length} progress entries into ${relative(process.cwd(), outFile)} (${Math.round(JSON.stringify(vault).length / 1024)} KB). Verified: the passphrase opens it.`);
}

async function unlock(vaultFile, outDir) {
  const vault = JSON.parse(readFileSync(vaultFile, 'utf8'));
  const passphrase = process.env.VAULT_PASSPHRASE || (await ask('Passphrase: '));
  const key = await deriveKey(passphrase, unb64(vault.salt), vault.iter);
  let plain;
  try {
    plain = gunzipSync(Buffer.from(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.data)))).toString();
  } catch {
    console.error('Wrong passphrase.');
    process.exit(1);
  }
  const { sheet, seed } = JSON.parse(plain);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sheet.json'), JSON.stringify(sheet));
  writeFileSync(join(outDir, 'seed.json'), JSON.stringify(seed));
  console.log(`Wrote sheet.json and seed.json to ${outDir}`);
}

const flags = process.argv.slice(2).filter((x) => x.startsWith('--'));
const [cmd, a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
if (cmd === 'lock' && a && b) await lock(resolve(a), resolve(b), flags.includes('--new-passphrase'));
else if (cmd === 'unlock' && a && b) await unlock(resolve(a), resolve(b));
else {
  console.log('Usage:\n  node tools/vault.mjs lock   <dir with sheet.json + seed.json> <vault.json> [--new-passphrase]\n  node tools/vault.mjs unlock <vault.json> <output dir>');
  process.exit(2);
}
