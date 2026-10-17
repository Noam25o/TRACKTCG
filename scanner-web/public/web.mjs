import { createBrowserStore } from './storage.mjs';
import { addEntries, removeOne, mergeBackup, decodeBackup, encodeBackup, parsePurchasePrice,
  collectionTotals, matchesCollection, finishes, MAX_BYTES } from './collection.mjs';

const $ = (id) => document.getElementById(id);
const store = createBrowserStore();
const euro = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const imageUrl = (url) => `/api/reference?${new URLSearchParams({ url })}`;
let screen = 'catalog', entries = [], storeReady = false, saving = false, pendingImport = null;
let browseCards = [], browsePage = 0, browseGeneration = 0, browseAbort = null, browseTimer = null;
let detailGeneration = 0, detailAbort = null, activeCard = null, collectionGeneration = 0;
let quotes = [], priceAbort = null, priceGeneration = 0;
const screenScroll = { catalog: 0, collection: 0, scanner: 0 };

function status(id, message, error = false) {
  $(id).textContent = message; $(id).classList.toggle('error', error);
  $(id).classList.remove('notice');
}
function notice(id, message) { status(id, message); $(id).classList.add('notice'); }
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('icon'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `#i-${name}`);
  svg.append(use); return svg;
}
function storageControls() {
  $('add-submit').disabled = !storeReady || saving || !activeCard;
  $('export-backup').disabled = !storeReady || saving;
  $('backup-import').disabled = !storeReady || saving;
  $('import-confirm').disabled = !storeReady || saving || !pendingImport;
}
function navigate(next) {
  if (!['catalog', 'scanner', 'collection'].includes(next)) return;
  screenScroll[screen] = window.scrollY;
  screen = next;
  $('intro').hidden = next !== 'catalog';
  for (const name of ['catalog', 'scanner', 'collection']) {
    $(`screen-${name}`).hidden = name !== next; $(`nav-${name}`).setAttribute('aria-pressed', String(name === next));
  }
  document.dispatchEvent(new CustomEvent('tracktcg:navigate', { detail: next }));
  if (next === 'collection') refreshCollection();
  window.scrollTo({ top: screenScroll[next], behavior: 'instant' });
}
for (const name of ['catalog', 'scanner', 'collection']) $(`nav-${name}`).addEventListener('click', () => navigate(name));
$('collection-to-catalog').addEventListener('click', () => navigate('catalog'));
for (const name of ['help', 'backup']) {
  const dialog = $(`${name}-dialog`);
  $(`${name}-open`).addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('tracktcg:navigate', { detail: name }));
    dialog.showModal();
  });
  $(`${name}-close`).addEventListener('click', () => dialog.close());
}
$('backup-shortcut').addEventListener('click', () => $('backup-open').click());
$('backup-import').addEventListener('click', () => $('backup-file').click());
// Segments drive the existing select and its change event, so scanner
// invalidation/cancellation stay identical to the original language control.
for (const button of document.querySelectorAll('[data-language-target]')) {
  button.addEventListener('click', () => {
    const select = $(button.dataset.languageTarget);
    if (select.value === button.dataset.language) return;
    select.value = button.dataset.language; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
for (const target of ['browse-language', 'language']) {
  $(target).hidden = true;
  document.querySelector(`label[for="${target}"]`).hidden = true;
  $(target).addEventListener('change', () => {
    for (const button of document.querySelectorAll(`[data-language-target="${target}"]`)) {
      button.setAttribute('aria-pressed', String(button.dataset.language === $(target).value));
    }
  });
}
for (const [id, delta] of [['quantity-minus', -1], ['quantity-plus', 1]]) {
  $(id).addEventListener('click', () => {
    const value = Number($('add-quantity').value);
    $('add-quantity').value = String(Math.max(1, Math.min(9999, (Number.isInteger(value) ? value : 1) + delta)));
  });
}

async function json(url, signal) {
  const controller = new AbortController(), cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Le catalogue est indisponible. Réessaie.');
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('La source met trop de temps à répondre. Réessaie.');
    if (error instanceof TypeError) throw new Error('Connexion impossible. Vérifie Internet et le lien de test.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

function artwork(images, name, onSource) {
  const wrap = document.createElement('div'); wrap.className = 'artwork';
  const placeholder = document.createElement('span'); placeholder.className = 'image-placeholder'; placeholder.textContent = 'Image indisponible';
  const image = document.createElement('img'); image.alt = name; image.loading = 'lazy'; image.decoding = 'async';
  wrap.append(placeholder, image); let index = -1;
  function next() {
    index++;
    if (index >= images.length) { image.hidden = true; placeholder.hidden = false; onSource?.('Image indisponible'); return; }
    image.src = imageUrl(images[index].url);
  }
  image.addEventListener('load', () => { image.hidden = false; placeholder.hidden = true; onSource?.(`Image : ${images[index].source}`); });
  image.addEventListener('error', next); next(); return wrap;
}
function cardButton(card) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'catalog-card';
  button.setAttribute('aria-label', `Ouvrir ${card.name} · ${card.setCode} ${card.number} · ${card.language}`);
  const title = document.createElement('strong'); title.textContent = card.name;
  const identity = document.createElement('span'); identity.className = 'card-caption'; identity.textContent = `${card.setCode} · ${card.number}`;
  const language = document.createElement('span'); language.className = 'card-language'; language.textContent = card.language; identity.append(language);
  button.append(artwork(card.images, card.name), title, identity);
  button.addEventListener('click', () => openCard(card.id)); return button;
}
function invalidateBrowse() {
  browseGeneration++; browseAbort?.abort(); browseAbort = null; clearTimeout(browseTimer);
  browseCards = []; browsePage = 0; $('browse-grid').replaceChildren(); $('browse-more').hidden = true;
  $('browse-submit').disabled = false;
}
async function loadBrowse(more = false) {
  clearTimeout(browseTimer);
  if (!more) invalidateBrowse();
  const generation = browseGeneration, page = more ? browsePage + 1 : 1;
  const query = $('browse-query').value.trim(), field = $('browse-field').value, language = $('browse-language').value;
  if (query && query.length < (field === 'number' ? 1 : 2)) {
    status('browse-status', 'Entre au moins deux caractères pour un nom ou une extension.'); return;
  }
  const controller = new AbortController(); browseAbort?.abort(); browseAbort = controller;
  $('browse-submit').disabled = true; $('browse-more').disabled = true;
  status('browse-status', more ? 'Chargement des cartes suivantes…' : 'Recherche dans le catalogue…');
  try {
    const result = await json(`/api/catalog?${new URLSearchParams({ scope: 'catalog', language, query, field, page })}`, controller.signal);
    if (generation !== browseGeneration) return;
    const seen = new Set(browseCards.map((card) => card.id));
    const added = result.cards.filter((card) => !seen.has(card.id));
    browseCards = [...browseCards, ...added]; browsePage = page;
    $('browse-grid').append(...added.map(cardButton));
    $('browse-more').hidden = !result.hasMore || result.limitReached;
    status('browse-status', `${browseCards.length} cartes · ${language}`
      + (result.query !== query ? ` · ${query} → ${result.query}` : '')
      + (!browseCards.length ? ' · Aucun résultat. Essaie un nom complet.' : '')
      + (result.limitReached ? '. Limite de pagination atteinte dans cette version.' : ''));
  } catch (error) {
    if (generation === browseGeneration && !controller.signal.aborted) status('browse-status', `${error.message} Utilise Rechercher pour réessayer.`, true);
  } finally {
    if (generation === browseGeneration) { browseAbort = null; $('browse-submit').disabled = false; $('browse-more').disabled = false; }
  }
}
$('browse-form').addEventListener('submit', (event) => { event.preventDefault(); $('browse-query').blur(); loadBrowse(); });
$('browse-more').addEventListener('click', () => loadBrowse(true));
$('browse-query').addEventListener('input', () => { invalidateBrowse(); status('browse-status', 'Recherche…'); browseTimer = setTimeout(() => loadBrowse(), 400); });
for (const id of ['browse-language', 'browse-field']) $(id).addEventListener('change', () => {
  $('browse-query').placeholder = { name: 'Un Pokémon, même en français…', number: '136, 023, TG01…', set: 'Nom de l’extension…' }[$('browse-field').value];
  loadBrowse();
});

function closeDetail() {
  detailGeneration++; detailAbort?.abort(); detailAbort = null; activeCard = null; storageControls();
  priceGeneration++; priceAbort?.abort(); priceAbort = null;
}
$('detail-close').addEventListener('click', () => $('card-dialog').close());
$('card-dialog').addEventListener('close', closeDetail);
$('card-dialog').addEventListener('cancel', closeDetail);
function displayDetail(card) {
  activeCard = card; $('detail-title').textContent = card.name;
  const caption = document.createElement('p'); caption.textContent = card.images.length ? 'Chargement de l’image…' : 'Image indisponible';
  $('detail-art').replaceChildren(artwork(card.images, card.name, (source) => { caption.textContent = source; }), caption);
  $('detail-identity').textContent = `${card.setName} (${card.setCode}) · N° ${card.number} · ${card.language}`;
  $('detail-rarity').textContent = card.rarity;
  const available = [...card.finishes, 'Non précisée'];
  $('add-finish').replaceChildren(...available.map((finish) => { const option = document.createElement('option'); option.value = finish; option.textContent = finish; return option; }));
  // Start unspecified: no holo/reverse inferred from metadata or image.
  $('add-finish').value = 'Non précisée'; $('add-condition').value = 'NM';
  $('add-quantity').value = '1'; $('add-price').value = ''; $('add-verified').checked = false;
  $('purchase-options').open = false;
  $('detail-to-collection').hidden = true; $('detail-content').hidden = false;
  status('detail-status', 'Vérifie l’impression avant l’ajout.'); storageControls();
  quotes = card.quotes || []; renderPrices();
  if (!Object.hasOwn(card, 'quotes')) status('market-status', 'Prix en attente de lecture à la source. Actualiser, ou mettre à jour le serveur de test.');
}
function renderPrices() {
  const finish = $('add-finish').value;
  const matching = quotes.filter((quote) => finish === 'Non précisée' || quote.finish === finish
    || (quote.finish === 'Brillante' && ['Holo', 'Reverse'].includes(finish)));
  $('market-warning').hidden = !quotes.length;
  $('market-quotes').replaceChildren(...matching.map((quote) => {
    const row = document.createElement('article'); row.className = 'market-quote';
    const title = document.createElement('h4'); title.textContent = `${quote.provider} · ${quote.label}`;
    const value = (amount) => typeof amount === 'number' && Number.isFinite(amount) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: quote.currency }).format(amount) : '—';
    const main = document.createElement('strong'); main.textContent = value(quote.trend);
    const metric = document.createElement('span'); metric.textContent = quote.provider === 'Cardmarket' ? 'Tendance' : 'Market price';
    const extra = document.createElement('p'); extra.className = 'fine';
    extra.textContent = `Plus bas : ${value(quote.low)}` + (quote.high !== null ? ` · Plus haut : ${value(quote.high)}` : '')
      + (quote.average30 !== null ? ` · Moy. 30 j : ${value(quote.average30)}` : '');
    const provenance = document.createElement('p'); provenance.className = 'fine';
    const timestamp = quote.updatedAt ? Date.parse(quote.updatedAt) : NaN;
    const age = Date.now() - timestamp;
    provenance.textContent = `Via ${quote.via} · ${Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('fr-FR') : 'date source inconnue'}`
      + (age > 7 * 86400000 ? ' · données anciennes' : age < -300000 ? ' · date source incohérente' : '') + ` · ${quote.currency}`;
    const scope = document.createElement('p'); scope.className = 'fine'; scope.textContent = quote.scope;
    row.append(title, main, metric, extra, provenance, scope); return row;
  }));
  status('market-status', matching.length ? `${matching.length} repère(s) · pas de correction selon l’état sélectionné`
    : activeCard?.language === 'JP' ? 'Pas de source tarifaire japonaise qualifiée intégrée pour cette impression.'
    : quotes.length ? 'Aucun prix fourni pour cette finition.' : 'Prix non renseignés par la source pour cette carte.');
  $('market-refresh').disabled = !activeCard || Boolean(priceAbort);
}
async function refreshPrices() {
  if (!activeCard) return;
  priceAbort?.abort(); const controller = new AbortController(); priceAbort = controller;
  const generation = ++priceGeneration, id = activeCard.id;
  $('market-refresh').disabled = true; status('market-status', 'Lecture des prix à la source…');
  try {
    const card = await json(`/api/card?${new URLSearchParams({ id })}`, controller.signal);
    if (generation !== priceGeneration || activeCard?.id !== id) return;
    quotes = card.quotes || []; renderPrices();
  } catch (error) {
    if (generation === priceGeneration && !controller.signal.aborted) {
      quotes = []; $('market-quotes').replaceChildren(); $('market-warning').hidden = true;
      status('market-status', `Prix indisponibles : ${error.message}`, true);
    }
  } finally { if (generation === priceGeneration) { priceAbort = null; $('market-refresh').disabled = false; } }
}
$('market-refresh').addEventListener('click', refreshPrices);
$('add-finish').addEventListener('change', renderPrices);
$('add-condition').addEventListener('change', renderPrices);
async function openCard(id, snapshot) {
  closeDetail(); const generation = detailGeneration;
  $('detail-content').hidden = true; $('detail-title').textContent = 'Chargement de la fiche…';
  status('detail-status', snapshot ? 'Fiche sauvegardée dans ta collection.' : 'Lecture de la fiche TCGdex…');
  if (!$('card-dialog').open) $('card-dialog').showModal();
  document.dispatchEvent(new CustomEvent('tracktcg:navigate', { detail: 'detail' }));
  if (snapshot) { displayDetail(snapshot); status('detail-status', 'Dans ta collection · fiche locale'); void refreshPrices(); return; }
  const controller = new AbortController(); detailAbort = controller;
  try {
    const card = await json(`/api/card?${new URLSearchParams({ id })}`, controller.signal);
    if (generation !== detailGeneration) return;
    displayDetail(card);
  } catch (error) {
    if (generation === detailGeneration && !controller.signal.aborted) status('detail-status', `${error.message} Ferme la fiche et réessaie.`, true);
  } finally { if (generation === detailGeneration) detailAbort = null; }
}
document.addEventListener('tracktcg:open-card', (event) => openCard(event.detail.id));
$('detail-to-collection').addEventListener('click', () => { $('card-dialog').close(); navigate('collection'); });

function renderCollection() {
  const totals = collectionTotals(entries);
  $('total-cards').textContent = String(totals.cards); $('nav-count').textContent = String(totals.cards);
  $('nav-count').dataset.empty = String(!totals.cards);
  $('total-cost').textContent = totals.cards && totals.withoutCost < totals.cards ? euro(totals.costCents) : '—';
  $('total-note').textContent = `Repères de marché dans les fiches · pas encore de valorisation totale${totals.withoutCost ? ` · ${totals.withoutCost} sans coût d’achat` : ''}`;
  const visible = entries.filter((entry) => matchesCollection(entry, $('collection-query').value));
  $('collection-list').replaceChildren(...visible.map((entry) => {
    const row = document.createElement('article'); row.className = 'collection-row';
    const show = document.createElement('button'); show.type = 'button'; show.className = 'collection-card-open';
    show.setAttribute('aria-label', `Voir la fiche de ${entry.card.name} · ${entry.card.language} · ${entry.card.number} · ${entry.quantity} exemplaire(s)`);
    const title = document.createElement('strong'); title.textContent = entry.card.name;
    const identity = document.createElement('span'); identity.className = 'card-caption'; identity.textContent = `${entry.card.setCode} · ${entry.card.number}`;
    const language = document.createElement('span'); language.className = 'card-language'; language.textContent = entry.card.language; identity.append(language);
    const art = artwork(entry.card.images, entry.card.name);
    const quantity = document.createElement('span'); quantity.className = 'quantity-badge'; quantity.textContent = `×${entry.quantity}`;
    art.append(quantity); show.append(art, title, identity);
    show.addEventListener('click', () => openCard(entry.card.id, entry.card));
    const summary = document.createElement('div'); summary.className = 'lot-summary';
    const state = document.createElement('p'); state.textContent = `${entry.finish} · ${entry.condition}`;
    const options = document.createElement('details'); options.className = 'lot-options';
    const trigger = document.createElement('summary'); trigger.setAttribute('aria-label', `Options pour ${entry.card.name} · ${entry.card.number}`); trigger.append(icon('more'));
    const menu = document.createElement('div'); menu.className = 'lot-menu';
    const cost = document.createElement('p'); cost.textContent = `Achat/u : ${entry.purchasePriceCents === null ? 'non renseigné' : euro(entry.purchasePriceCents)}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Retirer 1'; remove.disabled = !storeReady || saving;
    remove.addEventListener('click', async () => {
      if (!storeReady || saving || !confirm(`Retirer un exemplaire de ${entry.card.name} (${entry.card.language}, ${entry.finish}) ? Exporte une sauvegarde si tu veux pouvoir le restaurer.`)) return;
      try { await mutate((current) => removeOne(current, entry.id), 'Un exemplaire retiré.'); }
      catch { /* failure is already reported; the transaction preserved data */ }
    });
    menu.append(cost, remove); options.append(trigger, menu); summary.append(state, options); row.append(show, summary); return row;
  }));
  $('collection-empty').hidden = !storeReady || Boolean(entries.length);
  storageControls();
}
$('collection-query').addEventListener('input', () => {
  renderCollection();
  if (storeReady) status('collection-status', entries.some((entry) => matchesCollection(entry, $('collection-query').value)) || !entries.length
    ? `${entries.length} lot(s) sauvegardé(s) dans ce navigateur.` : 'Aucune carte ne correspond à ce filtre.');
  if (storeReady && entries.length && !entries.some((entry) => matchesCollection(entry, $('collection-query').value))) $('collection-status').classList.add('notice');
});
async function refreshCollection() {
  if (saving) return;
  const generation = ++collectionGeneration;
  try {
    const loaded = await store.load(); if (generation !== collectionGeneration || saving) return;
    entries = loaded; storeReady = true; status('collection-status', `${entries.length} lot(s) sauvegardé(s) dans ce navigateur.`); renderCollection();
  } catch (error) {
    if (generation !== collectionGeneration) return;
    storeReady = false; status('collection-status', error.message, true); renderCollection();
  }
}
async function mutate(operation, message) {
  if (!storeReady || saving) return false;
  saving = true; collectionGeneration++; storageControls();
  try {
    entries = await store.update(operation); notice('collection-status', message); renderCollection(); return true;
  } catch (error) { status('collection-status', error.message, true); throw error; }
  finally { saving = false; storageControls(); renderCollection(); }
}
$('add-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!activeCard || !storeReady || saving || !$('add-form').reportValidity()) return;
  const generation = detailGeneration;
  try {
    const input = { card: activeCard, quantity: Number($('add-quantity').value), finish: $('add-finish').value,
      condition: $('add-condition').value, purchasePriceCents: parsePurchasePrice($('add-price').value) };
    status('detail-status', 'Sauvegarde en cours…');
    await mutate((current) => addEntries(current, input), 'Collection mise à jour.');
    if (generation !== detailGeneration) return;
    notice('detail-status', `${input.quantity} exemplaire(s) ajouté(s).`);
    $('detail-to-collection').hidden = false; $('add-verified').checked = false;
  } catch (error) { if (generation === detailGeneration) status('detail-status', error.message, true); }
});

$('export-backup').addEventListener('click', () => {
  if (!storeReady || saving) return;
  try {
    const url = URL.createObjectURL(new Blob([encodeBackup(entries)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `tracktcg-collection-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    status('backup-status', 'Export demandé. Vérifie le fichier dans Fichiers/Téléchargements.');
  } catch (error) { status('backup-status', error.message, true); }
});
$('backup-file').addEventListener('change', async () => {
  pendingImport = null; $('import-preview').hidden = true; storageControls();
  const file = $('backup-file').files[0]; $('backup-file').value = ''; if (!file) return;
  $('backup-dialog').close();
  try {
    if (!storeReady || saving) throw new Error('Attends que la collection locale soit disponible.');
    if (file.size > MAX_BYTES) throw new Error('Fichier trop volumineux : maximum 2 Mio.');
    const imported = decodeBackup(await file.text());
    const ids = new Set(entries.map((entry) => entry.id));
    const fresh = imported.filter((entry) => !ids.has(entry.id));
    pendingImport = imported;
    $('import-summary').textContent = `${file.name} · ${fresh.length} nouveau(x) lot(s), ${imported.length - fresh.length} déjà présent(s) et ignoré(s). Aucun remplacement de ta collection.`;
    $('import-preview').hidden = false; storageControls(); $('import-confirm').disabled = !fresh.length;
    $('import-preview').scrollIntoView({ block: 'center', behavior: 'instant' });
  } catch (error) { status('collection-status', error.message, true); }
});
$('import-cancel').addEventListener('click', () => { pendingImport = null; $('import-preview').hidden = true; storageControls(); });
$('import-confirm').addEventListener('click', async () => {
  if (!pendingImport || saving || !storeReady) return;
  const imported = pendingImport;
  try {
    await mutate((current) => mergeBackup(current, imported), 'Sauvegarde importée. Les lots existants ont été conservés.');
    pendingImport = null; $('import-preview').hidden = true; storageControls();
  } catch { /* status already reports the failed, rolled-back save */ }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && screen === 'collection') refreshCollection(); });
window.addEventListener('pagehide', () => { browseAbort?.abort(); detailAbort?.abort(); priceAbort?.abort(); clearTimeout(browseTimer); });
refreshCollection(); loadBrowse();
