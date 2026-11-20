/* =====================================================================
   Collection Jeux Vidéo – Fazerbleu   (V10 = version 1.0)
   Application 100 % navigateur (HTML + CSS + JavaScript vanilla).
   Les données de départ sont dans data.js (INITIAL_DATA).
   Tes modifications sont enregistrées dans le navigateur (IndexedDB, avec repli sur localStorage).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Données & sauvegarde ---------- */
  const KEY = 'fazerbleu-collection-v1';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const APP_VERSION = '1.1.0';
  let READONLY = false, HIDE_PRICE = false, ONLY = null; /* lien de partage : lecture seule, prix masqués ou non */

  /* V8 : les données vivent dans IndexedDB (des centaines de Mo) et non plus dans localStorage (~5 Mo).
     Si IndexedDB est indisponible, on retombe automatiquement sur localStorage. */
  const IDB_NAME = 'fazerbleu-db', IDB_STORE = 'kv';
  let idb = null, useIdb = false, migratedFromLS = false;
  const idbOpen = () => new Promise((ok, ko) => {
    try {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); r.onblocked = () => ko(new Error('blocked'));
    } catch (e) { ko(e); }
  });
  const idbGet = (k) => new Promise((ok, ko) => { const q = idb.transaction(IDB_STORE).objectStore(IDB_STORE).get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
  const idbSet = (k, v) => new Promise((ok, ko) => { const tx = idb.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(v, k); tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error); });
  function readLegacy() {
    try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d && d.version === 1) return d; } } catch (e) { /* ignore */ }
    return null;
  }
  async function loadAsync() {
    try {
      idb = await Promise.race([idbOpen(), new Promise((ok, ko) => setTimeout(() => ko(new Error('timeout')), 4000))]);
      const d = await idbGet(KEY);
      if (d && d.version === 1) { useIdb = true; return migrate(d); }
      const old = readLegacy();
      if (old) { /* première ouverture en V8 : on copie l'ancien stockage, on vérifie, et on le garde tant que tu ne l'as pas supprimé */
        await idbSet(KEY, old);
        const back = await idbGet(KEY);
        if (!back || JSON.stringify(back).length !== JSON.stringify(old).length) throw new Error('copie incomplète');
        useIdb = true; migratedFromLS = true; return migrate(old);
      }
      useIdb = true; return clone(INITIAL_DATA);
    } catch (e) {
      useIdb = false; const old = readLegacy();
      return old ? migrate(old) : clone(INITIAL_DATA);
    }
  }

  /* Mise à jour d'anciennes données enregistrées : on ajoute les nouvelles consoles,
     logos, jaquettes et photos SANS toucher à tes modifications. */
  function migrate(d) {
    if ((d.rev || 1) >= INITIAL_DATA.rev) return d;
    const order = INITIAL_DATA.consoles.map((c) => c.id);
    INITIAL_DATA.consoles.forEach((ic) => {
      const c = d.consoles.find((x) => x.id === ic.id);
      if (!c) { d.consoles.push(clone(ic)); return; }
      c.logo = ic.logo; c.logoBg = ic.logoBg;
      c.games.forEach((g) => {
        if (g.image || !g.nom) return;
        const m = ic.games.find((x) => x.nom === g.nom);
        if (m && m.image) g.image = m.image;
      });
      (c.machines || []).forEach((m) => {
        const im = ic.machines.find((x) => x.nom === m.nom); if (!im) return;
        if ((!m.image || /^images\//.test(m.image)) && im.image) m.image = im.image;
        if (m.valeur === undefined && im.valeur !== undefined) m.valeur = im.valeur;
      });
    });
    d.consoles.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
    d.rev = INITIAL_DATA.rev;
    return d;
  }

  const BASE_ETATS = ['Neuf', 'Parfait Etat', 'Très Bon Etat', 'Bon Etat', 'Mauvais Etat', 'Très Mauvais Etat', 'Abimé', 'Boite Cassée', 'Oui', 'Non', 'Notice en Ligne', 'Démat'];

  /* Infos de base sur les consoles : type (salon / portable) et année de sortie (premier lancement) */
  const CONSOLE_META = {
    mastersystem: { type: 'salon', annee: 1985 }, megadrive: { type: 'salon', annee: 1988 }, megacd: { type: 'salon', annee: 1991 }, saturn: { type: 'salon', annee: 1994 },
    dreamcast: { type: 'salon', annee: 1998 }, gamegear: { type: 'portable', annee: 1990 }, segapico: { type: 'salon', annee: 1993 }, n64: { type: 'salon', annee: 1996 }, ps4: { type: 'salon', annee: 2013 },
  };
  const KNOWN = [ /* du plus précis au plus général */
    ['switch 2', 2025, 'portable'], ['switch', 2017, 'portable'], ['wii u', 2012, 'salon'], ['wii', 2006, 'salon'], ['gamecube', 2001, 'salon'], ['super nintendo', 1990, 'salon'], ['snes', 1990, 'salon'],
    ['nes', 1983, 'salon'], ['3ds', 2011, 'portable'], ['game boy advance', 2001, 'portable'], ['gba', 2001, 'portable'], ['game boy color', 1998, 'portable'], ['game boy', 1989, 'portable'], ['ds', 2004, 'portable'],
    ['ps vita', 2011, 'portable'], ['vita', 2011, 'portable'], ['psp', 2004, 'portable'], ['playstation 5', 2020, 'salon'], ['ps5', 2020, 'salon'], ['playstation 4', 2013, 'salon'], ['ps4', 2013, 'salon'],
    ['playstation 3', 2006, 'salon'], ['ps3', 2006, 'salon'], ['playstation 2', 2000, 'salon'], ['ps2', 2000, 'salon'], ['playstation', 1994, 'salon'], ['ps1', 1994, 'salon'],
    ['xbox series', 2020, 'salon'], ['xbox one', 2013, 'salon'], ['xbox 360', 2005, 'salon'], ['xbox', 2001, 'salon'], ['dreamcast', 1998, 'salon'], ['saturn', 1994, 'salon'],
    ['mega drive', 1988, 'salon'], ['master system', 1985, 'salon'], ['game gear', 1990, 'portable'], ['neo geo', 1990, 'salon'], ['lynx', 1989, 'portable'],
  ];
  function guessMeta(nom) {
    const n = String(nom || '').toLowerCase();
    const k = KNOWN.find((x) => new RegExp('(^|[^a-z0-9])' + x[0].replace(/ /g, '\\s*') + '([^a-z0-9]|$)').test(n));
    return k ? { annee: k[1], type: k[2] } : { annee: '', type: 'salon' };
  }

  /* Met les données au format de la V3 (idempotent : sans danger si déjà fait) */
  function normalize(d) {
    const o = d.options || (d.options = {});
    const add = (k, vals) => {
      o[k] = o[k] || [];
      vals.forEach((v) => { if (v && o[k].indexOf(v) < 0) o[k].push(v); });
    };
    add('etats', BASE_ETATS); add('licences', []); add('versions', []);
    add('marques', ['Nintendo', 'SEGA', 'PlayStation', 'Xbox', 'Autres']); add('supports', ['Cartouche', 'CD', 'DVD', 'Blu-ray', 'Carte', 'Disquette']);
    d.consoles.forEach((c) => { add('marques', [c.marque]); add('supports', [c.support]); });
    d.consoles.forEach((c) => {
      c.machines = c.machines || [];
      c.machines.forEach((m) => { if (!m.id) m.id = uid(); });
      c.games.forEach((g) => {
        if (!g.id) g.id = uid();
        if (g.special === undefined) { g.editionNote = g.edition || ''; g.special = !!g.edition; }
        delete g.edition;
        if (g.platine === undefined) {
          g.platine = /tout termin/i.test(g.desc100 || '') || g.cent === '100%';
          if (g.cent && g.cent !== '100%') g.desc100 = g.cent + (g.desc100 ? ' · ' + g.desc100 : '');
        }
        delete g.cent;
        add('etats', [g.support, g.boite, g.notice, g.qualite]);
        add('licences', [g.licence]); add('versions', [g.version]);
      });
    });
    Object.values(d.wishlists).forEach((l) => l.forEach((w) => { if (!w.id) w.id = uid(); }));
    d.commandes.forEach((x) => { if (!x.id) x.id = uid(); });
    d.presets = d.presets || []; d.lastBackup = d.lastBackup || 0; d.modified = d.modified || 0;
    d.orderMode = d.orderMode || 'auto'; if (d.logoStyle !== 'white' && d.logoStyle !== 'black' && d.logoStyle !== 'mono') d.logoStyle = 'white';
    const DEFAULT_WISH = { general: 'Générale', sonic: 'Sonic Full FR', zelda: 'Zelda' };
    d.wishNames = d.wishNames || {};
    Object.keys(d.wishlists).forEach((k) => { if (!d.wishNames[k]) d.wishNames[k] = DEFAULT_WISH[k] || 'Ma liste'; });
    if (!d.brandOrder) d.brandOrder = [...new Set(d.consoles.map((c) => c.marque))];
    d.consoles.forEach((c) => {
      const m = CONSOLE_META[c.id] || guessMeta(c.nom);
      if (c.logoBgMode !== 'white' && c.logoBgMode !== 'black' && c.logoBgMode !== 'mono') c.logoBgMode = (c.logoTone === 'black' || c.id === 'saturn') ? 'black' : '';
      { const BC = { Nintendo: '#e4372c', SEGA: '#7d8494', PlayStation: '#2f7bff', Xbox: '#2faa3f' }; if (BC[c.marque]) c.couleur = BC[c.marque]; }
      if (c.logoBgAuto === undefined) c.logoBgAuto = !!(c.logoTone || c.id === 'saturn'); /* fond choisi automatiquement : le mode Monochrome peut le remplacer */
      if (!c.type) c.type = m.type;
      if (c.annee === undefined || c.annee === null || c.annee === '') c.annee = m.annee || '';
    });
  }
  let DB = clone(INITIAL_DATA);
  normalize(DB);

  let lastSer = null, pend = false; /* lastSer sert à dater la dernière vraie modification */
  function persist() {
    if (READONLY) return;
    if (!useIdb) {
      try { localStorage.setItem(KEY, JSON.stringify(DB)); }
      catch (e) { toast('Sauvegarde automatique impossible (stockage plein ?) : exporte un fichier JSON.'); }
      return;
    }
    if (pend) return; pend = true;
    Promise.resolve().then(() => { pend = false; idbSet(KEY, DB).catch(() => toast('Sauvegarde automatique impossible : exporte un fichier JSON.')); });
  }
  /* Historique des prix : chaque estimation est gardée avec sa date, à partir de l'activation */
  function trackPrices() {
    if (!DB.histOn || READONLY) return;
    const now = Date.now(); let tot = 0;
    DB.consoles.forEach((c) => c.games.forEach((g) => {
      const p = g.prixEstime; if (p == null || p === '' || isNaN(p)) return;
      tot += Number(p) * (Number(g.quantite) || 1);
      const h = g.hist || (g.hist = []);
      if (!h.length || h[h.length - 1][1] !== Number(p)) h.push([now, Number(p)]);
    }));
    const vh = DB.valHist || (DB.valHist = []), last = vh[vh.length - 1], r = Math.round(tot);
    if (!last || last[1] !== r) { if (last && vh.length > 1 && now - last[0] < 3600000) { last[0] = now; last[1] = r; } else vh.push([now, r]); }
    if (vh.length > 600) vh.splice(1, vh.length - 600);
  }
  function save() {
    trackPrices();
    const body = JSON.stringify(Object.assign({}, DB, { modified: 0, lastBackup: 0 }));
    if (body !== lastSer) { if (lastSer !== null) DB.modified = Date.now(); lastSer = body; }
    persist();
  }

  /* ---------- 2. Petits outils ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('fr-FR') + ' €');
  const parseEuro = (t) => {
    const m = /^\s*([\d\s]+(?:[,.]\d+)?)\s*€/.exec(t || '');
    return m ? parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) : null;
  };
  const parseRange = (t) => {
    if (!t || t.indexOf('€') < 0) return [null, null];
    const n = (t.match(/\d+(?:[,.]\d+)?/g) || []).map((x) => parseFloat(x.replace(',', '.'))).filter((x) => x < 5000);
    return n.length ? [n[0], n.length > 1 ? n[1] : n[0]] : [null, null];
  };
  let toastTimer, UNDO = null;
  function toast(msg, withUndo) {
    const t = $('#toast'); t.textContent = msg;
    if (withUndo && UNDO) { const b = document.createElement('button'); b.className = 'toastbtn'; b.dataset.act = 'undo'; b.textContent = 'Annuler'; t.appendChild(b); }
    t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), withUndo ? 9000 : 3200);
  }
  /* Annuler : on garde une copie de la collection juste avant une suppression ou une opération groupée */
  function snap(label) { try { UNDO = { label, json: JSON.stringify(DB), at: Date.now() }; } catch (e) { UNDO = null; } }
  function undo() {
    if (!UNDO) { toast('Rien à annuler'); return; }
    try {
      const d = JSON.parse(UNDO.json); UNDO = null;
      DB = d; normalize(DB); lastSer = null; save(); DB.modified = Date.now(); persist();
      S.sel = new Set(); renderNav(); router(); toast('Action annulée ✔');
    } catch (e) { toast('Annulation impossible'); }
  }
  const undoBar = () => (!READONLY && UNDO && Date.now() - UNDO.at < 1800000) ? '<div class="backupbar"><span>↶ Dernière action : <b>' + esc(UNDO.label) + '</b></span><span class="btns"><button class="btn small" data-act="undo">Annuler</button></span></div>' : '';

  /* Couleur d'un état (Neuf, Parfait, Très bon, Bon, Mauvais…) */
  function etatKey(v) {
    if (!v) return 'none';
    if (/^neuf/i.test(v)) return 'neuf';
    if (/^parfait/i.test(v) || /^oui/i.test(v)) return 'parfait';
    if (/^très bon|^tres bon/i.test(v)) return 'tbon';
    if (/^bon/i.test(v)) return 'bon';
    if (/très mauvais|cass|^non/i.test(v)) return 'bad';
    if (/mauvais|abim/i.test(v)) return 'mauvais';
    if (/démat|en ligne/i.test(v)) return 'info';
    return 'autre';
  }
  const pill = (v) => v ? '<span class="pill e-' + etatKey(v) + '">' + esc(v) + '</span>' : '<span class="muted">—</span>';
  const fdate = (t) => (t ? new Date(t).toLocaleDateString('fr-FR') : '');
  const isStale = (g) => !g.prixDate || Date.now() - g.prixDate > 15552000000; /* 6 mois */
  const ago = (t) => { if (!t) return 'jamais'; const d = Math.floor((Date.now() - t) / 86400000); return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : 'il y a ' + d + ' jours'; };
  const isCollector = (v) => !!v && !/^non/i.test(String(v).trim());

  function logoHtml(c, big) {
    return c.logo
      ? '<span class="logo' + (big ? ' big' : '') + monoCls(c) + '" style="background:' + logoBg(c) + ';--bc:' + brandColor(c.marque) + '"><img src="' + esc(c.logo) + '" alt=""></span>'
      : '<span class="logo ph' + (big ? ' big' : '') + '">🎮</span>';
  }
  const cover = (g, cls) => g.image ? '<img class="cv ' + cls + '" src="' + esc(g.image) + '" alt="">' : '<span class="cv ph ' + cls + '">🎮</span>';
  const thumbs = (x) => '<div class="thumbs">' + (x.image ? '<img class="cv sm" src="' + esc(x.image) + '" alt="">' : '') + (x.imageEdition ? '<img class="cv sm gold" src="' + esc(x.imageEdition) + '" alt="">' : '') + (!x.image && !x.imageEdition ? '<span class="cv ph sm">🎮</span>' : '') + '</div>';
  /* La zone de jaquette prend la forme de l'image (portrait, carré, paysage…) */
  const adaptCover = (img) => { const p = img.closest('.gcover,.tcover'); if (p && img.naturalHeight) p.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(3)); };
  const adaptAll = () => document.querySelectorAll('.gcover img,.tcover img').forEach((i) => { if (i.complete) adaptCover(i); });
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') adaptCover(e.target); }, true);
  const zoomImg = (src, cls) => '<img class="' + cls + ' zoomable" data-act="zoom" data-src="' + esc(src) + '" src="' + esc(src) + '" alt="">';

  /* Statut d'un jeu : calculé à partir de la boîte et de la notice */
  function statut(g) {
    if (g.support === 'Démat') return 'Démat';
    if (g.boite === 'Non') return 'Loose';
    if (g.notice === 'Non') return 'Notice manquante';
    return 'Complet';
  }
  function counters(c) {
    const r = { physiques: 0, complets: 0, loose: 0, notices: 0, demat: 0, total: 0, valeur: 0, depense: 0, platine: 0, speciales: 0, gamekeys: 0 };
    c.games.forEach((g) => {
      const q = Number(g.quantite) || 1;
      r.total += q;
      r.valeur += (Number(g.prixEstime) || 0) * q;
      r.depense += Number(g.prixAchat) || 0;
      if (g.platine) r.platine += 1;
      if (g.special) r.speciales += 1;
      if (g.gamekey) r.gamekeys += q;
      if (g.support === 'Démat') { r.demat += q; return; }
      r.physiques += q;
      if (g.boite === 'Non') r.loose += q;
      if (g.notice === 'Non') r.notices += q;
      if (g.boite !== 'Non' && g.notice !== 'Non') r.complets += q;
    });
    return r;
  }
  const rowClass = (g) => (g.special ? ' is-special' : '') + (g.platine ? ' is-platine' : '');

  /* ---------- 3. État de l'interface ---------- */
  const S = { print: { what: 'collection', compact: true }, mode: 'table', wishMode: 'table', filters: {}, sort: {}, tab: {}, fold: {}, dom: {}, sel: new Set(), selRoute: '', curKeys: [], bulkField: 'boite', all: { q: '', cons: '', licence: '', statut: '', flag: '', sort: 'nom', tab: 'jeux', lq: '' }, allLimit: 200 };
  const BRAND_COLORS = { Nintendo: '#e4372c', SEGA: '#7d8494', PlayStation: '#2f7bff', Xbox: '#2faa3f' };
  const brandColor = (b) => BRAND_COLORS[b] || '#8e6bd8';
  const brandList = () => {
    const all = [...new Set(DB.consoles.map((c) => c.marque))], o = DB.brandOrder || [];
    return o.filter((b) => all.indexOf(b) >= 0).concat(all.filter((b) => o.indexOf(b) < 0));
  };
  /* Consoles d'une marque : auto = salon puis portables, chacun par année ; manuel = ton ordre */
  const consolesOf = (b) => {
    const l = DB.consoles.filter((c) => c.marque === b);
    return DB.orderMode === 'manuel' ? l : l.slice().sort((x, y) => (x.type === 'portable') - (y.type === 'portable') || (Number(x.annee) || 9999) - (Number(y.annee) || 9999));
  };
  const orderedConsoles = () => [].concat(...brandList().map(consolesOf));
  const LOGO_BGS = { white: '#ffffff', black: '#0f1117' }; /* le noir = couleur du fond du site */
  const isSwitch2 = (c) => /switch\s*2/i.test(c.nom);
  const isDemat = (g) => g.support === 'Démat';
  /* Logo monochrome : blanc en mode sombre, noir en mode clair (seulement si l'image a un fond transparent) */
  const ALPHA = {};
  const logoMode = (c) => (c.logoBgAuto && DB.logoStyle === 'mono') ? 'mono' : (c.logoBgMode || DB.logoStyle);
  function logoIsMono(c) {
    if (logoMode(c) !== 'mono' || !c.logo) return false;
    const src = c.logo;
    if (ALPHA[src] === undefined) {
      ALPHA[src] = null;
      const img = new Image();
      img.onload = () => {
        let ok = true;
        try {
          const w = Math.min(96, img.naturalWidth || 96), h = Math.max(1, Math.round(w * (img.naturalHeight || 1) / (img.naturalWidth || 1)));
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const x = cv.getContext('2d'); x.drawImage(img, 0, 0, w, h);
          const p = x.getImageData(0, 0, w, h).data; let t = 0, sum = 0, sq = 0, n = 0;
          for (let i = 0; i < p.length; i += 4) { if (p[i + 3] < 30) t++; else { const L = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; sum += L; sq += L * L; n++; } }
          if (t / (w * h) > 0.1 && n) { const m = sum / n, sd = Math.sqrt(Math.max(0, sq / n - m * m)); ok = (sd < 38 ? 'f' : 'd') + (m >= 128 ? 'l' : 'd'); } else ok = false;
        } catch (e) { ok = 'd'; }
        ALPHA[src] = ok;
        { clearTimeout(logoIsMono.t); logoIsMono.t = setTimeout(() => { renderNav(); if (route()[0] !== 'game') router(); }, 120); }
      };
      img.onerror = () => { ALPHA[src] = false; };
      img.src = src;
    }
    return ALPHA[src] !== false;
  }
  const monoCls = (c) => logoIsMono(c) ? ' mono ' + ((ALPHA[c.logo] || 'dd')[0] === 'f' ? 'flat' : 'detail') + ((ALPHA[c.logo] || 'dd')[1] === 'l' ? ' lt' : '') : '';
  function logoBg(c) { if (logoIsMono(c)) return 'transparent'; const md = logoMode(c), m = md === 'mono' ? 'white' : md; return LOGO_BGS[m] || LOGO_BGS.white; }
  const tabOf = (c) => S.tab[c.id] || (c.games.some((g) => !isDemat(g)) || !c.games.some(isDemat) ? 'phys' : 'demat');
  const consoleById = (id) => DB.consoles.find((c) => c.id === id);
  const route = () => (location.hash || '#/dashboard').slice(2).split('/');

  /* ---------- 4. Navigation ---------- */
  function renderNav() {
    const [view, id] = route();
    if (ONLY) { $('#sidebar').innerHTML = '<h3>Wishlist</h3><a class="active" href="#/wish/' + ONLY + '"><span>' + esc(wishName(ONLY)) + '</span><small>' + DB.wishlists[ONLY].length + '</small></a>'; return; }
    const a = (href, label, count, active) =>
      '<a href="' + href + '" class="' + (active ? 'active' : '') + '"><span>' + label + '</span>' + (count != null ? '<small>' + count + '</small>' : '') + '</a>';
    let h = '<h3>Tableau de bord</h3>' + a('#/dashboard', '📊 Vue d\'ensemble', null, view === 'dashboard') + a('#/stats', '📈 Statistiques', null, view === 'stats') + a('#/check', '🔎 Brocante', null, view === 'check') + a('#/all', '🗂 Tous les jeux', DB.consoles.reduce((x, c) => x + c.games.length, 0), view === 'all') + (READONLY ? '' : (() => { const n = DB.consoles.reduce((x, c) => x + c.games.filter((g) => !g.nom).length, 0); return n ? a('#/titles', '✏️ Compléter les titres', n, view === 'titles') : ''; })());
    h += '<h3>Ma collection</h3>';
    brandList().forEach((b) => {
      h += '<div class="navbrand">' + esc(b) + '</div>';
      let prevT = null;
      consolesOf(b).forEach((c) => {
      if (c.type === 'portable' && prevT && prevT !== 'portable') h += '<div class="navsub">Portables</div>';
      prevT = c.type;
      h += a('#/console/' + c.id, '<span class="nl">' + logoHtml(c) + '<span>' + esc(c.nom) + '</span></span>', counters(c).total, (view === 'console' || view === 'game') && id === c.id);
      });
    });
    if (!READONLY || Object.keys(DB.wishlists).some((k) => DB.wishlists[k].length)) {
      h += '<h3>Wishlist</h3>';
      Object.keys(DB.wishlists).forEach((k) => {
        if (!READONLY || DB.wishlists[k].length) h += a('#/wish/' + k, esc(wishName(k)), DB.wishlists[k].length, view === 'wish' && id === k);
      });
      if (!READONLY) h += '<button class="navnew" data-act="new-wishlist">Nouvelle wishlist</button>';
    }
    if (!READONLY) {
      h += '<h3>Commandes</h3>' + a('#/orders', '📦 Précommandes & commandes', DB.commandes.length, view === 'orders');
      h += '<h3>Paramètres</h3>' + a('#/settings', '⚙️ Paramètres', unsent() ? '☁️' : null, view === 'settings') + a('#/print', '🖨 Impression', null, view === 'print') + a('#/about', 'ℹ️ À propos', null, view === 'about');
    }
    $('#sidebar').innerHTML = h;
  }

  function router() {
    $('#sidebar').classList.remove('open');
    $('#globalSearch').value = '';
    renderNav();
    const [view, id, gid] = route();
    const app = $('#app');
    if (READONLY && ['settings', 'orders', 'print', 'titles', 'about'].indexOf(view) >= 0) { location.hash = '#/dashboard'; return; }
    if (ONLY && (view !== 'wish' || id !== ONLY)) { location.hash = '#/wish/' + ONLY; return; }
    if (S.selRoute !== location.hash) { S.sel = new Set(); S.selRoute = location.hash; }
    if (view === 'game' && !(consoleById(id) && consoleById(id).games.some((g) => g.id === gid))) { location.hash = consoleById(id) ? '#/console/' + id : '#/dashboard'; return; }
    if (view === 'console' && consoleById(id)) app.innerHTML = consoleView(consoleById(id));
    else if (view === 'wish' && DB.wishlists[id]) app.innerHTML = wishView(id);
    else if (view === 'orders') app.innerHTML = orderView();
    else if (view === 'settings') app.innerHTML = settingsView();
    else if (view === 'stats') app.innerHTML = statsView();
    else if (view === 'print') app.innerHTML = printView();
    else if (view === 'titles') app.innerHTML = titlesView();
    else if (view === 'about') app.innerHTML = aboutView();
    else if (view === 'all') app.innerHTML = allView();
    else if (view === 'check') app.innerHTML = checkView();
    else if (view === 'game') app.innerHTML = vitrineView(id, gid);
    else app.innerHTML = dashboardView();
    if (view === 'console') paintConsole();
    if (view === 'wish') paintWish();
    if (view === 'all') paintAll();
    if (view === 'orders') paintOrders();
    if (view === 'check') { paintCheck(); }
    if (view === 'settings') foldSettings();
    initMarquee();
    window.scrollTo(0, 0);
  }

  /* ---------- 5. Tableau de bord ---------- */
  const stat = (v, l) => (HIDE_PRICE && /valeur|dépensé/i.test(l)) ? '' : '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>';
  const dash = (n, f) => (n ? f(n) : '<span class="muted">—</span>');
  function dashboardView() {
    if (!DB.consoles.length && !READONLY) return welcomeView();
    const all = DB.consoles.map((c) => ({ c, k: counters(c) }));
    const sum = (f) => all.reduce((s, x) => s + f(x.k), 0);
    const missing = DB.consoles.reduce((s, c) => s + c.games.filter((g) => !g.nom).length, 0);
    const recent = [];
    DB.consoles.forEach((c) => c.games.forEach((g) => { if (g.ajoute) recent.push({ c, g }); }));
    recent.sort((a, b) => b.g.ajoute - a.g.ajoute);

    let h = '<h2 class="page">Vue d\'ensemble</h2><p class="sub">' + DB.consoles.length + ' consoles · ' + sum((k) => k.total) + ' jeux</p>';
    if (missing && !READONLY) h += '<div class="notice">⚠️ <b>' + missing + ' jeux n\'ont pas encore de titre.</b> <a class="btn small primary" href="#/titles" style="margin-left:8px">✏️ Compléter les titres</a></div>';
    const dg = READONLY ? [] : dupGroups();
    if (dg.length) h += '<details class="notice dupes"><summary>🔁 <b>' + dg.length + ' doublon' + (dg.length > 1 ? 's' : '') + ' possible' + (dg.length > 1 ? 's' : '') + '</b> (même jeu dans une console, y compris en édition Choix des joueurs, Platinum, Essentials…). Pour deux exemplaires identiques, utilise plutôt la quantité.</summary><ul>' +
      dg.slice(0, 30).map(({ c, l, labels, same }) => '<li><a href="#/console/' + c.id + '">' + esc(c.nom) + '</a> · ' + esc(l[0].nom) + ' : ' + l.length + ' lignes' +
        (same ? ' <button class="btn small" data-act="merge-dup" data-c="' + c.id + '" data-ids="' + l.map((x) => x.id).join(',') + '">Fusionner (quantité ' + l.reduce((a, x) => a + (Number(x.quantite) || 1), 0) + ')</button>' : ' <span class="muted">— éditions différentes : ' + esc(labels.join(' / ')) + '</span>') +
        '<br>' + l.map((x, i) => '<a class="muted" href="#/game/' + c.id + '/' + x.id + '">' + esc(labels[i]) + '</a>').join(' · ') + '</li>').join('') + '</ul></details>';

    /* Rappel de sauvegarde + espace de stockage */
    const bd = DB.lastBackup ? Math.floor((Date.now() - DB.lastBackup) / 86400000) : null, up = usage() / QUOTA * 100;
    if (!READONLY) h += '<div class="backupbar' + (bd === null || bd > 14 ? ' warn' : '') + '"><span>💾 Dernière sauvegarde : <b>' + ago(DB.lastBackup) + '</b>' + (bd === null || bd > 14 ? ' — pense à sauvegarder tes données' : '') + '</span><button class="btn small primary" data-act="export-json">⬇ Sauvegarder maintenant</button></div>';
    h += undoBar() + unsentBar();
    if (!READONLY && up > 75) h += '<div class="notice">⚠️ Le stockage du navigateur est utilisé à <b>' + Math.round(up) + ' %</b>. Va dans <a href="#/settings">Paramètres</a> pour optimiser tes photos.</div>';

    /* Frise des jaquettes qui défile toute seule (pause quand la souris passe dessus) */
    const covers = [];
    DB.consoles.forEach((c) => c.games.forEach((g) => { if (g.image) covers.push({ c, g }); }));
    if (covers.length) {
      const pick = covers.slice().sort(() => Math.random() - 0.5).slice(0, 30);
      const items = pick.map((x) => '<a draggable="false" href="#/console/' + x.c.id + '" data-act="view-game" data-c="' + x.c.id + '" data-id="' + x.g.id + '" title="' + esc(x.g.nom) + '"><img src="' + esc(x.g.image) + '" alt="' + esc(x.g.nom) + '" decoding="async" draggable="false"></a>').join('');
      h += '<div class="marquee"><div class="marquee-track">' + items + items + '</div></div>';
    }

    h += '<div class="grid stats">' +
      stat(sum((k) => k.total), 'jeux (exemplaires)') + stat(sum((k) => k.physiques), 'physiques') + stat(sum((k) => k.demat), 'dématérialisés') +
      stat(sum((k) => k.complets), 'complets') + stat(eur(sum((k) => k.valeur)), 'valeur estimée') + stat(eur(sum((k) => k.depense)), 'dépensé (prix connus)') +
      stat('🏆 ' + sum((k) => k.platine), 'terminés à 100 %') + stat('⭐ ' + sum((k) => k.speciales), 'éditions spéciales') + '</div>';

    /* Consoles : regroupées par marque, logo à la place du titre */
    h += '<h3>Consoles</h3>';
    brandList().forEach((b) => {
      const cs = consolesOf(b).map((c) => all.find((x) => x.c === c));
      h += '<div class="brandhead" style="--c:' + brandColor(b) + '"><span class="dot" style="background:' + brandColor(b) + '"></span><b>' + esc(b) + '</b><small>' + cs.length + ' console' + (cs.length > 1 ? 's' : '') + ' · ' + cs.reduce((n, x) => n + x.k.total, 0) + ' jeux</small></div><div class="grid tiles2">';
      cs.forEach(({ c, k }) => {
        h += '<a class="card tile2" style="--c:' + brandColor(c.marque) + '" href="#/console/' + c.id + '" title="' + esc(c.nom) + '" aria-label="' + esc(c.nom) + '">' +
          '<div class="tlogo' + (c.logo ? monoCls(c) : '') + '" style="background:' + (c.logo ? logoBg(c) : 'var(--panel2)') + '">' + (c.logo ? '<img src="' + esc(c.logo) + '" alt="' + esc(c.nom) + '">' : '<b>' + esc(c.nom) + '</b>') + '</div>' +
          '<div class="tnums"><div><b>' + k.total + '</b><span>jeux</span></div><div><b>' + k.complets + '</b><span>complets</span></div><div><b>' + k.loose + '</b><span>loose</span></div>' + (k.demat ? '<div><b>' + k.demat + '</b><span>démat</span></div>' : '') + '</div>' +
          '<div class="tval"><span>Valeur estimée</span><b>' + eur(k.valeur) + '</b></div></a>';
      });
      h += '</div>';
    });

    /* Tableau par marque, avec total */
    const T = { machines: 0, achat: 0, valeurM: 0, jeux: 0, valeurJ: 0, phys: 0, comp: 0, loose: 0, demat: 0, plat: 0 };
    let rows = '';
    brandList().forEach((b) => {
      const cs = DB.consoles.filter((c) => c.marque === b), ks = cs.map(counters);
      const ms = [].concat(...cs.map((c) => c.machines));
      const r = {
        machines: ms.length, achat: ms.reduce((s, m) => s + (parseEuro(m.achat) || 0), 0), valeurM: ms.reduce((s, m) => s + (Number(m.valeur) || 0), 0),
        jeux: ks.reduce((s, k) => s + k.total, 0), valeurJ: ks.reduce((s, k) => s + k.valeur, 0), phys: ks.reduce((s, k) => s + k.physiques, 0),
        comp: ks.reduce((s, k) => s + k.complets, 0), loose: ks.reduce((s, k) => s + k.loose, 0), demat: ks.reduce((s, k) => s + k.demat, 0), plat: ks.reduce((s, k) => s + k.platine, 0),
      };
      Object.keys(T).forEach((x) => { T[x] += r[x]; });
      rows += '<tr><td><span class="dot" style="background:' + brandColor(b) + '"></span>' + esc(b) + '</td><td>' + r.machines + '</td><td>' + dash(r.achat, eur) + '</td><td>' + dash(r.valeurM, eur) + '</td><td>' + r.jeux + '</td><td>' + dash(r.valeurJ, eur) + '</td><td>' + r.phys + '</td><td>' + r.comp + '</td><td>' + r.loose + '</td><td>' + r.demat + '</td><td>' + r.plat + '</td></tr>';
    });
    h += '<div class="card"><h3>Par marque</h3><div class="tablewrap"><table class="brandtable" style="min-width:0"><thead><tr><th>Marque</th><th>Consoles</th><th>Prix des consoles (achat)</th><th>Valeur des consoles</th><th>Jeux</th><th>Valeur des jeux</th><th>Physiques</th><th>Complets</th><th>Loose</th><th>Démat</th><th>🏆 100 %</th></tr></thead><tbody>' + rows +
      '<tr class="totalrow"><td>Total</td><td>' + T.machines + '</td><td>' + dash(T.achat, eur) + '</td><td>' + dash(T.valeurM, eur) + '</td><td>' + T.jeux + '</td><td>' + dash(T.valeurJ, eur) + '</td><td>' + T.phys + '</td><td>' + T.comp + '</td><td>' + T.loose + '</td><td>' + T.demat + '</td><td>' + T.plat + '</td></tr></tbody></table></div></div>';

    h += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">';
    h += '<div class="card"><h3>Derniers ajouts</h3>' + (recent.length
      ? recent.slice(0, 6).map((r) => '<div>' + esc(r.g.nom || 'Sans titre') + ' <span class="muted">· ' + esc(r.c.nom) + '</span></div>').join('')
      : '<p class="muted">Aucun ajout pour l\'instant. Utilise « + Ajouter un jeu » dans une console.</p>') + '</div>';
    h += '<div class="card"><h3>Commandes en cours</h3>' + (DB.commandes.filter((o) => o.statut !== 'Reçu').slice(0, 6)
      .map((o) => '<div>' + esc(o.nom || 'Article à identifier') + ' <span class="muted">· ' + esc(o.site) + ' · ' + esc(o.date) + '</span></div>').join('') || '<p class="muted">Aucune commande en cours.</p>') + '</div>';
    h += '</div>';
    return h;
  }

  /* ---------- 6. Vue d'une console ---------- */
  function machineCard(c, m) {
    return '<div class="machine"><div class="mphoto">' + (m.image ? zoomImg(m.image, 'mimg') : '<span class="mph">🕹️</span>') + '</div>' +
      '<div class="mtxt"><b>' + esc(m.nom) + '</b>' +
      (m.achat ? '<div>Achat : ' + esc(m.achat) + '</div>' : '') + (m.valeur ? '<div>Valeur estimée : <b>' + eur(m.valeur) + '</b>' + (m.valeurDate ? ' <small class="pdate">maj ' + fdate(m.valeurDate) + '</small>' : '') + '</div>' : '') +
      (m.serie ? '<div>N° de série : ' + esc(m.serie) + '</div>' : '') +
      (m.modele ? '<div>Modèle : ' + esc(m.modele) + '</div>' : '') + (m.note ? '<div>' + esc(m.note) + '</div>' : '') + '</div>' +
      '<div class="mact"><button class="btn small" data-act="edit-machine" data-c="' + c.id + '" data-id="' + m.id + '" title="Modifier">✏️</button> <button class="btn small danger" data-act="del-machine" data-c="' + c.id + '" data-id="' + m.id + '" title="Supprimer">🗑</button></div></div>';
  }

  function consoleView(c) {
    const k = counters(c);
    const F = S.filters[c.id] || (S.filters[c.id] = { q: '', statut: '', licence: '', flag: '' });
    const licences = [...new Set(c.games.map((g) => g.licence).filter(Boolean))].sort();
    const sel = (key, list, cur, all) => '<select data-f="' + key + '"><option value="">' + all + '</option>' + list.map((x) => '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>';

    let h = '<div class="pagehead">' + logoHtml(c, true) + '<h2 class="page" style="color:' + c.couleur + '">' + esc(c.nom) + '</h2>' +
      '<div class="pageactions"><button class="btn small" data-act="edit-console" data-c="' + c.id + '">✏️ Modifier la console</button><button class="btn small danger" data-act="del-console" data-c="' + c.id + '">🗑 Supprimer</button></div></div>';
    h += '<p class="sub">' + esc(c.marque) + ' · support : ' + esc(c.support) + '</p>';
    h += '<div class="grid stats">' + stat(k.total, 'Total') + stat(k.physiques, 'Physiques') + stat(k.complets, 'Complets') + stat(k.loose, 'Loose') +
      stat(k.notices, 'Notices manquantes') + (k.demat ? stat(k.demat, 'Dématérialisés') : '') + stat('🏆 ' + k.platine, 'Terminés à 100 %') + stat('⭐ ' + k.speciales, 'Éditions spéciales') + (isSwitch2(c) && k.gamekeys ? stat('🔑 ' + k.gamekeys, 'Game-Key Cards') : '') + stat(eur(k.valeur), 'Valeur estimée') + '</div>';

    h += '<div class="card"><div class="cardhead"><h3>Matériel (' + c.machines.length + ')</h3><button class="btn small primary" data-act="add-machine" data-c="' + c.id + '">+ Ajouter une console</button></div>' +
      (c.machines.length ? '<div class="machines">' + c.machines.map((m) => machineCard(c, m)).join('') + '</div>' : '<p class="muted" style="margin:0">Aucun matériel pour l\'instant.</p>') + '</div>';

    const tb = tabOf(c);
    h += '<div class="tabs"><button data-act="tab" data-t="phys" class="' + (tb === 'phys' ? 'on' : '') + '">💿 Jeux physiques <span>' + k.physiques + '</span></button><button data-act="tab" data-t="demat" class="' + (tb === 'demat' ? 'on' : '') + '">☁️ Jeux dématérialisés <span>' + k.demat + '</span></button></div>';
    h += '<div class="toolbar"><input data-f="q" type="search" placeholder="Filtrer cette console…" value="' + esc(F.q) + '">' +
      sel('statut', ['Complet', 'Loose', 'Notice manquante', 'Démat'], F.statut, 'Tous statuts') +
      (licences.length ? sel('licence', licences, F.licence, 'Toutes licences') : '') +
      '<select data-f="flag"><option value="">Tous les jeux</option><option value="special"' + (F.flag === 'special' ? ' selected' : '') + '>⭐ Éditions spéciales</option><option value="platine"' + (F.flag === 'platine' ? ' selected' : '') + '>🏆 Terminés à 100 %</option><option value="non"' + (F.flag === 'non' ? ' selected' : '') + '>Pas encore à 100 %</option><option value="old"' + (F.flag === 'old' ? ' selected' : '') + '>⏳ Estimation ancienne</option></select>' +
      '<select id="sortSel" title="Trier les jeux">' + SORTS.map((o) => '<option value="' + o[0] + '"' + (curSort(c) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select><span class="spacer"></span><div class="seg"><button data-act="mode" data-m="table" class="' + (S.mode === 'table' ? 'on' : '') + '">Tableau</button><button data-act="mode" data-m="cards" class="' + (S.mode === 'cards' ? 'on' : '') + '">Cartes</button><button data-act="mode" data-m="wall" class="' + (S.mode === 'wall' ? 'on' : '') + '">Vitrine</button><button data-act="mode" data-m="spine" class="' + (S.mode === 'spine' ? 'on' : '') + '">Tranches</button></div>' +
      '<button class="btn primary" data-act="add-game" data-id="' + c.id + '">+ Ajouter un jeu</button></div>';
    const BUILTIN = [['Tous', {}], ['Loose', { statut: 'Loose' }], ['Notice manquante', { statut: 'Notice manquante' }], ['⭐ Collectors', { flag: 'special' }], ['🏆 Platine', { flag: 'platine' }], ['⏳ Estimations anciennes', { flag: 'old' }]];
    const full = (f) => Object.assign({ q: '', statut: '', licence: '', flag: '' }, f);
    const same = (f) => { const x = full(f); return ['q', 'statut', 'licence', 'flag'].every((k) => (F[k] || '') === x[k]); };
    const curB = BUILTIN.findIndex((p) => same(p[1])), curU = DB.presets.find((p) => same(p.f));
    h += '<div class="toolbar presetbar"><label class="muted" for="presetSel">Filtres rapides</label><select id="presetSel">' +
      (curB < 0 && !curU ? '<option value="" selected>Filtre personnalisé</option>' : '') +
      '<optgroup label="Filtres rapides">' + BUILTIN.map((p, i) => '<option value="b' + i + '"' + (curB === i && !curU ? ' selected' : '') + '>' + p[0] + '</option>').join('') + '</optgroup>' +
      (DB.presets.length ? '<optgroup label="Mes filtres">' + DB.presets.map((p) => '<option value="u' + p.id + '"' + (curU && curU.id === p.id ? ' selected' : '') + '>' + esc(p.nom) + '</option>').join('') + '</optgroup>' : '') +
      '</select><button class="btn small" data-act="save-preset">Enregistrer ce filtre</button>' + (curU ? '<button class="btn small danger" data-act="del-preset" data-pid="' + curU.id + '">Supprimer « ' + esc(curU.nom) + ' »</button>' : '') + '</div>';
    h += '<div id="bulkbar"></div><div id="results"></div>';
    return h;
  }
  const SORTS = [['', 'Tri : ordre de saisie'], ['nom:1', 'Nom A → Z'], ['anneeSortie:1', 'Sortie : plus ancien d\'abord'], ['anneeSortie:-1', 'Sortie : plus récent d\'abord'], ['prixEstime:-1', 'Prix estimé ↓'], ['anneeAchat:-1', 'Achat : plus récent d\'abord']];
  const curSort = (c) => { const o = S.sort[c.id]; return o ? o.key + ':' + o.dir : ''; };
  const BUILTIN_PRESETS = [{}, { statut: 'Loose' }, { statut: 'Notice manquante' }, { flag: 'special' }, { flag: 'platine' }, { flag: 'old' }];

  function filteredGames(c) {
    const F = S.filters[c.id];
    const q = F.q.trim().toLowerCase();
    const tab = tabOf(c);
    let list = c.games.filter((g) => {
      if (isDemat(g) !== (tab === 'demat')) return false;
      if (F.statut && statut(g) !== F.statut) return false;
      if (F.licence && g.licence !== F.licence) return false;
      if (F.flag === 'special' && !g.special) return false;
      if (F.flag === 'platine' && !g.platine) return false;
      if (F.flag === 'non' && g.platine) return false;
      if (F.flag === 'old' && !isStale(g)) return false;
      if (q && !JSON.stringify(g, (key, v) => (key === 'image' || key === 'imageEdition' || key === 'tranche' ? undefined : v)).toLowerCase().includes(q)) return false;
      return true;
    });
    const so = S.sort[c.id];
    if (so) {
      list = list.slice().sort((a, b) => {
        const x = a[so.key], y = b[so.key];
        if (so.key === 'anneeSortie' || so.key === 'anneeAchat') { const nx = parseInt(x, 10), ny = parseInt(y, 10); if (isNaN(nx) && isNaN(ny)) return 0; if (isNaN(nx)) return 1; if (isNaN(ny)) return -1; return so.dir * (nx - ny); }
        const r = (typeof x === 'number' || typeof y === 'number' || typeof x === 'boolean') ? (Number(x) || 0) - (Number(y) || 0) : String(x || '').localeCompare(String(y || ''), 'fr');
        return so.dir * r;
      });
    }
    return list;
  }

  const gameTitle = (g) => g.nom ? esc(g.nom) : '<span class="muted">Titre à renseigner</span>';
  const gameIcons = (g) => (g.lien ? ' <span class="ico" title="Débloqué grâce à un autre jeu">🔗</span>' : '') + (g.special ? ' <span class="ico gold" title="Édition spéciale">⭐</span>' : '') + (g.platine ? ' <span class="ico plat" title="Terminé à 100 %">🏆</span>' : '') + (g.gamekey ? ' <span class="ico key" title="Game-Key Card : la cartouche ne contient que la clé de téléchargement">🔑</span>' : '');

  /* Vue « Tranches » : les jeux vus de dos, rangés sur une étagère. La couleur de chaque tranche vient de la jaquette. */
  const strHash = (t) => { let h = 0; String(t).split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) | 0; }); return Math.abs(h); };
  function spineHtml(c, g) {
    const hh = strHash(g.id + (g.nom || '')), w = 30 + (hh % 9), ht = 196 + ((hh >> 3) % 22);
    if (g.tranche) return '<div class="sp-cell"><a class="spine has-img' + rowClass(g) + '" href="#/game/' + c.id + '/' + g.id + '" title="' + esc(g.nom || 'Sans titre') + '" style="width:' + (28 + hh % 5) + 'px;height:' + ht + 'px;background-image:url(' + esc(g.tranche) + ')"></a></div>';
    return '<div class="sp-cell"><a class="spine' + rowClass(g) + '" href="#/game/' + c.id + '/' + g.id + '" title="' + esc(g.nom || 'Sans titre') + '" data-gid="' + g.id + '" data-src="' + esc(g.image || '') + '" style="width:' + w + 'px;height:' + ht + 'px;--sp:hsl(' + (hh % 360) + ',34%,30%)">' +
      '<span class="sp-top" style="background:' + brandColor(c.marque) + '"></span><span class="sp-title">' + esc(g.nom || 'Sans titre') + '</span><span class="sp-ico">' + (g.platine ? '🏆' : g.special ? '⭐' : '') + '</span></a></div>';
  }
  function domColor(key, src, cb) {
    if (S.dom[key]) return cb(S.dom[key]);
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = cv.height = 24;
        const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 24, 24);
        const px = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, wt = 0;
        for (let i = 0; i < px.length; i += 4) {
          const R = px[i], G = px[i + 1], B = px[i + 2]; if (px[i + 3] < 128) continue;
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0, w = 0.05 + sat * sat * (mx / 255) * 4;
          r += R * w; g += G * w; b += B * w; wt += w;
        }
        if (!wt) return;
        r /= wt; g /= wt; b /= wt;
        const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255; let h = 0, sat = 0, l = (mx + mn) / 2;
        if (mx !== mn) {
          const dd = mx - mn; sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
          if (mx === r / 255) h = ((g - b) / 255 / dd + (g < b ? 6 : 0)); else if (mx === g / 255) h = ((b - r) / 255 / dd + 2); else h = ((r - g) / 255 / dd + 4);
          h *= 60;
        }
        const col = 'hsl(' + Math.round(h) + ',' + Math.round(Math.max(30, Math.min(75, sat * 100))) + '%,' + Math.round(Math.max(22, Math.min(42, l * 100))) + '%)';
        S.dom[key] = col; cb(col);
      } catch (e) { /* image locale (file://) : on garde la couleur par défaut */ }
    };
    img.src = src;
  }
  function paintSpines() {
    document.querySelectorAll('.spine[data-src]').forEach((el) => { const src = el.dataset.src; if (src) domColor(el.dataset.gid, src, (col) => el.style.setProperty('--sp', col)); });
  }

  function paintConsole() {
    const c = consoleById(route()[1]); if (!c) return;
    const list = filteredGames(c), dm = tabOf(c) === 'demat';
    const q = list.reduce((s, g) => s + (Number(g.quantite) || 1), 0);
    const v = list.reduce((s, g) => s + (Number(g.prixEstime) || 0) * (Number(g.quantite) || 1), 0);
    let h = '<p class="muted">' + list.length + ' lignes · ' + q + ' exemplaires' + (HIDE_PRICE ? '' : ' · valeur estimée ' + eur(v)) + '</p>';
    if (!list.length) { $('#results').innerHTML = h + '<div class="card">Aucun jeu ne correspond.</div>'; S.curKeys = []; paintBulk(); return; }

    if (S.mode === 'spine') {
      h += '<div class="shelf">' + list.map((g) => spineHtml(c, g)).join('') + '</div>';
    } else if (S.mode === 'wall') {
      h += '<div class="wall">' + list.map((g) => '<a class="vit' + rowClass(g) + '" href="#/game/' + c.id + '/' + g.id + '" title="' + esc(g.nom || '') + '">' +
        (g.image ? '<img src="' + esc(g.image) + '" alt="' + esc(g.nom) + '">' : '<span class="vph">' + (g.nom ? esc(g.nom) : '🎮') + '</span>') +
        '<span class="vcap"><b>' + esc(g.nom || 'Sans titre') + '</b>' + (HIDE_PRICE ? '' : '<small>' + eur(g.prixEstime) + '</small>') + '</span></a>').join('') + '</div>';
    } else if (S.mode === 'cards') {
      h += '<div class="grid cards">' + list.map((g) =>
        '<div class="game' + rowClass(g) + '" data-act="view-game" data-c="' + c.id + '" data-id="' + g.id + '">' +
        '<div class="gcover">' + cover(g, 'card') + '</div><div class="gbody"><h4>' + gameTitle(g) + gameIcons(g) + '</h4>' +
        '<div class="row">' + pill(statut(g)) + pill(g.qualite) + (g.version ? '<span class="pill">' + esc(g.version) + '</span>' : '') + (g.gamekey ? '<span class="pill e-info">🔑 Game-Key Card</span>' : '') + '</div>' +
        '<p>' + esc([g.licence, g.anneeSortie].filter(Boolean).join(' · ')) + '</p>' +
        (g.special && g.editionNote ? '<p class="goldtxt">⭐ ' + esc(g.editionNote) + '</p>' : '') +
        (g.notes ? '<p>' + esc(g.notes.slice(0, 90)) + (g.notes.length > 90 ? '…' : '') + '</p>' : '') +
        '<div class="gfoot"><span class="price' + (g.prixEstime == null ? ' none' : '') + '" title="' + (g.prixDate ? 'Estimation du ' + fdate(g.prixDate) : "Date de l'estimation non renseignée") + '">' + eur(g.prixEstime) + '</span></div></div></div>').join('') + '</div>';
    } else {
      const th = (k, l) => '<th data-act="sort" data-k="' + k + '">' + l + (S.sort[c.id] && S.sort[c.id].key === k ? (S.sort[c.id].dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
      h += '<div class="tablewrap"><table><thead><tr>' + (READONLY ? '' : '<th class="chk"><input type="checkbox" data-selall title="Tout sélectionner"></th>') + th('nom', 'Jeu') + (dm ? '' : th('support', c.support) + th('boite', 'Boîte') + th('notice', 'Notice') + th('qualite', 'Qualité')) +
        th('quantite', 'Qté') + th('prixEstime', 'Estimé') + th('achat', 'Prix d\'achat - Magasin') + th('version', 'Version') + th('anneeSortie', 'Sortie') + th('anneeAchat', 'Achat') +
        th('test', 'Test') + th('desc100', '100 %') + '<th>Notes</th><th></th></tr></thead><tbody>';
      list.forEach((g) => {
        h += '<tr class="' + rowClass(g).trim() + '" data-act="view-game" data-c="' + c.id + '" data-id="' + g.id + '" style="cursor:pointer">' + (READONLY ? '' : '<td class="chk"><input type="checkbox" data-sel="' + c.id + '|' + g.id + '"' + (S.sel.has(c.id + '|' + g.id) ? ' checked' : '') + '></td>') + '<td><div class="tcell">' + cover(g, 'sm') +
          '<span class="title">' + gameTitle(g) + gameIcons(g) + '</span>' + (g.verifier ? ' <span class="pill e-mauvais">à vérifier</span>' : '') + '</div></td>' +
          (dm ? '' : '<td>' + pill(g.support) + '</td><td>' + pill(g.boite) + '</td><td>' + pill(g.notice) + '</td><td>' + pill(g.qualite) + '</td>') + '<td class="n">' + g.quantite + '</td><td class="n">' + eur(g.prixEstime) + (g.prixDate ? '<small class="pdate' + (isStale(g) ? ' old' : '') + '">' + (isStale(g) ? '⏳ ' : '') + fdate(g.prixDate) + '</small>' : '') + '</td>' +
          '<td>' + esc(g.achat) + '</td><td>' + esc(g.version) + '</td><td class="n">' + esc(g.anneeSortie) + '</td><td class="n">' + esc(g.anneeAchat) + '</td><td>' + esc(g.test) + '</td>' +
          '<td>' + esc(g.desc100) + '</td><td>' + esc((g.notes || '').slice(0, 70)) + ((g.notes || '').length > 70 ? '…' : '') + '</td>' +
          '<td class="actions"><button class="btn small" data-act="edit-game" data-c="' + c.id + '" data-id="' + g.id + '">✏️</button> <button class="btn small danger" data-act="del-game" data-c="' + c.id + '" data-id="' + g.id + '">🗑</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    $('#results').innerHTML = h;
    S.curKeys = list.map((g) => c.id + '|' + g.id); paintBulk();
    if (S.mode === 'spine') paintSpines();
  }

  /* ---------- 7. Wishlists ---------- */
  const wishName = (k) => (DB.wishNames && DB.wishNames[k]) || k;
  function wishView(key) {
    const l = DB.wishlists[key];
    const mn = l.reduce((s, w) => s + (w.prixMin || 0) * (w.quantite || 1), 0), mx = l.reduce((s, w) => s + (w.prixMax || 0) * (w.quantite || 1), 0);
    return '<div class="pagehead"><h2 class="page">Wishlist ' + esc(wishName(key)) + '</h2><div class="pageactions"><button class="btn small" data-act="wshare" data-k="' + key + '">🔗 Partager cette liste</button><button class="btn small" data-act="rename-wishlist" data-k="' + key + '">✏️ Renommer</button><button class="btn small danger" data-act="del-wishlist" data-k="' + key + '">🗑 Supprimer la liste</button></div></div><p class="sub">' + l.length + ' jeux à acheter' + (HIDE_PRICE ? '' : ' · budget estimé ' + eur(mn) + ' à ' + eur(mx) + ' (lignes sans prix chiffré ignorées)') + '</p>' +
      '<div class="toolbar"><input id="wishQ" type="search" placeholder="Filtrer…">' +
      '<label class="muted"><input type="checkbox" id="wishPrio"> Prioritaires</label><label class="muted"><input type="checkbox" id="wishCol"> ⭐ Collectors</label><span class="spacer"></span>' +
      '<div class="seg"><button data-act="wmode" data-m="table" class="' + (S.wishMode === 'table' ? 'on' : '') + '">Tableau</button><button data-act="wmode" data-m="cards" class="' + (S.wishMode === 'cards' ? 'on' : '') + '">Cartes</button><button data-act="wmode" data-m="wall" class="' + (S.wishMode === 'wall' ? 'on' : '') + '">Vitrine</button></div>' +
      '<button class="btn primary" data-act="add-wish" data-k="' + key + '">+ Ajouter</button></div><div id="results"></div>';
  }
  function paintWish() {
    const key = route()[1], l = DB.wishlists[key];
    const q = ($('#wishQ') || {}).value ? $('#wishQ').value.toLowerCase() : '';
    const prio = $('#wishPrio') && $('#wishPrio').checked, col = $('#wishCol') && $('#wishCol').checked;
    const list = l.filter((w) => (!q || JSON.stringify(w, (k, v) => (k === 'image' || k === 'imageEdition' || k === 'tranche' ? undefined : v)).toLowerCase().includes(q)) && (!prio || w.priorite) && (!col || isCollector(w.collector)));
    const groupOf = (w) => (w.section ? w.section + ' · ' : '') + (w.groupeLabel || (w.groupe > 0 ? 'Groupe ' + (w.groupe + 1) : ''));
    let h, last = null;
    if (S.wishMode === 'wall') {
      h = '<div class="wall">' + list.map((w) => '<div class="vit' + (isCollector(w.collector) ? ' is-special' : '') + '" data-act="view-wish" data-k="' + key + '" data-id="' + w.id + '" title="' + esc(w.nom || '') + '" style="cursor:pointer">' +
        (w.image ? '<img src="' + esc(w.image) + '" alt="' + esc(w.nom) + '">' : '<span class="vph">' + (w.nom ? esc(w.nom) : '🎁') + '</span>') +
        '<span class="vcap"><b>' + esc(w.nom || 'Jeu à identifier') + '</b>' + (HIDE_PRICE || !w.prix ? '' : '<small>' + esc(w.prix) + '</small>') + '</span></div>').join('') + '</div>';
    } else if (S.wishMode === 'cards') {
      h = '<div class="grid cards">';
      list.forEach((w) => {
        const g = groupOf(w);
        if (g !== last) { last = g; if (g) h += '<div class="cardband">' + esc(g) + '</div>'; }
        h += '<div class="game' + (isCollector(w.collector) ? ' is-special' : '') + '" data-act="view-wish" data-k="' + key + '" data-id="' + w.id + '">' +
          '<div class="gcover">' + (w.image ? '<img class="cv card" src="' + esc(w.image) + '" alt="" loading="lazy">' : '<span class="cv ph card">🎮</span>') + '</div>' +
          '<div class="gbody"><h4>' + (w.nom ? esc(w.nom) : '<span class="muted">Jeu à identifier</span>') + (isCollector(w.collector) ? ' <span class="ico gold">⭐</span>' : '') + '</h4>' +
          '<div class="row">' + (w.priorite ? '<span class="pill e-mauvais">priorité</span>' : '') + (w.version ? '<span class="pill">' + esc(w.version) + '</span>' : '') + (isCollector(w.collector) ? '<span class="pill e-parfait">Collector</span>' : '') + '</div>' +
          '<p>' + esc([w.date, w.description].filter(Boolean).join(' · ')) + '</p>' +
          '<p><b>' + (w.prix ? esc(w.prix) : '—') + '</b>' + (w.quantite > 1 ? ' · ×' + w.quantite : '') + '</p>' +
          (w.imageEdition ? '<p class="goldtxt">⭐ Photo du collector disponible</p>' : '') + '</div></div>';
      });
      h += '</div>';
    } else {
      h = '<div class="tablewrap"><table><thead><tr><th>Jeu</th><th>Collector</th><th>Sortie</th><th>Version</th><th>Description</th><th>Estimation</th><th>Qté</th><th></th></tr></thead><tbody>';
      list.forEach((w) => {
        const g = groupOf(w);
        if (g !== last) { last = g; if (g) h += '<tr class="band"><td colspan="8">' + esc(g) + '</td></tr>'; }
        h += '<tr class="' + (isCollector(w.collector) ? 'is-special' : '') + '" data-act="view-wish" data-k="' + key + '" data-id="' + w.id + '" style="cursor:pointer"><td><div class="tcell">' + thumbs(w) + '<span class="title">' +
          (w.nom ? esc(w.nom) : '<span class="muted">Jeu à identifier</span>') + (isCollector(w.collector) ? ' <span class="ico gold">⭐</span>' : '') + '</span>' + (w.priorite ? ' <span class="pill e-mauvais">priorité</span>' : '') + '</div></td>' +
          '<td>' + pill(w.collector) + '</td><td>' + esc(w.date) + '</td><td>' + esc(w.version) + '</td><td>' + esc(w.description) + '</td><td>' + esc(w.prix) + '</td><td>' + w.quantite + '</td>' +
          '<td class="actions"><button class="btn small" data-act="buy-wish" data-k="' + key + '" data-id="' + w.id + '" title="Acheté ! Ajouter à ma collection">✅</button> <button class="btn small" data-act="edit-wish" data-k="' + key + '" data-id="' + w.id + '">✏️</button> <button class="btn small danger" data-act="del-wish" data-k="' + key + '" data-id="' + w.id + '">🗑</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    $('#results').innerHTML = h;
  }

  /* ---------- 8. Commandes ---------- */
  function orderView() {
    return '<h2 class="page">Précommandes & commandes</h2><p class="sub" id="orderSub"></p>' +
      '<div class="toolbar"><input id="orderQ" type="search" placeholder="Filtrer…"><span class="spacer"></span><button class="btn primary" data-act="add-order">+ Ajouter</button></div><div id="results"></div>';
  }
  function paintOrders() {
    const q = ($('#orderQ') || {}).value ? $('#orderQ').value.toLowerCase() : '';
    const list = DB.commandes.filter((o) => !q || JSON.stringify(o, (k, v) => (k === 'image' || k === 'imageEdition' || k === 'tranche' ? undefined : v)).toLowerCase().includes(q));
    const tot = DB.commandes.reduce((s, o) => s + (parseEuro(o.prix) || 0) * (o.quantite || 1), 0);
    $('#orderSub').textContent = DB.commandes.length + ' commandes · total en euros : ' + eur(tot) + ' (les prix en $ ne sont pas additionnés)';
    let h = '<div class="tablewrap"><table><thead><tr><th>Article</th><th>Statut</th><th>Collector</th><th>Sortie</th><th>Site</th><th>Qté</th><th>Prix</th><th>Prélèvement</th><th>Livraison</th><th></th></tr></thead><tbody>';
    list.forEach((o) => {
      h += '<tr class="' + (isCollector(o.collector) ? 'is-special' : '') + '" data-act="view-order" data-id="' + o.id + '" style="cursor:pointer"><td><div class="tcell">' + thumbs(o) + '<span class="title">' + (o.nom ? esc(o.nom) : '<span class="muted">Titre à renseigner</span>') + (isCollector(o.collector) ? ' <span class="ico gold">⭐</span>' : '') + '</span></div></td><td>' + pill(o.statut === 'Reçu' ? 'Oui' : o.statut) + '</td><td>' + pill(o.collector) + '</td><td>' + esc(o.date) + '</td><td>' + esc(o.site) + '</td><td>' + o.quantite + '</td><td class="n">' + esc(o.prix) + '</td><td>' + esc(o.prelevement) + '</td><td>' + esc(o.livraison) + '</td>' +
        '<td class="actions"><button class="btn small" data-act="edit-order" data-id="' + o.id + '">✏️</button> <button class="btn small danger" data-act="del-order" data-id="' + o.id + '">🗑</button></td></tr>';
    });
    $('#results').innerHTML = h + '</tbody></table></div>';
  }

  /* ---------- 9. Paramètres ---------- */
  function settingsView() {
    return '<h2 class="page">Paramètres</h2><p class="sub">Version ' + APP_VERSION + ' · tes données sont enregistrées dans ce navigateur. Fais régulièrement une sauvegarde JSON.</p>' +
      '<div class="card"><h3>Sauvegarde</h3><p class="muted" style="margin:0 0 10px">Dernière sauvegarde : <b>' + ago(DB.lastBackup) + '</b></p><div class="toolbar" style="margin-top:0"><button class="btn primary" data-act="export-json">⬇ Exporter tout (JSON)</button>' +
      '<label class="btn">⬆ Importer un JSON<input type="file" id="importFile" accept=".json" hidden></label></div></div>' +
      '<div class="card"><h3>Espace de stockage</h3>' + gauge() + legacyBtn() + '<div class="toolbar"><button class="btn" data-act="optimize">🗜 Optimiser mes photos</button></div><p class="muted" style="margin:0">Réduit le poids des photos déjà ajoutées (sans changer leur apparence à l\'écran).</p></div>' +
      '<div class="card"><h3>Prix et estimations</h3><p class="muted" style="margin:0 0 10px">Importe un fichier CSV de prix (par exemple l\'export de ta collection sur PriceCharting) : les estimations des jeux dont le titre correspond sont mises à jour, avec la date du jour.</p>' +
      '<div class="toolbar" style="margin-top:0"><label class="btn">⬆ Importer des prix (CSV)<input type="file" id="priceFile" accept=".csv,.txt" hidden></label>' +
      '<button class="btn" data-act="fresh">Considérer toutes mes estimations comme à jour aujourd\'hui</button><a class="btn" href="https://www.pricecharting.com/" target="_blank" rel="noopener">Ouvrir PriceCharting ↗</a></div></div>' +
      '<div class="card"><h3>Export CSV d\'une console</h3><div class="toolbar">' + DB.consoles.map((c) => '<button class="btn" data-act="export-csv" data-id="' + c.id + '">' + esc(c.nom) + '</button>').join('') + '</div></div>' +
      histCard() + orderCard() +
      syncCard() + shareCard() +
      '<div class="card"><h3>Zone dangereuse</h3><button class="btn danger" data-act="reset">Revenir aux données de départ</button></div>';
  }

  /* ---------- 10. Formulaires ---------- */
  function encodeCanvas(cv) {
    const w = cv.toDataURL('image/webp', 0.8); /* WebP : léger et garde la transparence */
    return w.indexOf('data:image/webp') === 0 ? w : cv.toDataURL('image/png');
  }
  function resizeImage(file, cb, spine) {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, (spine ? 640 : 380) / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      if (spine && img.width > img.height * 1.2) { /* tranche photographiée à l'horizontale : on la redresse */
        cv.width = Math.round(img.height * k); cv.height = Math.round(img.width * k);
        const x = cv.getContext('2d'); x.translate(cv.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0, cv.height, cv.width);
      } else { cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); }
      cb(encodeCanvas(cv));
    };
    img.src = URL.createObjectURL(file);
  }

  /* Types de champs : text, number, textarea, select, check, choice (liste + « + »), image */
  function openForm(title, fields, values, onSubmit) {
    const lists = {};
    let h = '<div class="form-grid">';
    fields.forEach((f, i) => {
      const v = values[f.k] == null ? '' : values[f.k];
      const hidden = (f.showIf && !values[f.showIf]) || (f.hideIf && values[f.hideIf]) ? ' hidden' : '';
      h += '<div class="field' + (f.wide ? ' wide' : '') + (f.type === 'check' ? ' checkfield' : '') + '"' + (f.showIf ? ' data-if="' + f.showIf + '"' : '') + (f.hideIf ? ' data-hideif="' + f.hideIf + '"' : '') + ' style="' + (hidden ? 'display:none' : '') + '">';
      if (f.type === 'check') {
        h += '<label class="chk"><input type="checkbox" name="' + f.k + '"' + (v ? ' checked' : '') + '> ' + esc(f.label) + '</label>';
      } else {
        h += '<label>' + esc(f.label) + '</label>';
        if (f.type === 'image') {
          h += '<input type="hidden" name="' + f.k + '" value="' + esc(v) + '"><div class="imgfield" data-name="' + f.k + '"><img class="cv sm' + (v ? '' : ' hidden') + '" src="' + esc(v) + '" alt="">' +
            '<input type="file" accept="image/*"><button type="button" class="btn small clr">Retirer</button></div>';
        } else if (f.type === 'choice') {
          let opts = (DB.options[f.opt] || []).slice();
          if (v && opts.indexOf(v) < 0) opts.push(v);
          if (f.opt !== 'etats') opts.sort((a, b) => a.localeCompare(b, 'fr'));
          h += '<div class="choicewrap" data-opt="' + f.opt + '"><div class="choice"><select name="' + f.k + '"><option value="">—</option>' +
            opts.map((o) => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' +
            '<button type="button" class="btn small plus" title="Ajouter un choix à la liste">＋</button></div>' +
            '<div class="addbox" style="display:none"><input type="text" placeholder="Nouveau choix…"><button type="button" class="btn small primary ok">Ajouter</button></div></div>';
        } else if (f.type === 'textarea') h += '<textarea name="' + f.k + '">' + esc(v) + '</textarea>';
        else if (f.type === 'select') h += '<select name="' + f.k + '">' + f.opts.map((o, j) => '<option' + (f.names ? ' value="' + esc(o) + '"' : '') + (o === v ? ' selected' : '') + '>' + esc(f.names ? f.names[j] : o) + '</option>').join('') + '</select>';
        else {
          h += '<input name="' + f.k + '" type="' + (f.type || 'text') + '" ' + (f.type === 'number' ? 'step="any" ' : '') + (f.list ? 'list="dl' + i + '" ' : '') + 'value="' + esc(v) + '">';
          if (f.list) lists[i] = f.list;
        }
      }
      h += '</div>';
    });
    h += '</div>';
    Object.keys(lists).forEach((i) => { h += '<datalist id="dl' + i + '">' + lists[i].map((o) => '<option value="' + esc(o) + '">').join('') + '</datalist>'; });
    h += '<div class="form-actions"><button type="button" class="btn" id="cancelForm">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div>';

    $('#modalTitle').textContent = title;
    $('.modal-box').classList.remove('wide');
    const form = $('#modalForm'); form.innerHTML = h;

    /* Cases à cocher qui affichent d'autres champs (ex. édition spéciale) */
    form.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.onchange = () => {
        form.querySelectorAll('[data-if="' + cb.name + '"]').forEach((e) => { e.style.display = cb.checked ? '' : 'none'; });
        form.querySelectorAll('[data-hideif="' + cb.name + '"]').forEach((e) => { e.style.display = cb.checked ? 'none' : ''; });
      };
    });
    /* Photos : image réduite avant enregistrement */
    form.querySelectorAll('.imgfield').forEach((w) => {
      const hid = form.elements[w.dataset.name], prev = w.querySelector('img'), file = w.querySelector('input[type=file]');
      file.onchange = () => { if (file.files[0]) resizeImage(file.files[0], (url) => { hid.value = url; prev.src = url; prev.classList.remove('hidden'); }, w.dataset.name === 'tranche'); };
      w.querySelector('.clr').onclick = () => { hid.value = ''; prev.classList.add('hidden'); file.value = ''; };
    });
    /* Listes déroulantes avec le petit « + » pour ajouter un choix */
    form.querySelectorAll('.choicewrap').forEach((w) => {
      const sel = w.querySelector('select'), box = w.querySelector('.addbox'), inp = box.querySelector('input'), opt = w.dataset.opt;
      const addChoice = () => {
        const val = inp.value.trim(); if (!val) return;
        if (DB.options[opt].indexOf(val) < 0) { DB.options[opt].push(val); save(); }
        if (![...sel.options].some((o) => o.value === val)) { const o = document.createElement('option'); o.textContent = val; sel.appendChild(o); }
        sel.value = val; inp.value = ''; box.style.display = 'none';
      };
      w.querySelector('.plus').onclick = () => { box.style.display = box.style.display === 'none' ? 'flex' : 'none'; if (box.style.display === 'flex') inp.focus(); };
      box.querySelector('.ok').onclick = addChoice;
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addChoice(); } };
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const out = {};
      fields.forEach((f) => {
        const el = form.elements[f.k];
        if (f.type === 'check') out[f.k] = el.checked;
        else if (f.type === 'number') out[f.k] = el.value.trim() === '' ? null : Number(el.value);
        else out[f.k] = el.value.trim();
      });
      closeModal(); onSubmit(out);
    };
    $('#cancelForm').onclick = closeModal;
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { $('#modal').classList.add('hidden'); $('#modalForm').innerHTML = ''; $('.modal-box').classList.remove('wide'); }

  /* Jeu lié : ex. version Switch 2 (gratuite avec Nintendo Switch Online) débloquée grâce à la cartouche Switch 1 */
  function linkField(c) {
    const o = [''], n = ['— Aucun —'];
    DB.consoles.forEach((k) => { if (k.id === c.id) return; k.games.filter((x) => x.nom).slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).forEach((x) => { o.push(k.id + '|' + x.id); n.push(x.nom + ' (' + k.nom + ')'); }); });
    return { k: 'lien', label: '🔗 Débloqué grâce à un autre jeu (ex. cartouche Switch 1 pour une mise à niveau Switch 2) – le jeu passe alors en dématérialisé', type: 'select', opts: o, names: n, wide: true };
  }
  const linkTarget = (g) => { if (!g.lien) return null; const [cid, gid] = g.lien.split('|'), c = consoleById(cid), x = c && c.games.find((y) => y.id === gid); return x ? { c, g: x } : null; };
  function linkedFrom(g) {
    const own = DB.consoles.find((k) => k.games.indexOf(g) >= 0), out = []; if (!own) return out;
    DB.consoles.forEach((k) => k.games.forEach((x) => { if (x.lien === own.id + '|' + g.id) out.push({ c: k, g: x }); }));
    return out;
  }
  function gameFields(c) {
    const f = [
      { k: 'nom', label: 'Nom du jeu', wide: true },
      { k: 'demat', label: '☁️ Jeu dématérialisé (aucun support physique)', type: 'check' },
    ];
    if (isSwitch2(c)) f.push({ k: 'gamekey', label: '🔑 Game-Key Card (la cartouche ne contient que la clé de téléchargement)', type: 'check', hideIf: 'demat' });
    return f.concat([
      { k: 'licence', label: 'Licence / série', type: 'choice', opt: 'licences' },
      { k: 'version', label: 'Version', type: 'choice', opt: 'versions' },
      { k: 'support', label: c.support, type: 'choice', opt: 'etats', hideIf: 'demat' },
      { k: 'boite', label: 'Boîte', type: 'choice', opt: 'etats', hideIf: 'demat' },
      { k: 'notice', label: 'Notice', type: 'choice', opt: 'etats', hideIf: 'demat' },
      { k: 'qualite', label: 'Qualité globale', type: 'choice', opt: 'etats', hideIf: 'demat' },
      linkField(c),
      { k: 'quantite', label: 'Quantité', type: 'number' },
      { k: 'prixEstime', label: 'Prix estimé (€)', type: 'number' },
      { k: 'achat', label: 'Prix d\'achat - Magasin (ex. 25€ - Cash Express)' },
      { k: 'anneeSortie', label: 'Année de sortie' }, { k: 'anneeAchat', label: 'Année d\'achat' },
      { k: 'test', label: 'Test', list: ['Jeu Fonctionnel', 'A tester'] },
      { k: 'desc100', label: 'Objectif / avancement 100 %', list: ['Un jour je le ferais à 100%', 'Pas prévu de 100%'] },
      { k: 'platine', label: '🏆 Terminé à 100 % (platine)', type: 'check' },
      { k: 'special', label: '⭐ Édition spéciale / collector', type: 'check' },
      { k: 'editionNote', label: 'Détail de l\'édition (ex. Steelbook, Day One…)', showIf: 'special', wide: true },
      { k: 'imageEdition', label: 'Photo de l\'édition spéciale / collector', type: 'image', showIf: 'special', wide: true },
      { k: 'notes', label: 'Notes - Histoire', type: 'textarea', wide: true },
      { k: 'image', label: 'Jaquette (photo ou capture, optionnel)', type: 'image', wide: true },
      { k: 'tranche', label: 'Tranche du jeu (photo de la tranche, optionnel – affichée dans la vue Tranches)', type: 'image', wide: true },
    ]);
  }

  function editGame(cid, gid, pre, done) {
    const c = consoleById(cid);
    const isNew = !gid;
    const g = isNew ? Object.assign({ support: c.support === 'CD' ? 'Neuf' : 'Très Bon Etat', quantite: 1 }, pre || {}) : c.games.find((x) => x.id === gid);
    const vals = Object.assign({}, g, { demat: isDemat(g) || !!(pre && pre.demat) });
    openForm(isNew ? 'Ajouter un jeu – ' + c.nom : 'Modifier le jeu', gameFields(c), vals, (v) => {
      if (v.lien) v.demat = true;
      if (v.demat) { v.support = 'Démat'; v.boite = ''; v.notice = ''; v.qualite = ''; v.gamekey = false; }
      else if (v.support === 'Démat') v.support = 'Très Bon Etat';
      delete v.demat;
      v.prixAchat = parseEuro(v.achat);
      if (v.licence && DB.options.licences.indexOf(v.licence) < 0) DB.options.licences.push(v.licence);
      if (v.prixEstime != null && (isNew || Number(v.prixEstime) !== Number(g.prixEstime))) v.prixDate = Date.now();
      if (isNew) { v.id = uid(); v.groupe = 0; v.section = 'Principal'; v.ajoute = Date.now(); c.games.push(v); } else Object.assign(g, v);
      save(); renderNav(); refresh(); toast('Jeu enregistré');
      if (done) done();
    });
  }

  /* Fiche détaillée d'un jeu */
  /* Morceaux de la fiche d'un jeu (partagés entre la fenêtre de détail et la vitrine) */
  const gBadges = (g, st) => '<div class="badges">' + (g.platine ? '<span class="badge plat">🏆 Terminé à 100 %</span>' : '') + (g.special ? '<span class="badge gold">⭐ Édition spéciale</span>' : '') + (g.gamekey ? '<span class="badge e-info">🔑 Game-Key Card</span>' : '') +
    '<span class="badge e-' + etatKey(st === 'Complet' ? 'Parfait' : st === 'Loose' ? 'Non' : st === 'Démat' ? 'Démat' : 'Abimé') + '">' + esc(st) + '</span></div>';
  const gStates = (c, g) => '<div class="etats">' + [[c.support === 'CD' ? '💿' : '🎮', c.support, g.support], ['📦', 'Boîte', g.boite], ['📖', 'Notice', g.notice], ['✨', 'Qualité globale', g.qualite]]
    .map((x) => '<div class="etat e-' + etatKey(x[2]) + '"><i>' + x[0] + '</i><div><span>' + esc(x[1]) + '</span><b>' + esc(x[2] || '—') + '</b></div></div>').join('') + '</div>';
  function gValue(c, g) {
    const stale = g.prixEstime != null && isStale(g);
    return '<div class="dsec"><div class="dsechead"><h4>Valeur et achat</h4><a class="btn small" target="_blank" rel="noopener" href="https://www.pricecharting.com/search-products?type=prices&q=' + encodeURIComponent((g.nom || '') + ' ' + c.nom) + '">🔎 Voir sur PriceCharting</a></div><div class="etats">' +
      (HIDE_PRICE ? '' : '<div class="etat plain big"><i>💰</i><div><span>Prix estimé</span><b>' + eur(g.prixEstime) + '</b><small class="pdate' + (stale ? ' old' : '') + '">' + (g.prixDate ? (stale ? '⏳ ' : '') + 'mis à jour le ' + fdate(g.prixDate) : 'date de mise à jour non renseignée') + '</small></div></div>') +
      (READONLY ? '' : '<div class="etat plain"><i>🛒</i><div><span>Acheté</span><b>' + esc(g.achat || '—') + '</b></div></div>') +
      '<div class="etat plain"><i>🔢</i><div><span>Quantité</span><b>' + esc(g.quantite) + '</b></div></div></div>' + histList(g) + '</div>';
  }
  function gMore(g) {
    let lk = '';
    const tg = linkTarget(g), fr = linkedFrom(g), lnk = (x) => '<a href="#/game/' + x.c.id + '/' + x.g.id + '">' + esc(x.g.nom || 'Sans titre') + ' <span class="muted">(' + esc(x.c.nom) + ')</span></a>';
    if (tg) lk += '<div class="dsec linkbox"><h4>🔗 Débloqué grâce à</h4><p style="margin:0">' + lnk(tg) + '<br><span class="muted">Il faut garder ce jeu (cartouche ou disque) pour accéder à cette version.</span></p></div>';
    if (fr.length) lk += '<div class="dsec linkbox"><h4>🔗 Donne accès à</h4><p style="margin:0">' + fr.map(lnk).join('<br>') + '</p></div>';
    const info = [['Année de sortie', g.anneeSortie], ['Année d\'achat', g.anneeAchat], ['Version', g.version], ['Licence', g.licence], ['Test', g.test], ['Objectif / avancement 100 %', g.desc100]].filter((r) => r[1]);
    let h = lk;
    if (info.length) h += '<div class="dsec"><h4>Informations</h4><dl class="dgrid">' + info.map((r) => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl></div>';
    if (g.special) h += '<div class="dsec goldbox"><h4>⭐ Édition spéciale / collector</h4><div class="dedition">' + (g.imageEdition ? zoomImg(g.imageEdition, 'eimg') : '') + '<p>' + esc(g.editionNote || 'Pas de détail renseigné.') + '</p></div></div>';
    if (g.notes) h += '<div class="dsec"><h4>Notes - Histoire</h4><p class="dnotes">' + esc(g.notes) + '</p></div>';
    return h;
  }

  function viewGame(cid, gid) {
    const c = consoleById(cid), g = c.games.find((x) => x.id === gid); if (!g) return;
    const st = statut(g);
    let h = '<div class="dhero' + rowClass(g) + '"><div class="dcover">' + (g.image ? zoomImg(g.image, 'dimg') : '<span class="cv ph big">🎮</span>') + '</div><div class="dinfo">' + gBadges(g, st) +
      '<h2 class="dtitle">' + gameTitle(g) + '</h2><p class="dsub">' + [c.nom, g.licence, g.version, g.anneeSortie].filter(Boolean).map(esc).join(' · ') + '</p>' +
      '<div class="dsubsec"><h4>État de l\'exemplaire</h4>' + gStates(c, g) + '</div></div></div>' + gValue(c, g) + gMore(g) +
      '<div class="form-actions"><button type="button" class="btn danger" data-act="del-game" data-c="' + cid + '" data-id="' + gid + '">Supprimer</button>' +
      '<a class="btn" href="#/game/' + cid + '/' + gid + '" data-act="open-vitrine">🖼 Vitrine</a>' +
      '<button type="button" class="btn primary" data-act="edit-game" data-c="' + cid + '" data-id="' + gid + '">Modifier</button></div>';
    showModal('', h, true);
  }

  /* ---------- Fiche vitrine : une page par jeu, grande jaquette ---------- */
  function vitrineView(cid, gid) {
    const c = consoleById(cid), n = c.games.length, i = c.games.findIndex((x) => x.id === gid), g = c.games[i];
    const prev = c.games[(i - 1 + n) % n], next = c.games[(i + 1) % n], st = statut(g);
    const link = (x, t, label) => '<a class="btn small" href="#/game/' + cid + '/' + x.id + '" title="' + t + '">' + label + '</a>';
    let h = '<div class="vnav"><a class="btn small" href="#/console/' + cid + '">← ' + esc(c.nom) + '</a><span class="vcount">' + (i + 1) + ' / ' + n + '</span><span class="spacer"></span>' +
      link(prev, 'Précédent (←)', '‹ Précédent') + link(next, 'Suivant (→)', 'Suivant ›') + '<button class="btn small" data-act="edit-game" data-c="' + cid + '" data-id="' + gid + '">✏️ Modifier</button></div>';
    h += '<div class="vstage' + rowClass(g) + '"><div class="vleft"><div class="vcover">' +
      (g.image ? '<img id="vmain" class="zoomable" data-act="zoom" data-src="' + esc(g.image) + '" src="' + esc(g.image) + '" alt="">' : '<span class="vnone">🎮</span>') + '</div>' +
      (g.image && g.imageEdition ? '<div class="vthumbs"><button class="on" data-act="vswap" data-src="' + esc(g.image) + '" title="Jaquette"><img src="' + esc(g.image) + '" alt=""></button><button data-act="vswap" data-src="' + esc(g.imageEdition) + '" title="Édition collector"><img src="' + esc(g.imageEdition) + '" alt=""></button></div>' : '') + '</div>' +
      '<div class="vside">' + gBadges(g, st) + '<h2 class="vtitle">' + gameTitle(g) + '</h2><p class="dsub">' + [c.nom, g.licence, g.version, g.anneeSortie].filter(Boolean).map(esc).join(' · ') + '</p>' +
      '<div class="dsubsec"><h4>État de l\'exemplaire</h4>' + gStates(c, g) + '</div>' + gValue(c, g) + gMore(g) + '</div></div>';
    return h;
  }

  function showModal(title, html, wide) {
    $('#modalTitle').textContent = title;
    $('.modal-box').classList.toggle('wide', !!wide);
    $('#modalForm').onsubmit = (e) => e.preventDefault();
    $('#modalForm').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }

  /* Fiche simple pour wishlist / commandes */
  function viewItem(title, sub, item, rows, editAct, delAct, extra, buyAct) {
    const attrs = ' data-id="' + item.id + '"' + (extra || '');
    let h = '<div class="dhero' + (isCollector(item.collector) ? ' is-special' : '') + '"><div class="dcover">' +
      (item.image ? zoomImg(item.image, 'dimg') : '<span class="cv ph big">🎮</span>') + '</div><div class="dinfo"><h2 class="dtitle">' + title + '</h2><p class="dsub">' + esc(sub) + '</p>' +
      '<dl class="dgrid">' + rows.filter((r) => r[1] !== '' && r[1] != null).map((r) => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl></div></div>';
    if (item.imageEdition) h += '<div class="dsec goldbox"><h4>⭐ Édition collector</h4><div class="dedition">' + zoomImg(item.imageEdition, 'eimg') + '</div></div>';
    h += '<div class="form-actions"><button type="button" class="btn danger" data-act="' + delAct + '"' + attrs + '>Supprimer</button><button type="button" class="btn" data-act="' + editAct + '"' + attrs + '>Modifier</button>' +
      (buyAct ? '<button type="button" class="btn primary" data-act="' + buyAct + '"' + attrs + '>✅ Acheté ! Ajouter à ma collection</button>' : '') + '</div>';
    showModal('', h, true);
  }

  const wishFields = () => [
    { k: 'nom', label: 'Nom du jeu', wide: true }, { k: 'section', label: 'Catégorie (ex. Steelbooks, Console & Accessoires)' }, { k: 'collector', label: 'Édition collector', list: ['Oui', 'Non'] },
    { k: 'date', label: 'Date de sortie' }, { k: 'version', label: 'Version' }, { k: 'description', label: 'Description', wide: true },
    { k: 'prix', label: 'Estimation prix d\'achat (ex. 20 - 30€)' }, { k: 'quantite', label: 'Quantité', type: 'number' }, { k: 'priorite', label: 'Prioritaire ?', type: 'select', opts: ['Non', 'Oui'] },
    { k: 'image', label: 'Photo / jaquette', type: 'image', wide: true }, { k: 'imageEdition', label: 'Photo de l\'édition collector', type: 'image', wide: true },
  ];
  function editWish(key, id) {
    const l = DB.wishlists[key], isNew = !id;
    const w = isNew ? { quantite: 1, section: '', collector: 'Non', groupe: l.length ? l[l.length - 1].groupe : 0, groupeLabel: l.length ? l[l.length - 1].groupeLabel : '' } : l.find((x) => x.id === id);
    openForm(isNew ? 'Ajouter à la wishlist' : 'Modifier', wishFields(), Object.assign({}, w, { priorite: w.priorite ? 'Oui' : 'Non' }), (v) => {
      v.priorite = v.priorite === 'Oui';
      const r = parseRange(v.prix); v.prixMin = r[0]; v.prixMax = r[1];
      if (isNew) { v.id = uid(); v.groupe = w.groupe; v.groupeLabel = w.groupeLabel; l.push(v); } else Object.assign(w, v);
      save(); renderNav(); refresh(); toast('Wishlist mise à jour');
    });
  }
  function editOrder(id) {
    const isNew = !id, o = isNew ? { quantite: 1, statut: 'Précommande', collector: 'Oui' } : DB.commandes.find((x) => x.id === id);
    openForm(isNew ? 'Ajouter une commande' : 'Modifier la commande', [
      { k: 'nom', label: 'Article', wide: true }, { k: 'statut', label: 'Statut', type: 'select', opts: ['Précommande', 'Commandé', 'Expédié', 'Reçu'] }, { k: 'collector', label: 'Collector / édition' },
      { k: 'date', label: 'Date de sortie' }, { k: 'site', label: 'Site' }, { k: 'quantite', label: 'Quantité', type: 'number' }, { k: 'prix', label: 'Prix d\'achat (ex. 99€)' },
      { k: 'prelevement', label: 'Prélèvement', wide: true }, { k: 'livraison', label: 'Livraison', wide: true },
      { k: 'image', label: 'Photo / visuel', type: 'image', wide: true }, { k: 'imageEdition', label: 'Photo de l\'édition collector', type: 'image', wide: true }], o, (v) => {
      if (isNew) { v.id = uid(); DB.commandes.push(v); } else Object.assign(o, v);
      save(); renderNav(); refresh(); toast('Commande enregistrée');
    });
  }

  function editConsole(cid) {
    const c = cid ? consoleById(cid) : null;
    openForm(c ? 'Modifier la console' : 'Nouvelle console', [
      { k: 'nom', label: 'Nom (ex. PlayStation 3)', wide: true },
      { k: 'marque', label: 'Marque', type: 'choice', opt: 'marques' }, { k: 'support', label: 'Support des jeux', type: 'choice', opt: 'supports' },
      { k: 'type', label: 'Type de console', type: 'select', opts: ['salon', 'portable'], names: ['Console de salon', 'Console portable'] },
      { k: 'annee', label: 'Année de sortie (laisse vide : je la devine)', type: 'number' },
      { k: 'logoBgMode', label: 'Fond du logo', type: 'select', opts: ['', 'white', 'black', 'mono'], names: ['Comme le réglage général', 'Blanc', 'Noir (couleur du fond du site)', 'Monochrome (blanc en sombre, noir en clair)'] },
      { k: 'logo', label: 'Logo de la console (optionnel)', type: 'image', wide: true }], c || { support: 'Cartouche', type: 'salon', logoBgMode: '' }, (v) => {
      v.nom = v.nom || 'Nouvelle console'; v.marque = v.marque || 'Autres'; v.support = v.support || 'Cartouche';
      const gm = guessMeta(v.nom);
      if (v.annee === '' || v.annee == null) { v.annee = gm.annee; if (!c) v.type = gm.type; }
      let target;
      if (c) { if (v.logoBgMode !== c.logoBgMode) v.logoBgAuto = false; if (v.logo !== c.logo) c.logoTone = null; if (v.logo !== c.logo) delete ALPHA[c.logo]; Object.assign(c, v); c.couleur = brandColor(c.marque); target = c; }
      else {
        target = { id: 'c' + uid(), nom: v.nom, marque: v.marque, support: v.support, type: v.type, annee: v.annee, logo: v.logo, logoBgMode: v.logoBgMode, couleur: brandColor(v.marque), machines: [], games: [] };
        DB.consoles.push(target); c2 = target;
      }
      if (target.logo && /^data:/.test(target.logo) && !target.logoTone) computeTone(target.logo, (t) => { target.logoTone = t; if (!target.logoBgMode) { target.logoBgMode = t; target.logoBgAuto = true; } save(); renderNav(); refresh(); });
      save(); renderNav(); toast('Console enregistrée');
      if (!c) location.hash = '#/console/' + c2.id; else refresh();
    });
  }
  let c2 = null;

  function editMachine(cid, mid) {
    const c = consoleById(cid), isNew = !mid;
    const m = isNew ? {} : c.machines.find((x) => x.id === mid);
    openForm(isNew ? 'Ajouter une console – ' + c.nom : 'Modifier la console', [
      { k: 'nom', label: 'Nom / modèle (ex. Mega Drive 2)', wide: true }, { k: 'achat', label: 'Provenance / prix d\'achat (ex. 50€ - Cash Express)' }, { k: 'valeur', label: 'Valeur estimée (€)', type: 'number' },
      { k: 'serie', label: 'Numéro de série' }, { k: 'modele', label: 'Référence du modèle' },
      { k: 'note', label: 'Détails (boîte, manettes, jeu inclus…)', type: 'textarea', wide: true },
      { k: 'image', label: 'Photo de la console (PNG sans fond conseillé)', type: 'image', wide: true }], m, (v) => {
      if (v.valeur != null && Number(v.valeur) !== Number(m.valeur)) v.valeurDate = Date.now();
      if (isNew) { v.id = uid(); c.machines.push(v); } else Object.assign(m, v);
      save(); refresh(); toast('Matériel enregistré');
    });
  }

  /* ---------- 9b. Statistiques ---------- */
  function statsView() {
    const rows = [];
    DB.consoles.forEach((c) => c.games.forEach((g) => rows.push({ c, g, q: Number(g.quantite) || 1 })));
    const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
    const hbars = (items, fmt) => {
      const max = Math.max(1, ...items.map((i) => i.v));
      return '<div class="hbars">' + items.map((i) => '<div class="hbar"><span class="hl">' + i.l + '</span><div class="ht"><i style="width:' + Math.max(2, i.v / max * 100) + '%;' + (i.cls ? '' : 'background:' + i.col) + '" class="' + (i.cls || '') + '"></i></div><b>' + (fmt ? fmt(i.v) : i.v) + '</b></div>').join('') + '</div>';
    };
    const brands = brandList().map((b) => { const r = rows.filter((x) => x.c.marque === b); return { l: esc(b), col: brandColor(b), v: sum(r, (x) => x.q), val: sum(r, (x) => (Number(x.g.prixEstime) || 0) * x.q) }; });
    const perConsole = orderedConsoles().map((c) => ({ l: esc(c.nom), col: brandColor(c.marque), v: counters(c).total }));
    const perValue = orderedConsoles().map((c) => ({ l: esc(c.nom), col: brandColor(c.marque), v: counters(c).valeur })).filter((x) => x.v > 0);

    /* Rond : complet / loose / notice manquante / démat */
    const st = { 'Complet': ['#2ecc71', 0], 'Loose': ['#e0503f', 0], 'Notice manquante': ['#f0b43c', 0], 'Démat': ['#5b8cff', 0] };
    rows.forEach((x) => { st[statut(x.g)][1] += x.q; });
    const tot = sum(Object.values(st), (v) => v[1]) || 1;
    let acc = 0;
    const conic = Object.values(st).map((v) => { const a = acc / tot * 100; acc += v[1]; return v[0] + ' ' + a + '% ' + acc / tot * 100 + '%'; }).join(',');
    const donut = '<div class="donutwrap"><div class="donut" style="background:conic-gradient(' + conic + ')"><span>' + tot + '<small>jeux</small></span></div><div class="legend">' +
      Object.entries(st).map(([k, v]) => '<div><i style="background:' + v[0] + '"></i>' + k + ' <b>' + v[1] + '</b> <span class="muted">(' + Math.round(v[1] / tot * 100) + ' %)</span></div>').join('') + '</div></div>';

    /* Qualité globale */
    const ql = {};
    rows.forEach((x) => { const k = x.g.qualite || 'Non renseigné'; ql[k] = (ql[k] || 0) + x.q; });
    const qual = Object.entries(ql).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ l: esc(k), v, cls: 'e-' + etatKey(k === 'Non renseigné' ? '' : k) }));

    /* Années d'achat */
    const yrs = {}; let unknown = 0;
    rows.forEach((x) => { const y = (String(x.g.anneeAchat || '').match(/(19|20)\d\d/) || [])[0]; if (y) yrs[y] = (yrs[y] || 0) + x.q; else unknown += x.q; });
    const ys = Object.keys(yrs).sort(), ymax = Math.max(1, ...ys.map((y) => yrs[y]));
    let cum = 0;
    const cols = ys.map((y) => { cum += yrs[y]; return '<div class="vcol"><b>' + yrs[y] + '</b><div class="vb"><i style="height:' + Math.max(3, yrs[y] / ymax * 100) + '%"></i></div><span>' + y + '</span><small>Σ ' + cum + '</small></div>'; }).join('');

    const top = rows.filter((x) => x.g.prixEstime).sort((a, b) => b.g.prixEstime - a.g.prixEstime).slice(0, 8);
    const card = (t, body) => '<div class="card"><h3>' + t + '</h3>' + body + '</div>';
    return '<h2 class="page">Statistiques</h2><p class="sub">' + sum(rows, (x) => x.q) + ' jeux · ' + DB.consoles.length + ' consoles' + (HIDE_PRICE ? '' : ' · valeur estimée ' + eur(sum(rows, (x) => (Number(x.g.prixEstime) || 0) * x.q))) + '</p>' +
      '<div class="grid statgrid">' +
      card('Jeux par marque', hbars(brands, null) + (HIDE_PRICE ? '' : '<p class="muted" style="margin:10px 0 0">Valeur estimée : ' + brands.map((b) => b.l + ' <b>' + eur(b.val) + '</b>').join(' · ') + '</p>')) +
      card('État de la collection', donut) +
      card('Jeux par console', hbars(perConsole, null)) +
      card('Valeur estimée par console', hbars(perValue, eur)) +
      card('Qualité globale', hbars(qual, null)) +
      (HIDE_PRICE ? '' : card('Les jeux les plus chers', '<ol class="toplist">' + top.map((x) => '<li><span>' + esc(x.g.nom || 'Sans titre') + ' <small class="muted">' + esc(x.c.nom) + '</small></span><b>' + eur(x.g.prixEstime) + '</b></li>').join('') + '</ol>')) +
      '</div>' +
      histChart() + card('Évolution : jeux achetés par année', ys.length ? '<div class="vchart">' + cols + '</div><p class="muted" style="margin:6px 0 0">Σ = total cumulé.' + (unknown ? ' ' + unknown + ' jeux sans année d\'achat ne sont pas comptés.' : '') + '</p>' : '<p class="muted">Renseigne l\'« Année d\'achat » de tes jeux pour voir ce graphique.</p>');
  }

  /* ---------- 9c. Impression (brocante) ---------- */
  function printView() {
    const P = S.print, d = new Date().toLocaleDateString('fr-FR');
    let h = '<div class="noprint"><h2 class="page">Impression</h2><p class="sub">Une liste propre à imprimer ou à enregistrer en PDF (bouton Imprimer, puis « Enregistrer au format PDF »).</p><div class="toolbar">' +
      '<div class="seg"><button data-act="pwhat" data-m="collection" class="' + (P.what === 'collection' ? 'on' : '') + '">Ma collection</button><button data-act="pwhat" data-m="wishlist" class="' + (P.what === 'wishlist' ? 'on' : '') + '">Mes manques (wishlists)</button></div>' +
      (P.what === 'collection' ? '<div class="seg"><button data-act="pcompact" data-m="1" class="' + (P.compact ? 'on' : '') + '">Titres seulement</button><button data-act="pcompact" data-m="0" class="' + (!P.compact ? 'on' : '') + '">Détaillé</button></div>' : '') +
      '<span class="spacer"></span><button class="btn primary" data-act="print">🖨 Imprimer</button></div></div>';
    h += '<div class="printdoc"><h1>' + (P.what === 'collection' ? 'Ma collection' : 'Ma liste de recherche') + ' – Fazerbleu <small>' + d + '</small></h1>';
    if (P.what === 'collection') {
      orderedConsoles().forEach((c) => {
        const gs = c.games.filter((g) => g.nom).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        h += '<h3>' + esc(c.nom) + ' <small>(' + counters(c).total + ')</small></h3>';
        if (P.compact) h += '<ul class="plist">' + gs.map((g) => '<li>' + esc(g.nom) + (g.version && /collector|steelbook/i.test(g.version) ? ' <em>(' + esc(g.version) + ')</em>' : '') + (g.special ? ' ★' : '') + '</li>').join('') + '</ul>';
        else h += '<table class="ptable"><thead><tr><th>Jeu</th><th>Version</th><th>État</th><th>Qualité</th><th>Qté</th></tr></thead><tbody>' + gs.map((g) => '<tr><td>' + esc(g.nom) + (g.special ? ' ★' : '') + '</td><td>' + esc(g.version) + '</td><td>' + esc(statut(g)) + '</td><td>' + esc(g.qualite) + '</td><td>' + (g.quantite || 1) + '</td></tr>').join('') + '</tbody></table>';
      });
    } else {
      Object.keys(DB.wishlists).forEach((k) => {
        const l = DB.wishlists[k].filter((w) => w.nom);
        h += '<h3>Wishlist ' + esc(wishName(k)) + ' <small>(' + l.length + ')</small></h3><ul class="plist wl">' + l.map((w) => '<li>☐ ' + esc(w.nom) + (w.priorite ? ' <b>!</b>' : '') + (w.version ? ' <em>' + esc(w.version) + '</em>' : '') + (w.prix ? ' <span class="pp">' + esc(w.prix) + '</span>' : '') + '</li>').join('') + '</ul>';
      });
    }
    return h + '</div>';
  }

  /* ---------- 9d. Wishlist / commande → collection ---------- */
  function buyItem(kind, key, id) {
    const src = kind === 'wish' ? DB.wishlists[key].find((x) => x.id === id) : DB.commandes.find((x) => x.id === id);
    if (!src) return;
    const col = isCollector(src.collector), yr = (String(src.date || '').match(/(19|20)\d\d/) || [])[0] || '';
    const pre = {
      nom: src.nom || '', version: src.version || '', image: src.image || '', imageEdition: src.imageEdition || '', special: col,
      editionNote: col ? (kind === 'wish' ? (src.description || '') : (/^oui$/i.test(src.collector) ? '' : src.collector)) : '',
      anneeSortie: yr, anneeAchat: String(new Date().getFullYear()), quantite: src.quantite || 1,
      achat: kind === 'order' ? [src.prix, src.site].filter(Boolean).join(' - ') : '',
      prixEstime: kind === 'wish' ? (src.prixMax || src.prixMin || null) : null,
    };
    const hay = [src.nom, src.description, src.version, src.section].join(' ').toLowerCase();
    const guess = (DB.consoles.find((c) => hay.indexOf(c.nom.toLowerCase()) >= 0) || consoleById(route()[1]) || DB.consoles[0]).id;
    openForm('Acheté ! Dans quelle console ranger ce jeu ?', [{ k: 'cid', label: 'Console', type: 'select', opts: DB.consoles.map((c) => c.id), names: DB.consoles.map((c) => c.nom) }], { cid: guess }, (v) => {
      editGame(v.cid, null, pre, () => {
        if (kind === 'wish') DB.wishlists[key] = DB.wishlists[key].filter((x) => x.id !== id); else DB.commandes = DB.commandes.filter((x) => x.id !== id);
        save(); renderNav(); refresh(); toast('Ajouté à ta collection (retiré de la liste)');
      });
    });
  }

  /* ---------- 9e. Photos plus légères & espace de stockage ---------- */
  let QUOTA = 5000000;
  const usage = () => JSON.stringify(DB).length;
  const gauge = () => { const p = Math.min(100, usage() / QUOTA * 100); return '<div class="gauge' + (p > 80 ? ' hot' : '') + '"><i style="width:' + p.toFixed(1) + '%"></i></div><p class="muted" style="margin:6px 0 0">' + Math.round(usage() / 1024).toLocaleString('fr-FR') + (useIdb ? ' Ko utilisés — ton navigateur te laisse des centaines de Mo : aucun souci d\'espace.' : ' Ko utilisés sur environ 5 000 Ko (' + Math.round(p) + ' %)') + '</p>'; };
  const legacyBtn = () => { let has = false; try { has = useIdb && !!localStorage.getItem(KEY); } catch (e) { /* ignore */ } return has ? '<p class="muted" style="margin:10px 0 0">Une ancienne copie de tes données existe encore dans l\'ancien stockage du navigateur (gardée par sécurité après le passage à la V8). Quand tu as vérifié que tout est bien là, tu peux la supprimer.</p><div class="toolbar"><button class="btn small" data-act="del-legacy">Supprimer l\'ancienne copie</button></div>' : ''; };
  function optimizeImages() {
    const items = [], push = (o) => ['image', 'imageEdition', 'logo'].forEach((k) => { if (o[k] && /^data:/.test(o[k])) items.push([o, k]); });
    DB.consoles.forEach((c) => { push(c); c.games.forEach(push); c.machines.forEach(push); });
    Object.values(DB.wishlists).forEach((l) => l.forEach(push)); DB.commandes.forEach(push);
    const before = usage(); let i = 0;
    const next = () => {
      if (i >= items.length) { save(); router(); toast(items.length ? 'Photos optimisées : ' + Math.max(0, Math.round((before - usage()) / 1024)) + ' Ko gagnés' : 'Aucune photo à optimiser'); return; }
      const it = items[i++], img = new Image();
      img.onload = () => {
        const k = Math.min(1, 380 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const u = encodeCanvas(cv); if (u.length < it[0][it[1]].length) it[0][it[1]] = u; next();
      };
      img.onerror = next; img.src = it[0][it[1]];
    };
    toast('Optimisation en cours…'); next();
  }

  /* ---------- 9f. Import de prix (CSV, ex. export PriceCharting) ---------- */
  function parseCsv(t) {
    t = t.replace(/^﻿/, '');
    const first = t.split(/\r?\n/)[0], delim = first.split(';').length > first.split(',').length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(pal|ntsc|fr|eur|\[.*?\])\b/g, '').replace(/[^a-z0-9]/g, '');
  function readPriceFile(file) {
    const r = new FileReader();
    r.onload = () => {
      const rows = parseCsv(String(r.result));
      if (rows.length < 2) { toast('Fichier vide ou illisible'); return; }
      const head = rows[0].map((x) => x.trim()), data = rows.slice(1);
      const find = (re) => (head.find((x) => re.test(x)) || head[0]);
      openForm('Importer des prix', [
        { k: 'cn', label: 'Colonne du NOM du jeu', type: 'select', opts: head, names: head },
        { k: 'cp', label: 'Colonne du PRIX à utiliser', type: 'select', opts: head, names: head },
        { k: 'cc', label: 'Colonne de la CONSOLE (pour éviter les confusions)', type: 'select', opts: [''].concat(head), names: ['(ignorer)'].concat(head) },
        { k: 'rate', label: 'Taux de conversion (ex. 0,92 si les prix sont en $)', type: 'number' },
      ], { cn: find(/product|name|titre|nom|title/i), cp: find(/loose|price|prix|cib/i), cc: head.find((x) => /console/i.test(x)) || '', rate: 1 }, (v) => {
        const ni = head.indexOf(v.cn), pi = head.indexOf(v.cp), ci = v.cc ? head.indexOf(v.cc) : -1, rate = v.rate || 1;
        const map = {};
        data.forEach((row) => {
          const p = parseFloat(String(row[pi] || '').replace(/[^\d.,-]/g, '').replace(',', '.'));
          if (!isNaN(p)) (map[normName(row[ni])] = map[normName(row[ni])] || []).push({ p, con: ci >= 0 ? normName(row[ci]) : '' });
        });
        let n = 0;
        DB.consoles.forEach((c) => c.games.forEach((g) => {
          const hits = (map[normName(g.nom)] || []).filter((x) => !x.con || x.con.indexOf(normName(c.nom)) >= 0 || normName(c.nom).indexOf(x.con) >= 0);
          if (hits.length) { g.prixEstime = Math.round(hits[0].p * rate * 100) / 100; g.prixDate = Date.now(); n++; }
        }));
        save(); router(); toast(n + ' prix mis à jour');
      });
    };
    r.readAsText(file);
  }

  /* ---------- 9g. Brocante : « est-ce que je l'ai déjà ? » ---------- */
  const SYNC_KEY = 'fazerbleu-sync-v1', SYNC_FILE = 'collection-fazerbleu.json';
  const sync = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } };
  const setSync = (o) => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(Object.assign(sync(), o))); } catch (e) { /* ignore */ } };
  const syncInfo = () => { const s = sync(); return s.last ? 'Dernière synchronisation : ' + new Date(s.last).toLocaleString('fr-FR') : 'Jamais synchronisé sur cet appareil'; };
  const plain = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function checkView() {
    const s = sync();
    return '<h2 class="page">Brocante</h2><p class="sub">' + (READONLY ? 'Tape un titre : tu sauras tout de suite si Fazerbleu l\'a déjà (pratique avant d\'offrir un jeu !).' : 'Tape un titre : je te dis si tu l\'as déjà, s\'il est dans tes wishlists ou déjà commandé.') + '</p>' +
      '<input id="checkQ" class="bigsearch" type="search" placeholder="Titre du jeu…" autocomplete="off">' +
      (READONLY ? '' : s.token ? '<p><button class="btn small" data-act="sync-pull">⟳ Récupérer la dernière version (cloud)</button> <span class="muted" id="syncMsg">' + syncInfo() + '</span></p>'
        : '<p class="muted">Astuce : active la synchronisation dans « Paramètres » pour retrouver ta collection à jour sur ce téléphone.</p>') + '<div id="checkRes"></div>';
  }
  function paintCheck() {
    const words = plain($('#checkQ').value).split(/[^a-z0-9]+/).filter(Boolean), out = $('#checkRes');
    if (!words.length) { out.innerHTML = ''; return; }
    const hit = (x) => { const t = plain([x.nom, x.version, x.licence].join(' ')); return x.nom && words.every((w) => t.indexOf(w) >= 0); };
    const mine = [];
    DB.consoles.forEach((c) => c.games.forEach((g) => { if (hit(g)) mine.push({ c, g }); }));
    const wish = [];
    Object.keys(DB.wishlists).forEach((k) => DB.wishlists[k].forEach((w) => { if (hit(w)) wish.push(w); }));
    const orders = DB.commandes.filter(hit);
    const small = (x) => (x.image ? '<img class="cs" src="' + esc(x.image) + '" alt="">' : '<span class="cs ph">🎮</span>');
    let h = '';
    if (mine.length) h += '<h3 class="ck ok">✅ ' + (READONLY ? 'Fazerbleu l\'a déjà' : 'Tu l\'as déjà') + ' (' + mine.length + ')</h3>' + mine.slice(0, 40).map(({ c, g }) =>
      '<a class="ckrow' + rowClass(g) + '" href="#/game/' + c.id + '/' + g.id + '">' + small(g) + '<div><b>' + esc(g.nom) + '</b><div class="muted">' + esc(c.nom) + (g.version ? ' · ' + esc(g.version) : '') + '</div><div class="row">' + pill(statut(g)) + pill(g.qualite) + '<span class="pill">×' + (g.quantite || 1) + '</span></div></div>' + (HIDE_PRICE ? '' : '<b class="ckp">' + eur(g.prixEstime) + '</b>') + '</a>').join('');
    if (wish.length) h += '<h3 class="ck wish">⭐ ' + (READONLY ? 'Dans sa wishlist' : 'Dans tes wishlists') + ' (' + wish.length + ')</h3>' + wish.slice(0, 40).map((w) =>
      '<div class="ckrow">' + small(w) + '<div><b>' + esc(w.nom) + '</b>' + (w.priorite ? ' <span class="pill e-mauvais">priorité</span>' : '') + '<div class="muted">' + esc([w.version, w.description].filter(Boolean).join(' · ')) + '</div></div><b class="ckp">' + esc(w.prix || '') + '</b></div>').join('');
    if (orders.length) h += '<h3 class="ck">📦 Déjà commandé (' + orders.length + ')</h3>' + orders.map((o) => '<div class="ckrow">' + small(o) + '<div><b>' + esc(o.nom) + '</b><div class="muted">' + esc(o.site) + ' · ' + esc(o.statut) + '</div></div></div>').join('');
    if (!mine.length) h = '<div class="ckno">' + (words.join('').length < 3 ? 'Continue à taper…' : (READONLY ? '🆕 Pas dans sa collection' : '🆕 Pas dans ta collection')) + '</div>' + h;
    out.innerHTML = h;
  }

  /* ---------- 9h. Synchronisation PC ↔ téléphone (Gist GitHub privé) ---------- */
  let gistText = null, gistMeta = null;
  const PREV_FILE = 'collection-fazerbleu.precedente.json';
  async function gh(path, opt) {
    const s = sync(); if (!s.token) throw new Error('Colle d\'abord ton jeton GitHub dans Paramètres.');
    const r = await fetch('https://api.github.com' + path, Object.assign({ headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }, opt));
    if (!r.ok) throw new Error(r.status === 401 ? 'Jeton refusé par GitHub (401) : vérifie-le.' : r.status === 404 ? 'Sauvegarde introuvable (404).' : 'Erreur GitHub (' + r.status + ').');
    return r.status === 204 ? null : r.json();
  }
  async function findGist() {
    const s = sync(); if (s.gistId) return s.gistId;
    const list = await gh('/gists?per_page=100');
    const g = list.find((x) => x.files && x.files[SYNC_FILE]);
    if (g) setSync({ gistId: g.id });
    return g ? g.id : null;
  }
  async function readGist(id, file) {
    const g = await gh('/gists/' + id), f = g.files && g.files[file || SYNC_FILE];
    gistMeta = { at: g.updated_at };
    if (!f) throw new Error('Fichier de sauvegarde introuvable dans le cloud.');
    let text = f.content;
    if (f.truncated || text == null) { const r = await fetch(f.raw_url); if (!r.ok) throw new Error('Lecture impossible (' + r.status + ').'); text = await r.text(); }
    gistText = text;
    return JSON.parse(text);
  }
  const syncMsg = (t) => { const m = $('#syncMsg'); if (m) m.textContent = t; };
  function syncSaveToken() { const i = $('#syncToken'); if (i) setSync({ token: i.value.trim() }); }
  async function cloudPush() {
    try {
      syncSaveToken(); syncMsg('Envoi en cours…'); gistText = null;
      const id = await findGist(), body = { description: 'Collection Fazerbleu (sauvegarde privée)', files: {} };
      if (id) {
        const remote = await readGist(id), s = sync();
        const nG = (x) => (x.consoles || []).reduce((n, c) => n + c.games.length, 0);
        if (nG(DB) === 0 && nG(remote) > 0) { syncMsg('Envoi bloqué : cet appareil est vide alors que ton cloud contient ta collection. Utilise « Récupérer depuis le cloud ».'); return; }
        if (remote.modified && remote.modified !== s.lastRemote && !confirm('Le cloud contient des modifications faites depuis un autre appareil. Les écraser avec les données de cet appareil ?')) { syncMsg('Envoi annulé.'); return; }
      }
      body.files[SYNC_FILE] = { content: JSON.stringify(DB) };
      /* on garde au passage la version précédente du cloud (un seul niveau, pour ne pas alourdir l'envoi) */
      if (id && gistText && gistText !== body.files[SYNC_FILE].content) body.files[PREV_FILE] = { content: gistText };
      if (id) { const g = await gh('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) }); if (g && g.updated_at) setSync({ remoteAt: g.updated_at }); }
      else { body.public = false; const g = await gh('/gists', { method: 'POST', body: JSON.stringify(body) }); setSync({ gistId: g.id, remoteAt: g.updated_at }); }
      setSync({ last: Date.now(), lastRemote: DB.modified }); syncMsg(syncInfo()); toast('Collection envoyée dans le cloud'); renderNav(); if (['dashboard', ''].indexOf(route()[0]) >= 0) router();
    } catch (e) { syncMsg(e.message); toast(e.message); }
  }
  async function cloudPull() {
    try {
      syncSaveToken(); syncMsg('Récupération en cours…');
      const id = await findGist(); if (!id) throw new Error('Aucune sauvegarde trouvée : envoie d\'abord depuis ton ordinateur.');
      const d = await readGist(id);
      if (!d.consoles || !d.wishlists) throw new Error('Sauvegarde illisible.');
      if (DB.consoles.some((c) => c.games.length) && !confirm((unsent() ? 'Attention : tu as des modifications non envoyées, elles seront perdues.\n\n' : '') + 'Remplacer les données de cet appareil par celles du cloud (' + d.consoles.reduce((n, c) => n + c.games.length, 0) + ' jeux) ?')) { syncMsg('Récupération annulée.'); return; }
      snap('Récupération depuis le cloud'); DB = migrate(d); normalize(DB); lastSer = null; save(); setSync({ last: Date.now(), lastRemote: DB.modified, remoteAt: gistMeta && gistMeta.at });
      renderNav(); router(); toast('Collection mise à jour depuis le cloud', true);
    } catch (e) { syncMsg(e.message); toast(e.message); }
  }
  async function cloudRestorePrev() {
    try {
      syncSaveToken(); syncMsg('Lecture de la version précédente…');
      const id = await findGist(); if (!id) throw new Error('Aucune sauvegarde trouvée dans le cloud.');
      const d = await readGist(id, PREV_FILE);
      if (!d.consoles || !d.wishlists) throw new Error('Version précédente illisible.');
      const n = d.consoles.reduce((x, c) => x + c.games.length, 0), when = d.modified ? new Date(d.modified).toLocaleString('fr-FR') : 'date inconnue';
      if (!confirm('Remplacer les données de cet appareil par la version précédente du cloud (' + n + ' jeux, modifiée le ' + when + ') ?')) { syncMsg('Restauration annulée.'); return; }
      snap('Restauration de la version précédente'); DB = migrate(d); normalize(DB); lastSer = null; save(); DB.modified = Date.now(); persist();
      renderNav(); router(); toast('Version précédente restaurée. Clique sur « Envoyer » pour la remettre aussi dans le cloud.', true);
    } catch (e) { const m = /introuvable/.test(e.message) ? 'Pas encore de version précédente dans le cloud : elle apparaît à ton prochain envoi.' : e.message; syncMsg(m); toast(m); }
  }
  function weightInfo() {
    let tot = 0, img = 0;
    try { tot = JSON.stringify(DB).length; } catch (e) { return ''; }
    DB.consoles.forEach((c) => c.games.forEach((g) => { img += (g.image ? g.image.length : 0) + (g.imageEdition ? g.imageEdition.length : 0) + (g.tranche ? g.tranche.length : 0); }));
    const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' Mo', big = tot > 20 * 1048576;
    return '<p class="muted" style="margin:8px 0 0">Poids de ta collection : <b>' + mb(tot) + '</b> (dont photos ' + mb(img) + '). Chaque envoi garde aussi la version précédente dans le cloud, donc compte le double.' + (big ? ' <span class="goldtxt">⚠️ Collection lourde : les envois peuvent devenir lents. « Optimiser mes photos » (carte Espace de stockage) réduit ce poids.</span>' : '') + '</p>';
  }
  function syncCard() {
    const s = sync();
    return '<div class="card"><h3>📱 Synchronisation ordinateur ↔ téléphone</h3>' +
      '<p class="muted" style="margin:0 0 10px">Envoie ta collection dans un <b>cloud privé</b> (un « Gist secret » de ton compte GitHub, visible par toi seul), puis récupère-la sur ton téléphone. Le jeton reste uniquement dans ce navigateur. À chaque envoi, la version précédente du cloud est gardée de côté (bouton « Version précédente » si tu t\'es trompé).</p>' +
      '<label class="muted" style="display:block;margin-bottom:6px">Jeton GitHub</label><input type="password" id="syncToken" class="bigsearch" style="max-width:420px" value="' + esc(s.token || '') + '" placeholder="ghp_…" autocomplete="off">' +
      '<div class="toolbar"><button class="btn primary" data-act="sync-push">⬆ Envoyer vers le cloud</button><button class="btn" data-act="sync-pull">⬇ Récupérer depuis le cloud</button><button class="btn" data-act="restore-prev" title="Revenir à la version du cloud d\'avant ton dernier envoi">↩ Version précédente</button></div>' +
      '<p class="muted" id="syncMsg" style="margin:0">' + syncInfo() + '</p>' + weightInfo() +
      '<details class="guide"><summary>Comment créer le jeton (2 minutes)</summary><ol>' +
      '<li>Connecte-toi sur <b>github.com</b> (compte gratuit).</li>' +
      '<li>Ton avatar → <b>Settings</b> → tout en bas <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Tokens (classic)</b> → <b>Generate new token (classic)</b>.</li>' +
      '<li>Nom : « Collection », expiration : « No expiration » (ou ce que tu veux). Coche <b>uniquement « gist »</b>, puis <b>Generate token</b>.</li>' +
      '<li>Copie le jeton (il commence par <code>ghp_</code>) et colle-le ci-dessus, ici puis sur ton téléphone.</li></ol>' +
      '<p class="muted">Les intitulés exacts de GitHub peuvent légèrement changer. Tu peux supprimer le jeton à tout moment depuis GitHub.</p></details>' +
      '<details class="guide"><summary>Mettre l\'application sur mon téléphone (pas à pas)</summary><ol>' +
      '<li><b>Héberger le dossier</b> (une seule fois). Le plus simple : <b>app.netlify.com/drop</b> → crée un compte gratuit → glisse le dossier entier <code>collection-jv</code> dans la page. Tu obtiens une adresse en <code>https://…</code>. (Autre option : GitHub Pages, mais le dépôt doit être public.)</li>' +
      '<li>Ouvre cette adresse sur ton téléphone, puis menu du navigateur → <b>« Ajouter à l\'écran d\'accueil »</b> : l\'application s\'ouvre comme une vraie app.</li>' +
      '<li>Sur l\'ordinateur : Paramètres → <b>Envoyer vers le cloud</b>. Sur le téléphone : Paramètres → colle le jeton → <b>Récupérer depuis le cloud</b>.</li>' +
      '<li>En brocante : ouvre l\'app → <b>🔎 Brocante</b> et tape le titre.</li>' +
      '<li>Quand tu modifies ta collection sur l\'ordinateur : <b>Envoyer</b>, puis <b>Récupérer</b> sur le téléphone. Les données de chaque appareil sont séparées : pense à toujours envoyer avant de récupérer ailleurs.</li></ol>' +
      '<p class="muted">Pour l\'hébergement, utilise le dossier « public » fourni avec l\'application : il ne contient aucune donnée personnelle (tes données restent dans ton navigateur et dans ton cloud privé).</p></details></div>';
  }


  /* ---------- 9h-bis. Rappel d'envoi, accueil, partage en lecture seule ---------- */
  const unsent = () => { if (READONLY) return false; const s = sync(); return !!(s.token && DB.consoles.length && DB.modified > (s.lastRemote || 0)); };
  const unsentBar = () => {
    if (READONLY || !sync().token || !DB.consoles.length) return '';
    const u = unsent();
    return '<div class="backupbar' + (u ? ' warn' : '') + '"><span>' + (u ? '☁️ Tu as des <b>modifications non envoyées</b> vers le cloud.' : '☁️ ' + syncInfo()) + ' <span class="muted" id="syncMsg"></span></span>' +
      '<span class="btns"><button class="btn small" data-act="sync-pull">⟳ Récupérer</button><button class="btn small' + (u ? ' primary' : '') + '" data-act="sync-push">⬆ Envoyer' + (u ? ' maintenant' : '') + '</button></span></div>';
  };
  /* Au lancement (et quand on revient sur l'appli) : le cloud a-t-il une version plus récente ? */
  let lastCloudCheck = 0;
  function showCloudBar() {
    if (document.getElementById('cloudbar')) return;
    document.body.insertAdjacentHTML('beforeend', '<div id="cloudbar" class="updbar cloudbar">☁️ Une version plus récente existe dans le cloud <button class="btn small primary" data-act="cloudbar-pull">Récupérer</button><button class="btn small" data-act="cloudbar-later">Plus tard</button></div>');
  }
  async function checkCloud() {
    if (READONLY || document.hidden || !navigator.onLine) return;
    const s = sync(); if (!s.token || !DB.consoles.length || unsent()) return;
    if (Date.now() - lastCloudCheck < 30000) return; lastCloudCheck = Date.now();
    try {
      const id = await findGist(); if (!id) return;
      const g = await gh('/gists/' + id); if (!g || !g.updated_at) return;
      if (!s.remoteAt) { const r = await readGist(id); if (r.modified && r.modified > (s.lastRemote || 0)) showCloudBar(); else setSync({ remoteAt: g.updated_at }); return; }
      if (g.updated_at !== s.remoteAt) showCloudBar();
    } catch (e) { /* silencieux : pas de réseau, jeton refusé… */ }
  }

  function welcomeView() {
    const s = sync();
    return '<h2 class="page">Bienvenue 👋</h2><p class="sub">Cet appareil ne contient pas encore ta collection.</p>' +
      '<div class="card"><h3>☁️ Récupérer ma collection depuis le cloud</h3><p class="muted" style="margin:0 0 10px">Colle ton jeton GitHub (le même que sur ton ordinateur), puis clique sur « Récupérer ». Pour le créer : Paramètres → Synchronisation → « Comment créer le jeton ».</p>' +
      '<input type="password" id="syncToken" class="bigsearch" style="max-width:420px" value="' + esc(s.token || '') + '" placeholder="ghp_…" autocomplete="off">' +
      '<div class="toolbar"><button class="btn primary" data-act="sync-pull">⬇ Récupérer depuis le cloud</button></div><p class="muted" id="syncMsg" style="margin:0"></p></div>' +
      '<div class="card"><h3>📂 Importer un fichier de sauvegarde</h3><label class="btn">⬆ Importer un JSON<input type="file" id="importFile" accept=".json" hidden></label></div>' +
      '<div class="card"><h3>✨ Commencer une collection vide</h3><div class="toolbar" style="margin-top:0"><button class="btn" data-act="new-console">Créer ma première console</button></div></div>';
  }

  const SHARE_FILE = 'partage-fazerbleu.json';
  const shareOpts = () => Object.assign({ prix: false, wish: false, notes: false }, sync().share || {});
  /* Copie « amis » : ce qui n'est pas choisi n'est PAS dans la copie (pas seulement caché) */
  function shareCopy(o) {
    const d = clone(DB);
    d.commandes = []; d.presets = []; d.lastBackup = 0; delete d.valHist; delete d.histOn; delete d.histStart; d.share = { prix: !!o.prix, wish: !!o.wish, notes: !!o.notes, at: Date.now() };
    Object.keys(d.wishlists).forEach((k) => { if (!o.wish) d.wishlists[k] = []; else d.wishlists[k].forEach((w) => { if (!o.prix) { delete w.prix; delete w.prixMin; delete w.prixMax; } }); });
    d.consoles.forEach((c) => {
      c.machines.forEach((m) => { delete m.achat; delete m.serie; delete m.valeurDate; if (!o.notes) delete m.note; if (!o.prix) delete m.valeur; });
      c.games.forEach((g) => { ['achat', 'prixAchat', 'anneeAchat', 'prixDate', 'hist'].forEach((k) => { delete g[k]; }); if (!o.notes) delete g.notes; if (!o.prix) delete g.prixEstime; });
    });
    return d;
  }
  const shareUrl = () => { const id = sync().shareId; return id ? location.origin + location.pathname + '?lecture=' + id : ''; };
  const shareMsg = (t) => { const m = $('#shareMsg'); if (m) m.textContent = t; };
  function readShareOpts() { const v = (id) => !!($(id) && $(id).checked); return { prix: v('#shPrix'), wish: v('#shWish'), notes: v('#shNotes') }; }
  async function sharePublish() {
    try {
      syncSaveToken(); setSync({ share: readShareOpts() }); shareMsg('Publication en cours…');
      if (!DB.consoles.length) throw new Error('Rien à partager : la collection est vide sur cet appareil.');
      const body = { description: 'Collection Fazerbleu (partage en lecture seule)', files: {} };
      body.files[SHARE_FILE] = { content: JSON.stringify(shareCopy(shareOpts())) };
      const id = sync().shareId;
      if (id) {
        try { await gh('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) }); }
        catch (e) { if (/404/.test(e.message)) { setSync({ shareId: null }); return sharePublish(); } throw e; }
      } else { body.public = false; const g = await gh('/gists', { method: 'POST', body: JSON.stringify(body) }); setSync({ shareId: g.id }); }
      setSync({ sharedAt: Date.now() }); router(); toast('Partage publié : copie le lien pour tes amis');
    } catch (e) { shareMsg(e.message); toast(e.message); }
  }
  async function shareStop() {
    if (!confirm('Arrêter le partage ? Le lien actuel ne fonctionnera plus pour personne.')) return;
    try { const id = sync().shareId; if (id) await gh('/gists/' + id, { method: 'DELETE' }); setSync({ shareId: null, sharedAt: null }); router(); toast('Partage arrêté'); }
    catch (e) { if (/404/.test(e.message)) { setSync({ shareId: null, sharedAt: null }); router(); toast('Partage arrêté'); } else { shareMsg(e.message); toast(e.message); } }
  }
  function shareCopyLink() {
    const u = shareUrl(); if (!u) return;
    const done = () => toast('Lien copié');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, () => { const i = $('#shareLink'); if (i) { i.select(); document.execCommand('copy'); done(); } });
    else { const i = $('#shareLink'); if (i) { i.select(); document.execCommand('copy'); done(); } }
  }
  function shareCard() {
    const s = sync(), o = shareOpts(), u = shareUrl(), web = /^https?:/.test(location.protocol);
    const ck = (id, v, t) => '<label class="muted" style="display:block;margin:4px 0"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '> ' + t + '</label>';
    return '<div class="card"><h3>👥 Partager avec mes amis (lecture seule)</h3>' +
      '<p class="muted" style="margin:0 0 10px">Crée un lien que tes amis ouvrent pour <b>voir</b> ta collection, sans pouvoir rien modifier. Ils voient une <b>copie séparée</b> : ce que tu ne coches pas n\'y est tout simplement pas (jamais les prix d\'achat, magasins, numéros de série ni les commandes). Il faut avoir enregistré ton jeton GitHub (carte ci-dessus).</p>' +
      ck('shPrix', o.prix, 'Montrer les prix estimés') + ck('shWish', o.wish, 'Montrer mes wishlists') + ck('shNotes', o.notes, 'Montrer mes notes (histoire du jeu, remarques sur le matériel)') +
      '<div class="toolbar"><button class="btn primary" data-act="share-publish">' + (u ? '⟳ Mettre à jour le partage' : '🔗 Publier le partage') + '</button>' +
      (u ? '<button class="btn" data-act="share-copy">📋 Copier le lien</button><button class="btn danger" data-act="share-stop">Arrêter le partage</button>' : '') + '</div>' +
      (u ? '<input id="shareLink" class="bigsearch" readonly value="' + esc(u) + '" onclick="this.select()">' + (web ? '' : '<p class="muted">⚠️ Ce lien ne marchera que depuis l\'adresse en ligne du site. Ouvre le site depuis son adresse https://… puis reviens ici pour obtenir le bon lien.</p>') +
        '<p class="muted" style="margin:6px 0 0">Dernière mise à jour du partage : ' + (s.sharedAt ? new Date(s.sharedAt).toLocaleString('fr-FR') : '—') + '. Après des modifications, clique sur « Mettre à jour » pour que tes amis les voient.</p>' : '') +
      '<p class="muted" id="shareMsg" style="margin:6px 0 0"></p>' +
      '<details class="guide"><summary>Comment ça marche, et qui peut voir quoi ?</summary><p class="muted">Le lien contient une adresse longue et aléatoire, impossible à deviner : seules les personnes à qui tu le donnes peuvent l\'ouvrir (comme « toute personne disposant du lien » sur Google Sheets). Elles ne peuvent rien modifier, mais elles peuvent le transmettre. Pour couper l\'accès à tout le monde : « Arrêter le partage » (puis « Publier » pour créer un nouveau lien).</p></details></div>';
  }
  async function fetchShare(id) {
    const r = await fetch('https://api.github.com/gists/' + id, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('Lien indisponible (' + r.status + ').');
    const g = await r.json(), f = g.files && g.files[SHARE_FILE];
    if (!f) throw new Error('Partage introuvable.');
    let text = f.content;
    if (f.truncated || text == null) { const rr = await fetch(f.raw_url); if (!rr.ok) throw new Error('Lecture impossible (' + rr.status + ').'); text = await rr.text(); }
    return JSON.parse(text);
  }
  async function bootShared(id) {
    READONLY = true; document.body.classList.add('ro');
    $('#app').innerHTML = '<p class="muted">Chargement de la collection…</p>';
    try {
      if (!/^[0-9a-f]{16,40}$/i.test(id)) throw new Error('bad');
      const d = await fetchShare(id);
      if (!d.consoles || !d.wishlists) throw new Error('bad');
      DB = d; normalize(DB); HIDE_PRICE = !(d.share && d.share.prix);
      if (HIDE_PRICE) document.body.classList.add('noprice');
      if (d.share && d.share.only && DB.wishlists[d.share.only]) { ONLY = d.share.only; document.body.classList.add('only'); if (!/^#\/wish\//.test(location.hash)) location.hash = '#/wish/' + ONLY; }
      $('#app').insertAdjacentHTML('beforebegin', '<div class="robar">👀 Mode lecture seule — ' + (ONLY ? 'tu consultes la wishlist « ' + esc(wishName(ONLY)) + ' » de Fazerbleu.' : 'tu consultes la collection de Fazerbleu.') + '</div>');
      lastSer = null; router();
    } catch (e) {
      $('#sidebar').innerHTML = '';
      $('#app').innerHTML = '<div class="card"><h3>Lien de partage indisponible</h3><p class="muted">Ce lien n\'est plus valide (le partage a peut-être été arrêté ou mis à jour). Demande un nouveau lien à son propriétaire.</p></div>';
    }
  }
  /* Colonnes de prix retirées du tableau en mode « prix masqués » */
  function stripPriceCols() {
    document.querySelectorAll('#app table').forEach((t) => {
      const hs = [...t.querySelectorAll('thead th')], bad = [];
      hs.forEach((h, i) => { const k = (h.querySelector('[data-k]') || h).dataset.k; if (k === 'prixEstime' || k === 'achat') bad.push(i); });
      if (!bad.length) return;
      t.querySelectorAll('tr').forEach((tr) => { if (tr.children.length !== hs.length) return; bad.slice().reverse().forEach((i) => tr.children[i].remove()); });
    });
  }
  async function boot() {
    const sid = new URLSearchParams(location.search).get('lecture');
    if (sid) { await bootShared(sid); return; }
    DB = await loadAsync(); normalize(DB);
    if (useIdb) QUOTA = 500000000;
    lastSer = null; save();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
    router();
    setTimeout(checkCloud, 900);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkCloud(); });
    if (migratedFromLS) toast('Stockage amélioré : tes données ont été copiées dans un espace bien plus grand ✔');
  }

  /* ---------- 9i. Ordre des consoles + style des logos ---------- */
  function orderCard() {
    const auto = DB.orderMode !== 'manuel';
    const btn = (act, d, t, dis) => '<button class="btn small" data-act="' + act + '" ' + d + (dis ? ' disabled' : '') + ' title="' + t + '">' + (t === 'Monter' ? '▲' : '▼') + '</button>';
    let rows = '';
    const bl = brandList();
    bl.forEach((b, bi) => {
      rows += '<div class="orow obrand"><span class="dot" style="background:' + brandColor(b) + '"></span><b>' + esc(b) + '</b><span class="spacer"></span>' + btn('move-brand', 'data-b="' + esc(b) + '" data-d="-1"', 'Monter', bi === 0) + btn('move-brand', 'data-b="' + esc(b) + '" data-d="1"', 'Descendre', bi === bl.length - 1) + '</div>';
      const cs = consolesOf(b);
      cs.forEach((c, i) => {
        rows += '<div class="orow">' + logoHtml(c) + '<span class="oname">' + esc(c.nom) + '</span><span class="muted">' + (c.type === 'portable' ? 'Portable' : 'Salon') + (c.annee ? ' · ' + c.annee : '') + '</span><span class="spacer"></span>' +
          '<button class="btn small" data-act="edit-console" data-c="' + c.id + '" title="Modifier (type, année…)">✏️</button>' +
          btn('move-console', 'data-c="' + c.id + '" data-d="-1"', 'Monter', auto || i === 0) + btn('move-console', 'data-c="' + c.id + '" data-d="1"', 'Descendre', auto || i === cs.length - 1) + '</div>';
      });
    });
    return '<div class="card"><h3>Ordre des consoles (menu de gauche)</h3>' +
      '<div class="toolbar" style="margin-top:0"><div class="seg"><button data-act="order-mode" data-m="auto" class="' + (auto ? 'on' : '') + '">Automatique</button><button data-act="order-mode" data-m="manuel" class="' + (!auto ? 'on' : '') + '">Manuel</button></div></div>' +
      '<p class="muted" style="margin:0 0 10px">' + (auto ? 'Dans chaque marque : les consoles de salon par date de sortie, puis les portables par date de sortie. Une nouvelle console se place toute seule au bon endroit (renseigne son type et son année).'
        : 'Tu déplaces toi-même chaque console avec les flèches. Une nouvelle console est ajoutée en dernier de sa marque.') + ' Les marques se déplacent dans les deux modes.</p>' +
      '<div class="olist">' + rows + '</div></div>' +
      '<div class="card"><h3>Fond des logos de consoles</h3><div class="toolbar" style="margin-top:0"><div class="seg"><button data-act="logostyle" data-m="white" class="' + (DB.logoStyle === 'white' ? 'on' : '') + '">Blanc</button><button data-act="logostyle" data-m="black" class="' + (DB.logoStyle === 'black' ? 'on' : '') + '">Noir</button><button data-act="logostyle" data-m="mono" class="' + (DB.logoStyle === 'mono' ? 'on' : '') + '">Monochrome</button></div></div>' +
      '<p class="muted" style="margin:0 0 6px">« Monochrome » : les logos passent en blanc sur fond sombre et en noir sur fond clair, sans fond. Les logos en couleur (ex. GameCube) sont convertis en silhouette ; si le résultat ne te plaît pas, choisis un fond Blanc ou Noir pour cette console. Il ne s\'applique qu\'aux logos à fond transparent ; les autres gardent un fond blanc.</p><p class="muted" style="margin:0">Le « noir » est la couleur du fond du site. Si un logo est illisible sur ce fond, choisis le fond de cette console à part (✏️ Modifier la console).</p></div>';
  }
  function moveBrand(b, d) {
    const l = brandList(), i = l.indexOf(b), j = i + d; if (j < 0 || j >= l.length) return;
    l[i] = l[j]; l[j] = b; DB.brandOrder = l; save(); renderNav(); router();
  }
  function moveConsole(id, d) {
    const c = consoleById(id), l = consolesOf(c.marque), i = l.indexOf(c), j = i + d; if (j < 0 || j >= l.length) return;
    const slots = l.map((x) => DB.consoles.indexOf(x)).sort((a, b) => a - b), n = l.slice();
    n[i] = l[j]; n[j] = c;
    n.forEach((x, k) => { DB.consoles[slots[k]] = x; });
    save(); renderNav(); router();
  }
  /* Fond lisible pour un logo importé : clair si le logo est foncé, foncé s'il est clair */
  function computeTone(src, cb) {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, 48, 48);
        const p = ctx.getImageData(0, 0, 48, 48).data; let s = 0, n = 0;
        for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 128) { s += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; n++; }
        cb(n && s / n > 130 ? 'black' : 'white');
      } catch (e) { cb('white'); }
    };
    img.onerror = () => cb('white'); img.src = src;
  }

  /* ---------- 9l. Tous les jeux, complétion par licence, lot ---------- */
  const ETAT_FIELDS = ['support', 'boite', 'notice', 'qualite'];
  const BULK = [['boite', 'Boîte'], ['notice', 'Notice'], ['qualite', 'Qualité globale'], ['support', 'Support (état)'], ['prixEstime', 'Prix estimé (€)'], ['licence', 'Licence / série'], ['platine', 'Terminé à 100 %'], ['special', 'Édition spéciale']];
  const allLicences = () => [...new Set(DB.consoles.reduce((a, c) => a.concat(c.games.map((g) => g.licence).filter(Boolean)), []))].sort((x, y) => x.localeCompare(y, 'fr'));
  function selGames() {
    const out = [];
    S.sel.forEach((k) => { const [cid, gid] = k.split('|'), c = consoleById(cid), g = c && c.games.find((x) => x.id === gid); if (g) out.push({ c, g }); });
    return out;
  }
  function paintBulk() {
    const el = $('#bulkbar'); if (!el) return;
    if (READONLY || !S.sel.size) { el.innerHTML = ''; return; }
    const f = S.bulkField || 'boite';
    let val;
    if (ETAT_FIELDS.indexOf(f) >= 0) val = '<select id="bkVal">' + DB.options.etats.map((x) => '<option>' + esc(x) + '</option>').join('') + '</select>';
    else if (f === 'prixEstime') val = '<input id="bkVal" type="number" step="0.01" min="0" placeholder="Prix en €">';
    else if (f === 'licence') val = '<input id="bkVal" list="bkLic" placeholder="Licence"><datalist id="bkLic">' + allLicences().map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>';
    else val = '<select id="bkVal"><option value="1">Oui</option><option value="">Non</option></select>';
    el.innerHTML = '<div class="bulkbar"><b>' + S.sel.size + ' sélectionné' + (S.sel.size > 1 ? 's' : '') + '</b><span>Changer</span><select id="bkField">' + BULK.map((x) => '<option value="' + x[0] + '"' + (x[0] === f ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select><span>en</span>' + val +
      '<button class="btn primary small" data-act="bulk-apply">Appliquer</button><button class="btn danger small" data-act="bulk-del">Supprimer</button><button class="btn small" data-act="bulk-clear">Désélectionner</button></div>';
  }
  function bulkApply() {
    const f = S.bulkField || 'boite', raw = ($('#bkVal') || {}).value || '', list = selGames(); if (!list.length) return;
    let val = raw;
    if (f === 'prixEstime') { if (raw === '' || isNaN(Number(raw))) { toast('Entre un prix'); return; } val = Number(raw); }
    else if (f === 'platine' || f === 'special') val = !!raw;
    else if (f === 'licence') { val = raw.trim(); if (!val) { toast('Entre une licence'); return; } }
    snap('Modification en lot de ' + list.length + ' jeu' + (list.length > 1 ? 'x' : ''));
    let n = 0, skip = 0;
    list.forEach((x) => {
      if (ETAT_FIELDS.indexOf(f) >= 0 && isDemat(x.g)) { skip++; return; }
      x.g[f] = val; if (f === 'prixEstime') x.g.prixDate = Date.now(); n++;
    });
    if (f === 'licence' && DB.options.licences.indexOf(val) < 0) DB.options.licences.push(val);
    S.sel = new Set(); save(); renderNav(); refresh();
    toast(n + ' jeu' + (n > 1 ? 'x modifiés' : ' modifié') + (skip ? ' (' + skip + ' dématérialisé' + (skip > 1 ? 's' : '') + ' ignoré' + (skip > 1 ? 's' : '') + ')' : ''), true);
  }
  function bulkDelete() {
    const list = selGames(); if (!list.length) return;
    if (!confirm('Supprimer ces ' + list.length + ' jeux ?')) return;
    snap('Suppression de ' + list.length + ' jeux');
    list.forEach((x) => { x.c.games.splice(x.c.games.indexOf(x.g), 1); });
    S.sel = new Set(); save(); renderNav(); refresh(); toast(list.length + ' jeux supprimés', true);
  }

  function allView() {
    const F = S.all, c = F.tab === 'lic';
    const sel = (key, list, cur, all) => '<select data-fa="' + key + '"><option value="">' + all + '</option>' + list.map((x) => '<option value="' + esc(Array.isArray(x) ? x[0] : x) + '"' + ((Array.isArray(x) ? x[0] : x) === cur ? ' selected' : '') + '>' + esc(Array.isArray(x) ? x[1] : x) + '</option>').join('') + '</select>';
    let h = '<h2 class="page">Tous les jeux</h2><p class="sub">Toute la collection sur une seule page, toutes consoles confondues.</p>' +
      '<div class="toolbar"><div class="seg"><button data-act="all-tab" data-t="jeux" class="' + (c ? '' : 'on') + '">Les jeux</button><button data-act="all-tab" data-t="lic" class="' + (c ? 'on' : '') + '">Complétion par licence</button></div></div>';
    if (c) return h + '<div class="toolbar"><input data-fa="lq" type="search" placeholder="Chercher une licence…" value="' + esc(F.lq) + '"></div><div id="results"></div>';
    return h + '<div class="toolbar"><input data-fa="q" type="search" placeholder="Chercher (ex. Sonic)…" value="' + esc(F.q) + '">' +
      sel('cons', orderedConsoles().map((x) => [x.id, x.nom]), F.cons, 'Toutes consoles') + sel('licence', allLicences(), F.licence, 'Toutes licences') +
      sel('statut', ['Complet', 'Loose', 'Notice manquante', 'Démat'], F.statut, 'Tous statuts') +
      sel('flag', [['special', '⭐ Éditions spéciales'], ['platine', '🏆 Terminés à 100 %'], ['non', 'Pas encore à 100 %'], ['old', '⏳ Estimations anciennes'], ['notitle', 'Sans titre']], F.flag, 'Tous les jeux') +
      sel('sort', [['nom', 'Tri : nom'], ['console', 'Tri : console'], ['sortie', 'Tri : date de sortie ↑'], ['sortie-d', 'Tri : date de sortie ↓'], ['prix', 'Tri : prix ↓']], F.sort === 'nom' ? '' : F.sort, 'Tri : nom') + '</div><div id="bulkbar"></div><div id="results"></div>';
  }
  function allList() {
    const F = S.all, q = F.q.trim().toLowerCase(), out = [];
    orderedConsoles().forEach((c) => {
      if (F.cons && c.id !== F.cons) return;
      c.games.forEach((g) => {
        if (F.licence && g.licence !== F.licence) return;
        if (F.statut && statut(g) !== F.statut) return;
        if (F.flag === 'special' && !g.special) return;
        if (F.flag === 'platine' && !g.platine) return;
        if (F.flag === 'non' && g.platine) return;
        if (F.flag === 'old' && !isStale(g)) return;
        if (F.flag === 'notitle' && g.nom) return;
        if (q && !((g.nom || '') + ' ' + (g.licence || '') + ' ' + (g.version || '') + ' ' + c.nom + ' ' + (READONLY ? '' : (g.notes || ''))).toLowerCase().includes(q)) return;
        out.push({ c, g });
      });
    });
    if (F.sort === 'nom') out.sort((a, b) => String(a.g.nom || '').localeCompare(String(b.g.nom || ''), 'fr'));
    else if (F.sort === 'sortie' || F.sort === 'sortie-d') { const d = F.sort === 'sortie' ? 1 : -1; out.sort((a, b) => { const x = parseInt(a.g.anneeSortie, 10), y = parseInt(b.g.anneeSortie, 10); if (isNaN(x) && isNaN(y)) return 0; if (isNaN(x)) return 1; if (isNaN(y)) return -1; return d * (x - y); }); }
    else if (F.sort === 'prix') out.sort((a, b) => (Number(b.g.prixEstime) || 0) - (Number(a.g.prixEstime) || 0));
    return out;
  }
  function renderAll() { $('#app').innerHTML = allView(); paintAll(); }
  function licData() {
    const m = {}, low = {};
    DB.consoles.forEach((c) => c.games.forEach((g) => {
      if (!g.licence) return;
      const e = m[g.licence] || (m[g.licence] = { n: g.licence, own: 0, cons: new Set(), wish: [] });
      e.own++; e.cons.add(c.nom); low[g.licence] = g.licence.toLowerCase();
    }));
    const names = Object.keys(m); let nw = 0;
    Object.keys(DB.wishlists).forEach((k) => DB.wishlists[k].forEach((w) => {
      nw++;
      const wl = (w.licence || '').toLowerCase(), nm = (w.nom || '').toLowerCase(); let best = null;
      names.forEach((n) => { const L = low[n]; if (wl ? wl === L : (L.length >= 3 && nm.indexOf(L) >= 0)) { if (!best || L.length > low[best].length) best = n; } });
      if (best) m[best].wish.push(w.nom || 'Jeu à identifier');
    }));
    return { list: Object.keys(m).map((k) => m[k]), nw };
  }
  function paintAll() {
    const res = $('#results'); if (!res) return;
    const F = S.all;
    if (F.tab === 'lic') {
      const d = licData(), q = F.lq.trim().toLowerCase();
      const list = d.list.filter((e) => !q || e.n.toLowerCase().indexOf(q) >= 0).sort((a, b) => (b.own + b.wish.length) - (a.own + a.wish.length) || a.n.localeCompare(b.n, 'fr'));
      if (!list.length) { res.innerHTML = '<div class="card">Aucune licence renseignée. Ajoute une « Licence / série » à tes jeux (ou par lot depuis « Les jeux »).</div>'; return; }
      res.innerHTML = '<p class="muted">Possédés / (possédés + en wishlist). Une ligne de wishlist est rattachée à la licence dont le nom apparaît dans son titre.</p><div class="licgrid">' + list.map((e) => {
        const tot = e.own + e.wish.length, pct = tot ? Math.round(e.own / tot * 100) : 100;
        return '<div class="licrow" data-act="all-lic" data-l="' + esc(e.n) + '" title="Voir ces jeux"><div class="licname"><b>' + esc(e.n) + '</b><small>' + esc([...e.cons].join(' · ')) + '</small></div>' +
          '<div class="licbar"><i style="width:' + pct + '%"></i></div><div class="licnum"><b>' + e.own + '</b> possédé' + (e.own > 1 ? 's' : '') + (d.nw ? ' · <span class="' + (e.wish.length ? 'goldtxt' : 'muted') + '">' + e.wish.length + ' en wishlist</span> · ' + pct + ' %' : '') + '</div>' +
          (e.wish.length ? '<div class="licwish">À trouver : ' + esc(e.wish.slice(0, 4).join(', ')) + (e.wish.length > 4 ? '…' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div>';
      return;
    }
    const list = allList(), shown = list.slice(0, S.allLimit);
    const q = list.reduce((s, x) => s + (Number(x.g.quantite) || 1), 0), v = list.reduce((s, x) => s + (Number(x.g.prixEstime) || 0) * (Number(x.g.quantite) || 1), 0);
    let h = '<p class="muted">' + list.length + ' lignes · ' + q + ' exemplaires' + (HIDE_PRICE ? '' : ' · valeur estimée ' + eur(v)) + '</p>';
    if (!list.length) { res.innerHTML = h + '<div class="card">Aucun jeu ne correspond.</div>'; S.curKeys = []; paintBulk(); return; }
    h += '<div class="tablewrap"><table><thead><tr>' + (READONLY ? '' : '<th class="chk"><input type="checkbox" data-selall title="Tout sélectionner (les ' + list.length + ' jeux)"></th>') + '<th>Jeu</th><th>Console</th><th>Statut</th><th>Qualité</th><th>Qté</th>' + (HIDE_PRICE ? '' : '<th>Estimé</th>') + '<th>Licence</th></tr></thead><tbody>';
    shown.forEach((x) => {
      const g = x.g, c = x.c;
      h += '<tr class="' + rowClass(g).trim() + '" data-act="view-game" data-c="' + c.id + '" data-id="' + g.id + '" style="cursor:pointer">' + (READONLY ? '' : '<td class="chk"><input type="checkbox" data-sel="' + c.id + '|' + g.id + '"' + (S.sel.has(c.id + '|' + g.id) ? ' checked' : '') + '></td>') +
        '<td><div class="tcell">' + cover(g, 'sm') + '<span class="title">' + gameTitle(g) + gameIcons(g) + '</span></div></td><td>' + esc(c.nom) + '</td><td>' + pill(statut(g)) + '</td><td>' + pill(g.qualite) + '</td><td class="n">' + g.quantite + '</td>' +
        (HIDE_PRICE ? '' : '<td class="n">' + eur(g.prixEstime) + '</td>') + '<td>' + esc(g.licence) + '</td></tr>';
    });
    h += '</tbody></table></div>' + (list.length > shown.length ? '<div class="toolbar"><button class="btn" data-act="all-more">Afficher la suite (' + (list.length - shown.length) + ' restants)</button></div>' : '');
    res.innerHTML = h; S.curKeys = list.map((x) => x.c.id + '|' + x.g.id); paintBulk();
  }

  /* ---------- 9m. Historique des prix ---------- */
  function histCard() {
    const n = (DB.valHist || []).length;
    return '<div class="card"><h3>📈 Historique des prix</h3><p class="muted" style="margin:0 0 10px">Garde chaque estimation avec sa date et trace la courbe de la valeur de ta collection (Statistiques). L\'historique commence à l\'activation : il ne peut pas remonter dans le passé.</p>' +
      (DB.histOn ? '<p style="margin:0 0 8px">✅ <b>Actif</b> depuis le ' + fdate(DB.histStart) + ' · ' + n + ' point' + (n > 1 ? 's' : '') + ' sur la courbe.</p><div class="toolbar" style="margin-top:0"><button class="btn" data-act="hist-off">Mettre en pause</button><button class="btn danger" data-act="hist-clear">Effacer l\'historique</button></div>'
        : '<div class="toolbar" style="margin-top:0"><button class="btn primary" data-act="hist-on">Activer l\'historique</button>' + (n ? '<button class="btn danger" data-act="hist-clear">Effacer l\'historique</button>' : '') + '</div>' + (n ? '<p class="muted" style="margin:8px 0 0">En pause : ' + n + ' points conservés.</p>' : '')) + '</div>';
  }
  function lineSvg(pts) {
    const W = 640, H = 200, L = 58, R = 14, T = 14, B = 28;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach((p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    if (y1 === y0) { y1 += 1; y0 = Math.max(0, y0 - 1); }
    const pad = (y1 - y0) * 0.08; y0 = Math.max(0, y0 - pad); y1 += pad;
    const sx = (t) => L + (W - L - R) * ((t - x0) / ((x1 - x0) || 1)), sy = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
    const path = pts.map((p, i) => (i ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('');
    return '<svg class="hist" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Évolution de la valeur estimée"><line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="var(--line)"/>' +
      '<text x="' + (L - 6) + '" y="' + (T + 4) + '" text-anchor="end">' + eur(y1) + '</text><text x="' + (L - 6) + '" y="' + (H - B) + '" text-anchor="end">' + eur(y0) + '</text>' +
      '<text x="' + L + '" y="' + (H - 8) + '">' + fdate(x0) + '</text><text x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end">' + fdate(x1) + '</text>' +
      '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>' + (pts.length <= 40 ? pts.map((p) => '<circle cx="' + sx(p[0]).toFixed(1) + '" cy="' + sy(p[1]).toFixed(1) + '" r="3.5" fill="var(--accent)"><title>' + fdate(p[0]) + ' : ' + eur(p[1]) + '</title></circle>').join('') : '') + '</svg>';
  }
  function histChart() {
    if (HIDE_PRICE || READONLY) return '';
    const vh = DB.valHist || [];
    if (vh.length >= 2) {
      const first = vh[0], last = vh[vh.length - 1], dlt = last[1] - first[1];
      return '<div class="card"><h3>Évolution de la valeur estimée</h3>' + lineSvg(vh) + '<p class="muted" style="margin:6px 0 0">Depuis le ' + fdate(first[0]) + ' : <b>' + (dlt >= 0 ? '+' : '') + eur(dlt) + '</b> (de ' + eur(first[1]) + ' à ' + eur(last[1]) + ').</p></div>';
    }
    return '<div class="card"><h3>Évolution de la valeur estimée</h3><p class="muted" style="margin:0">' + (DB.histOn ? 'Historique actif : la courbe apparaîtra dès que tes estimations changeront (par exemple après un import de prix).' : 'Active « l\'historique des prix » dans les Paramètres pour tracer la courbe de la valeur de ta collection.') + '</p></div>';
  }
  const histList = (g) => (HIDE_PRICE || !g.hist || g.hist.length < 2) ? '' : '<p class="muted" style="margin:8px 0 0">Historique : ' + g.hist.slice(-6).map((h) => fdate(h[0]) + ' <b>' + eur(h[1]) + '</b>').join(' → ') + '</p>';

  /* ---------- 9n. Partager une seule wishlist ---------- */
  const wishShareId = (k) => (sync().wishShares || {})[k] || null;
  const wishShareUrl = (k) => { const id = wishShareId(k); return id ? location.origin + location.pathname + '?lecture=' + id : ''; };
  function wishShareDialog(k) {
    const u = wishShareUrl(k), web = /^https?:/.test(location.protocol), n = DB.wishlists[k].length;
    showModal('Partager « ' + wishName(k) + ' »',
      '<p class="muted" style="margin-top:0">Crée un lien en lecture seule qui ne montre <b>que cette liste</b> (' + n + ' jeu' + (n > 1 ? 'x' : '') + '), sans ta collection ni tes autres listes. Idéal pour la famille à Noël.</p>' +
      '<label class="muted" style="display:block;margin:6px 0"><input type="checkbox" id="wsPrix"' + (sync().wsPrix ? ' checked' : '') + '> Montrer les prix de cette liste</label>' +
      '<div class="toolbar"><button class="btn primary" data-act="wshare-pub" data-k="' + k + '">' + (u ? '⟳ Mettre à jour le lien' : '🔗 Créer le lien') + '</button>' + (u ? '<button class="btn" data-act="wshare-copy" data-k="' + k + '">📋 Copier</button><button class="btn danger" data-act="wshare-stop" data-k="' + k + '">Arrêter ce partage</button>' : '') + '</div>' +
      (u ? '<input id="wsLink" class="bigsearch" readonly value="' + esc(u) + '" onclick="this.select()">' : '') + (web ? '' : '<p class="muted">⚠️ Utilise l\'adresse en ligne du site (https://…) pour obtenir un lien valable.</p>') +
      '<p class="muted" id="wsMsg" style="margin:6px 0 0">Après avoir modifié la liste, clique sur « Mettre à jour » pour que les autres voient les changements.</p>');
  }
  async function wishSharePublish(k) {
    const msg = (t) => { const m = $('#wsMsg'); if (m) m.textContent = t; };
    try {
      syncSaveToken(); if (!sync().token) throw new Error('Enregistre d\'abord ton jeton GitHub (Paramètres → Synchronisation).');
      const prix = !!($('#wsPrix') && $('#wsPrix').checked); setSync({ wsPrix: prix }); msg('Publication en cours…');
      const list = clone(DB.wishlists[k]); if (!prix) list.forEach((w) => { delete w.prix; delete w.prixMin; delete w.prixMax; });
      const d = { version: DB.version, rev: DB.rev, consoles: [], commandes: [], presets: [], options: clone(DB.options), wishNames: {}, wishlists: {}, share: { prix, wish: true, notes: false, only: k, at: Date.now() } };
      d.wishlists[k] = list; d.wishNames[k] = wishName(k);
      const body = { description: 'Wishlist Fazerbleu (partage en lecture seule)', files: {} }; body.files[SHARE_FILE] = { content: JSON.stringify(d) };
      const ws = Object.assign({}, sync().wishShares || {}), id = ws[k];
      if (id) { try { await gh('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) }); } catch (e) { if (/404/.test(e.message)) { delete ws[k]; setSync({ wishShares: ws }); return wishSharePublish(k); } throw e; } }
      else { body.public = false; const g = await gh('/gists', { method: 'POST', body: JSON.stringify(body) }); ws[k] = g.id; setSync({ wishShares: ws }); }
      closeModal(); wishShareDialog(k); toast('Lien prêt : copie-le pour l\'envoyer');
    } catch (e) { msg(e.message); toast(e.message); }
  }
  async function wishShareStop(k) {
    if (!confirm('Arrêter ce partage ? Le lien ne fonctionnera plus.')) return;
    const ws = Object.assign({}, sync().wishShares || {}), id = ws[k];
    try { if (id) await gh('/gists/' + id, { method: 'DELETE' }); } catch (e) { if (!/404/.test(e.message)) { toast(e.message); return; } }
    delete ws[k]; setSync({ wishShares: ws }); closeModal(); toast('Partage de la liste arrêté');
  }

  /* ---------- 9k. À propos : version, nouveautés, guide ---------- */
  function aboutView() {
    const g = (t, body) => '<details class="guide"><summary>' + t + '</summary>' + body + '</details>';
    const log = [
      ['1.1', 'Tranches réelles des jeux · éditions (Choix des joueurs, Platinum…) détectées comme doublons avec fusion · jeux liés (version Switch 2 débloquée par la cartouche Switch 1) · logos Monochrome pour toutes les consoles · tri par date de sortie · colonne des cases resserrée · couleur Nintendo uniforme'],
      ['1.0', 'Annuler une suppression ou une opération groupée · vérification de la dernière version à chaque ouverture · page À propos · vue « Tous les jeux » · complétion par licence · modification en lot · historique des prix · partage d\'une seule wishlist'],
      ['0.9', 'Vue Tranches · wishlists modifiables avec Vitrine · compléter les titres · alerte doublons · frise déplaçable · bandeau « version plus récente » · version précédente dans le cloud · Brocante pour les amis · filtres en liste · Paramètres repliables'],
      ['0.8', 'Stockage IndexedDB (plus de limite de 5 Mo) · rappel d\'envoi · lien de partage en lecture seule · version publique sans données'],
      ['0.7', 'Jeux dématérialisés et onglets · Game-Key Card · ordre des consoles · logos agrandis'],
      ['0.6', 'Mode clair · fiche vitrine · Brocante · accès depuis le téléphone · jaquettes adaptatives'],
      ['0.5', 'Statistiques · impression · « Acheté ! » depuis la wishlist · filtres enregistrés · import de prix · sauvegarde automatique'],
      ['0.1 – 0.4', 'Tableau de bord, consoles, jeux, wishlists, commandes, recherche, thème sombre'],
    ];
    return '<h2 class="page">À propos</h2>' +
      '<div class="card aboutcard"><div class="aboutv"><b>Collection Fazerbleu</b><span class="pill e-parfait">version ' + esc(APP_VERSION) + '</span></div>' +
      '<p class="muted" style="margin:6px 0 0">Application personnelle pour gérer une collection de jeux vidéo. Tes données restent dans ton navigateur (' + (useIdb ? 'IndexedDB' : 'stockage local') + ') et dans ton cloud privé : le site lui-même n\'en contient aucune.</p></div>' +
      '<div class="card"><h3>Nouveautés</h3>' + log.map((x) => '<div class="chlog"><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></div>').join('') + '</div>' +
      '<div class="card"><h3>Petit guide</h3>' +
      g('Ajouter un jeu', '<p class="muted">« Nouveau jeu » en haut à droite, ou « Ajouter un jeu » dans une console. Coche « Dématérialisé » pour un jeu sans support physique. Les 92 jeux sans titre se complètent vite dans « Compléter les titres » (menu de gauche).</p>') +
      g('Synchroniser ordinateur et téléphone', '<p class="muted">Paramètres → Synchronisation : colle ton jeton GitHub une fois. Après une séance de saisie sur l\'ordinateur, clique sur « Envoyer ». Sur le téléphone, ouvre l\'appli : si le cloud est plus récent, un bandeau te propose de « Récupérer ». Saisis plutôt sur un seul appareil à la fois pour éviter d\'écraser tes ajouts.</p>') +
      g('Partager avec des amis', '<p class="muted">Paramètres → « Partager avec mes amis » crée un lien en lecture seule (sans prix d\'achat, numéros de série ni commandes). Sur une page de wishlist, « Partager cette liste » crée un lien qui ne montre que cette liste. Le lien se coupe en un clic.</p>') +
      g('Sauvegarder et annuler', '<p class="muted">Fais de temps en temps « Exporter tout (JSON) » : c\'est ta sauvegarde indépendante. Après une suppression, le bouton « Annuler » reste à l\'écran quelques secondes (ou Ctrl + Z) et la vue d\'ensemble garde l\'annulation de la dernière action. Le cloud garde aussi la version précédente.</p>') +
      g('Installer sur le téléphone', '<p class="muted">Ouvre l\'adresse du site dans le navigateur, puis « Ajouter à l\'écran d\'accueil ». L\'appli fonctionne ensuite comme une application, même avec un réseau faible.</p>') +
      g('Mises à jour de l\'application', '<p class="muted">Le site vérifie sa dernière version à chaque ouverture. Quand une nouvelle version est prête, une bannière « Nouvelle version disponible » apparaît : clique sur « Actualiser ». Tes données ne sont jamais touchées par une mise à jour.</p>') +
      '</div>';
  }

  /* ---------- 9j. Frise déplaçable, Paramètres repliables, compléter les titres, doublons ---------- */
  function initMarquee() {
    const m = $('.marquee'); if (!m) return;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hover = false, touching = false, drag = null, moved = 0, acc = 0, last = performance.now(), tm = 0;
    m.scrollLeft = 1;
    m.addEventListener('dragstart', (e) => e.preventDefault()); /* sinon le navigateur « attrape » le lien au lieu de faire glisser la frise */
    const links = m.querySelectorAll('a'), n2 = links.length / 2;
    const half = () => (n2 >= 1 ? links[n2].offsetLeft - links[0].offsetLeft : 0); /* largeur exacte d'un tour */
    let ready = false;
    const tick = (t) => {
      if (!m.isConnected) return;
      if (!ready) { ready = [...m.querySelectorAll('img')].every((i) => i.complete); if (!ready) { requestAnimationFrame(tick); return; } }
      const dt = Math.min(60, t - last); last = t;
      if (!reduce && !hover && !touching && !drag) { acc += dt * 0.04; if (acc >= 1) { const n = Math.floor(acc); m.scrollLeft += n; acc -= n; } }
      const h = half(); if (h > 10) { if (m.scrollLeft >= h) m.scrollLeft -= h; else if (m.scrollLeft <= 0) m.scrollLeft += h - 1; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    m.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
    m.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover = false; });
    m.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        drag = { x: e.clientX, sl: m.scrollLeft }; moved = 0; m.classList.add('dragging');
        const mv = (ev) => { moved = Math.max(moved, Math.abs(ev.clientX - drag.x)); m.scrollLeft = drag.sl - (ev.clientX - drag.x); };
        const up = () => { drag = null; m.classList.remove('dragging'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      } else { touching = true; clearTimeout(tm); }
    });
    const rel = (e) => { if (e.pointerType !== 'mouse') { clearTimeout(tm); tm = setTimeout(() => { touching = false; }, 1800); } };
    m.addEventListener('pointerup', rel); m.addEventListener('pointercancel', rel);
    m.addEventListener('touchend', () => { clearTimeout(tm); tm = setTimeout(() => { touching = false; }, 1800); }, { passive: true });
    m.addEventListener('click', (e) => { if (moved > 5) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
  }
  /* Paramètres : chaque carte devient un menu qui se déplie (l'état est mémorisé) */
  function foldSettings() {
    document.querySelectorAll('#app > .card').forEach((card) => {
      const h3 = card.querySelector(':scope > h3'); if (!h3) return;
      const id = h3.textContent.trim(), d = document.createElement('details'), sm = document.createElement('summary'), body = document.createElement('div');
      d.className = 'card fold'; d.dataset.fold = id; if (S.fold[id]) d.open = true;
      sm.appendChild(h3); body.className = 'foldbody';
      while (card.firstChild) body.appendChild(card.firstChild);
      d.appendChild(sm); d.appendChild(body); card.replaceWith(d);
    });
  }
  document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.dataset && d.dataset.fold) S.fold[d.dataset.fold] = d.open; }, true);

  function titlesView() {
    const groups = [];
    DB.consoles.forEach((c) => { const l = c.games.filter((g) => !g.nom); if (l.length) groups.push({ c, l }); });
    const total = groups.reduce((n, x) => n + x.l.length, 0);
    let h = '<h2 class="page">Compléter les titres</h2><p class="sub"><b id="tleft">' + total + '</b> jeux sans titre. Tape le titre puis <b>Entrée</b> : on passe au suivant. Laisse vide pour passer.</p>';
    if (!total) return h + '<div class="card">🎉 Tous tes jeux ont un titre.</div>';
    const names = [...new Set([].concat(...DB.consoles.map((c) => c.games.map((g) => g.nom))).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')).slice(0, 500);
    h += '<datalist id="titleList">' + names.map((n) => '<option value="' + esc(n) + '">').join('') + '</datalist>';
    groups.forEach(({ c, l }) => {
      h += '<h3 class="thead">' + logoHtml(c) + '<span>' + esc(c.nom) + ' <small class="muted">(' + l.length + ')</small></span></h3><div class="tlist">';
      l.forEach((g) => {
        const clue = [g.licence, g.anneeSortie, g.achat, (g.notes || '').slice(0, 60)].filter(Boolean).join(' · ');
        h += '<div class="trow" data-c="' + c.id + '" data-id="' + g.id + '">' + cover(g, 'sm') + '<div class="tinfo"><div class="row">' + (g.version ? '<span class="pill">' + esc(g.version) + '</span>' : '') + (g.qualite ? pill(g.qualite) : '') + '</div>' +
          (clue ? '<div class="muted">' + esc(clue) + '</div>' : '') + '</div><input class="tinput" type="text" list="titleList" placeholder="Titre du jeu…" autocomplete="off"><span class="tok">✓</span></div>';
      });
      h += '</div>';
    });
    return h;
  }
  /* Éditions « de rééditions » : même jeu, autre boîte (Choix des joueurs, Platinum, Essentials…) */
  const EDITIONS = [[/choix des joueurs/g, 'Choix des joueurs'], [/players? ?choice/g, 'Player\'s Choice'], [/platinum/g, 'Platinum'], [/essentials?/g, 'Essentials'], [/greatest hits/g, 'Greatest Hits'], [/nintendo selects/g, 'Nintendo Selects'], [/les incontournables/g, 'Les Incontournables'], [/game of the year|goty/g, 'Game of the Year'], [/\bedition\b/g, '']];
  function editionInfo(g) {
    let t = plain((g.nom || '') + ' ' + (g.version || '')).replace(/['’]/g, ''), lab = [];
    EDITIONS.forEach((e) => { const had = e[0].test(t); e[0].lastIndex = 0; if (had) { if (e[1]) lab.push(e[1]); t = t.replace(e[0], ' '); } });
    return { key: t.replace(/[^a-z0-9]+/g, ''), label: lab.join(' + ') || 'Standard' };
  }
  function dupGroups() {
    const out = [];
    DB.consoles.forEach((c) => {
      const m = {};
      c.games.forEach((g) => { if (!g.nom) return; const e = editionInfo(g), k = e.key + '|' + (isDemat(g) ? 'd' : 'p'); (m[k] = m[k] || []).push({ g, label: e.label, ex: plain(g.nom + '|' + (g.version || '')).replace(/[^a-z0-9|]+/g, '') }); });
      Object.keys(m).forEach((k) => { if (m[k].length > 1) { const l = m[k].map((x) => x.g), labels = m[k].map((x) => x.label); out.push({ c, l, labels, same: m[k].every((x) => x.ex === m[k][0].ex) }); } });
    });
    return out;
  }

  /* ---------- 11. Recherche globale ---------- */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) { router(); return; }
    const hit = (o) => JSON.stringify(o, (k, v) => (k === 'image' || k === 'imageEdition' || k === 'tranche' ? undefined : v)).toLowerCase().includes(q);
    let h = '<h2 class="page">Résultats pour « ' + esc(q) + ' »</h2>', n = 0;
    DB.consoles.forEach((c) => {
      const r = c.games.filter(hit);
      if (!r.length) return; n += r.length;
      h += '<div class="card"><h3>' + esc(c.nom) + ' (' + r.length + ')</h3>' + r.map((g) => '<div class="hit"><a href="#/console/' + c.id + '" data-act="view-game" data-c="' + c.id + '" data-id="' + g.id + '">' + esc(g.nom || 'Titre à renseigner') + '</a>' + gameIcons(g) + ' <span class="muted">· ' + esc(g.licence) + ' · ' + esc(g.achat) + ' · ' + esc((g.notes || '').slice(0, 60)) + '</span></div>').join('') + '</div>';
    });
    Object.keys(DB.wishlists).forEach((k) => {
      const r = DB.wishlists[k].filter(hit);
      if (!r.length) return; n += r.length;
      h += '<div class="card"><h3>Wishlist ' + esc(wishName(k)) + ' (' + r.length + ')</h3>' + r.map((w) => '<div class="hit">' + esc(w.nom || 'Jeu à identifier') + ' <span class="muted">· ' + esc(w.description) + ' · ' + esc(w.prix) + '</span></div>').join('') + '</div>';
    });
    const o = DB.commandes.filter(hit);
    if (o.length) { n += o.length; h += '<div class="card"><h3>Commandes (' + o.length + ')</h3>' + o.map((x) => '<div class="hit">' + esc(x.nom || 'Collector') + ' <span class="muted">· ' + esc(x.site) + ' · ' + esc(x.date) + '</span></div>').join('') + '</div>'; }
    if (!n) h += '<div class="card">Aucun résultat.</div>';
    $('#app').innerHTML = h;
  }

  /* ---------- 12. Import / export ---------- */
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function exportCsv(id) {
    const c = consoleById(id);
    const cols = ['nom', 'licence', 'support', 'boite', 'notice', 'qualite', 'quantite', 'prixEstime', 'achat', 'version', 'anneeSortie', 'anneeAchat', 'notes', 'special', 'editionNote', 'platine', 'gamekey', 'test', 'desc100'];
    const q = (v) => '"' + String(v == null ? '' : v === true ? 'Oui' : v).replace(/"/g, '""') + '"';
    download('collection-' + c.id + '.csv', '﻿' + [cols.join(';')].concat(c.games.map((g) => cols.map((k) => q(g[k])).join(';'))).join('\n'), 'text/csv;charset=utf-8');
  }

  /* ---------- 13. Événements ---------- */
  function refresh() { const v = route()[0]; if (v === 'console') { $('#app').innerHTML = consoleView(consoleById(route()[1])); paintConsole(); } else if (v === 'all') paintAll(); else router(); }
  const delConfirm = (msg, fn) => { if (confirm(msg)) { snap(msg.replace(/\s*\?$/, '')); fn(); save(); closeModal(); renderNav(); refresh(); toast('Supprimé', true); } };

  document.addEventListener('click', (e) => {
    if (e.target.closest('.chk')) return;
    const t = e.target.closest('[data-act]'); if (!t) return;
    const d = t.dataset;
    if (READONLY && ['mode', 'sort', 'zoom', 'view-game', 'vswap', 'open-vitrine', 'tab', 'wmode', 'view-wish', 'preset', 'all-tab', 'all-lic', 'all-more'].indexOf(d.act) < 0) { e.preventDefault(); return; }
    if (t.tagName === 'A' && (d.act === 'view-game' || d.act === 'view-wish')) e.preventDefault();
    switch (d.act) {
      case 'mode': S.mode = d.m; refresh(); break;
      case 'sort': { const id = route()[1], s = S.sort[id]; S.sort[id] = !s || s.key !== d.k ? { key: d.k, dir: 1 } : (s.dir === 1 ? { key: d.k, dir: -1 } : null); if (!S.sort[id]) delete S.sort[id]; paintConsole(); break; }
      case 'zoom': showModal('', '<img class="zoomimg" src="' + esc(d.src) + '" alt="">', true); break;
      case 'add-game': editGame(d.id, null, tabOf(consoleById(d.id)) === 'demat' ? { demat: true } : null); break;
      case 'edit-game': editGame(d.c, d.id); break;
      case 'view-game': viewGame(d.c, d.id); break;
      case 'del-game': delConfirm('Supprimer ce jeu ?', () => { const c = consoleById(d.c); c.games = c.games.filter((g) => g.id !== d.id); }); break;
      case 'add-machine': editMachine(d.c, null); break;
      case 'edit-machine': editMachine(d.c, d.id); break;
      case 'del-machine': delConfirm('Supprimer cette console du matériel ?', () => { const c = consoleById(d.c); c.machines = c.machines.filter((m) => m.id !== d.id); }); break;
      case 'add-wish': editWish(d.k, null); break;
      case 'edit-wish': editWish(d.k, d.id); break;
      case 'view-wish': { const w = DB.wishlists[d.k].find((x) => x.id === d.id); viewItem(w.nom ? esc(w.nom) : 'Jeu à identifier', [w.section, w.groupeLabel].filter(Boolean).join(' · '), w, [['Édition collector', w.collector], ['Sortie', w.date], ['Version', w.version], ['Description', w.description], ['Estimation', w.prix], ['Quantité', w.quantite]], 'edit-wish', 'del-wish', ' data-k="' + d.k + '"', 'buy-wish'); break; }
      case 'del-wish': delConfirm('Supprimer cette ligne ?', () => { DB.wishlists[d.k] = DB.wishlists[d.k].filter((w) => w.id !== d.id); }); break;
      case 'add-order': editOrder(null); break;
      case 'edit-order': editOrder(d.id); break;
      case 'view-order': { const o = DB.commandes.find((x) => x.id === d.id); viewItem(o.nom ? esc(o.nom) : 'Article à identifier', o.site + ' · ' + o.statut, o, [['Collector', o.collector], ['Sortie', o.date], ['Quantité', o.quantite], ['Prix', o.prix], ['Prélèvement', o.prelevement], ['Livraison', o.livraison]], 'edit-order', 'del-order', '', 'buy-order'); break; }
      case 'del-order': delConfirm('Supprimer cette commande ?', () => { DB.commandes = DB.commandes.filter((o) => o.id !== d.id); }); break;
      case 'export-json': DB.lastBackup = Date.now(); save(); download('collection-fazerbleu-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(DB, null, 1)); toast('Sauvegarde téléchargée'); if (['dashboard', 'settings', ''].indexOf(route()[0]) >= 0) router(); break;
      case 'export-csv': exportCsv(d.id); break;
      case 'del-legacy': try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } router(); toast('Ancienne copie supprimée'); break;
      case 'reset': if (confirm('Effacer toutes tes modifications et revenir aux données de départ ?')) { snap('Retour aux données de départ'); try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } DB = clone(INITIAL_DATA); normalize(DB); lastSer = null; save(); router(); toast('Données réinitialisées', true); } break;
      case 'undo': undo(); break;
      case 'merge-dup': { const c = consoleById(d.c), gs = d.ids.split(',').map((i) => c && c.games.find((x) => x.id === i)).filter(Boolean); if (gs.length < 2) break; snap('Fusion de ' + gs.length + ' lignes « ' + (gs[0].nom || '') + ' »'); gs[0].quantite = gs.reduce((a, x) => a + (Number(x.quantite) || 1), 0); gs.slice(1).forEach((x) => c.games.splice(c.games.indexOf(x), 1)); save(); renderNav(); router(); toast('Lignes fusionnées', true); break; }
      case 'all-tab': S.all.tab = d.t; renderAll(); break;
      case 'all-lic': S.all = Object.assign({}, S.all, { q: '', cons: '', statut: '', flag: '', licence: d.l, tab: 'jeux' }); S.allLimit = 200; renderAll(); break;
      case 'all-more': S.allLimit += 300; paintAll(); break;
      case 'bulk-clear': S.sel = new Set(); { const v = route()[0]; if (v === 'all') paintAll(); else paintConsole(); } break;
      case 'bulk-apply': bulkApply(); break;
      case 'bulk-del': bulkDelete(); break;
      case 'hist-on': DB.histOn = true; DB.histStart = Date.now(); save(); router(); toast('Historique activé : les prochains changements de prix seront gardés'); break;
      case 'hist-off': DB.histOn = false; save(); router(); toast('Historique mis en pause'); break;
      case 'hist-clear': if (confirm('Effacer tout l\'historique des prix ?')) { snap('Effacement de l\'historique des prix'); DB.consoles.forEach((c) => c.games.forEach((g) => { delete g.hist; })); DB.valHist = []; save(); router(); toast('Historique effacé', true); } break;
      case 'wshare': wishShareDialog(d.k); break;
      case 'wshare-pub': wishSharePublish(d.k); break;
      case 'wshare-copy': { const u = wishShareUrl(d.k); if (u) { const i = $('#wsLink'); const done = () => toast('Lien copié'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, () => { i.select(); document.execCommand('copy'); done(); }); else { i.select(); document.execCommand('copy'); done(); } } break; }
      case 'wshare-stop': wishShareStop(d.k); break;
      case 'buy-wish': buyItem('wish', d.k, d.id); break;
      case 'buy-order': buyItem('order', null, d.id); break;
      case 'preset': {
        const p = d.pid ? (DB.presets.find((x) => x.id === d.pid) || {}).f : BUILTIN_PRESETS[Number(d.i)];
        S.filters[route()[1]] = Object.assign({ q: '', statut: '', licence: '', flag: '' }, p || {}); refresh(); break;
      }
      case 'save-preset': {
        const F = S.filters[route()[1]];
        openForm('Enregistrer ce filtre', [{ k: 'nom', label: 'Nom du filtre (ex. Mes loose à compléter)', wide: true }], {}, (v) => {
          if (!v.nom) return;
          DB.presets.push({ id: uid(), nom: v.nom, f: { q: F.q, statut: F.statut, licence: F.licence, flag: F.flag } }); save(); refresh(); toast('Filtre enregistré');
        }); break;
      }
      case 'del-preset': DB.presets = DB.presets.filter((x) => x.id !== d.pid); save(); refresh(); break;
      case 'pwhat': S.print.what = d.m; router(); break;
      case 'pcompact': S.print.compact = d.m === '1'; router(); break;
      case 'print': window.print(); break;
      case 'optimize': optimizeImages(); break;
      case 'fresh': if (confirm('Marquer toutes les estimations comme mises à jour aujourd\'hui ?')) { DB.consoles.forEach((c) => c.games.forEach((g) => { if (g.prixEstime != null) g.prixDate = Date.now(); })); save(); router(); toast('Estimations marquées à jour'); } break;
      case 'open-vitrine': closeModal(); break;
      case 'vswap': { const m = $('#vmain'); if (m) { m.src = d.src; m.dataset.src = d.src; } document.querySelectorAll('.vthumbs button').forEach((b) => b.classList.toggle('on', b === t)); break; }
      case 'sync-push': cloudPush(); break;
      case 'share-publish': sharePublish(); break;
      case 'share-copy': shareCopyLink(); break;
      case 'share-stop': shareStop(); break;
      case 'sync-pull': cloudPull(); break;
      case 'tab': S.tab[route()[1]] = d.t; refresh(); break;
      case 'order-mode': if (d.m === 'manuel') DB.consoles = orderedConsoles(); DB.orderMode = d.m; save(); renderNav(); router(); break;
      case 'move-brand': moveBrand(d.b, Number(d.d)); break;
      case 'move-console': moveConsole(d.c, Number(d.d)); break;
      case 'logostyle': DB.logoStyle = d.m; save(); renderNav(); router(); break;
      case 'wmode': S.wishMode = d.m; refresh(); break;
      case 'new-wishlist':
        openForm('Nouvelle wishlist', [{ k: 'nom', label: 'Nom de la wishlist (ex. Mario, PS5, Cadeaux…)', wide: true }], {}, (v) => {
          const nom = (v.nom || '').trim(); if (!nom) return;
          const k = 'w' + uid(); DB.wishlists[k] = []; DB.wishNames[k] = nom; save(); renderNav(); location.hash = '#/wish/' + k; toast('Wishlist créée');
        }); break;
      case 'rename-wishlist':
        openForm('Renommer la wishlist', [{ k: 'nom', label: 'Nom', wide: true }], { nom: wishName(d.k) }, (v) => {
          const nom = (v.nom || '').trim(); if (!nom) return; DB.wishNames[d.k] = nom; save(); renderNav(); router();
        }); break;
      case 'del-wishlist': {
        const n = (DB.wishlists[d.k] || []).length;
        if (confirm('Supprimer la wishlist « ' + wishName(d.k) + ' »' + (n ? ' et ses ' + n + ' jeux' : '') + ' ?')) { snap('Suppression de la wishlist ' + wishName(d.k)); delete DB.wishlists[d.k]; delete DB.wishNames[d.k]; save(); location.hash = '#/dashboard'; renderNav(); toast('Wishlist supprimée', true); }
        break;
      }
      case 'cloudbar-pull': { const b = document.getElementById('cloudbar'); if (b) b.remove(); cloudPull(); break; }
      case 'cloudbar-later': { const b = document.getElementById('cloudbar'); if (b) b.remove(); break; }
      case 'restore-prev': cloudRestorePrev(); break;
      case 'new-console': editConsole(null); break;
      case 'edit-console': editConsole(d.c); break;
      case 'del-console': delConfirm('Supprimer cette console et tous ses jeux ?', () => { DB.consoles = DB.consoles.filter((c) => c.id !== d.c); location.hash = '#/dashboard'; }); break;
      case 'new-game': {
        if (!DB.consoles.length) { toast('Crée d\'abord une console'); break; }
        openForm('Nouveau jeu', [{ k: 'cid', label: 'Plateforme', type: 'select', opts: DB.consoles.map((c) => c.id), names: DB.consoles.map((c) => c.nom) }],
          { cid: route()[0] === 'console' ? route()[1] : DB.consoles[0].id }, (v) => editGame(v.cid, null));
        break;
      }
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'globalSearch') return search(t.value);
    if (t.dataset && t.dataset.f) { S.filters[route()[1]][t.dataset.f] = t.value; paintConsole(); }
    if (t.dataset && t.dataset.fa && t.tagName === 'INPUT') { S.all[t.dataset.fa] = t.value; S.allLimit = 200; paintAll(); }
    if (t.id === 'wishQ') paintWish();
    if (t.id === 'orderQ') paintOrders();
    if (t.id === 'checkQ') paintCheck();
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.f) { S.filters[route()[1]][t.dataset.f] = t.value; paintConsole(); }
    if (t.dataset && t.dataset.fa && t.tagName === 'SELECT') { S.all[t.dataset.fa] = t.value; S.allLimit = 200; paintAll(); }
    if (t.dataset && t.dataset.sel) { if (t.checked) S.sel.add(t.dataset.sel); else S.sel.delete(t.dataset.sel); paintBulk(); }
    if (t.dataset && t.dataset.selall !== undefined) { S.curKeys.forEach((k) => { if (t.checked) S.sel.add(k); else S.sel.delete(k); }); const v = route()[0]; if (v === 'all') paintAll(); else paintConsole(); }
    if (t.id === 'sortSel') { const id = route()[1]; if (t.value) { const [k, d] = t.value.split(':'); S.sort[id] = { key: k, dir: Number(d) }; } else delete S.sort[id]; paintConsole(); }
    if (t.id === 'bkField') { S.bulkField = t.value; paintBulk(); }
    if (t.id === 'presetSel' && t.value) {
      const v = t.value, p = v[0] === 'b' ? BUILTIN_PRESETS[Number(v.slice(1))] : (DB.presets.find((x) => x.id === v.slice(1)) || {}).f;
      S.filters[route()[1]] = Object.assign({ q: '', statut: '', licence: '', flag: '' }, p || {}); refresh();
    }
    if (t.classList && t.classList.contains('tinput')) {
      const row = t.closest('.trow'), c = row && consoleById(row.dataset.c), g = c && c.games.find((x) => x.id === row.dataset.id);
      if (g) { g.nom = t.value.trim(); save(); renderNav(); row.classList.toggle('done', !!g.nom); const el = $('#tleft'); if (el) el.textContent = document.querySelectorAll('.trow:not(.done)').length; }
    }
    if (t.id === 'wishPrio' || t.id === 'wishCol') paintWish();
    if (t.id === 'priceFile' && t.files[0]) readPriceFile(t.files[0]);
    if (t.id === 'importFile' && t.files[0] && !READONLY) {
      const r = new FileReader();
      r.onload = () => {
        try { const d = JSON.parse(r.result); if (!d.consoles || !d.wishlists) throw 0; snap('Import d\'un fichier'); DB = migrate(d); normalize(DB); save(); renderNav(); router(); toast('Import réussi', true); }
        catch (err) { toast('Fichier invalide'); }
      };
      r.readAsText(t.files[0]);
    }
  });
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && UNDO && !READONLY && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); undo(); }
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('tinput')) {
      e.preventDefault();
      const all = [...document.querySelectorAll('.tinput')], i = all.indexOf(e.target); e.target.blur();
      const nxt = all.slice(i + 1).find((x) => !x.closest('.trow').classList.contains('done')) || all[i + 1];
      if (nxt) { nxt.focus(); nxt.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    if (route()[0] === 'game' && $('#modal').classList.contains('hidden') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const l = document.querySelector('.vnav a[title^="' + (e.key === 'ArrowLeft' ? 'Précédent' : 'Suivant') + '"]'); if (l) location.hash = l.getAttribute('href');
    }
  });
  /* Thème clair / sombre */
  const themeBtn = $('#themeBtn');
  const paintTheme = () => { themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️'; themeBtn.title = document.documentElement.getAttribute('data-theme') === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'; };
  themeBtn.onclick = () => { const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('fazerbleu-theme', t); } catch (e) { /* ignore */ } paintTheme(); };
  paintTheme();
  new MutationObserver(() => { adaptAll(); if (HIDE_PRICE) stripPriceCols(); }).observe($('#app'), { childList: true, subtree: true });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { /* nouvelle version du site prête */
      if (!had || document.getElementById('updbar')) return;
      document.body.insertAdjacentHTML('beforeend', '<div id="updbar" class="updbar">✨ Nouvelle version disponible <button class="btn small primary" id="updBtn">Actualiser</button></div>');
      $('#updBtn').onclick = () => location.reload();
    });
  }
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  window.addEventListener('hashchange', router);

  boot();
})();
