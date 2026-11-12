/* =====================================================================
   Collection Jeux Vidéo – Fazerbleu   (V8)
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
  let READONLY = false, HIDE_PRICE = false; /* lien de partage : lecture seule, prix masqués ou non */

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
    d.orderMode = d.orderMode || 'auto'; d.logoStyle = d.logoStyle || 'auto';
    if (!d.brandOrder) d.brandOrder = [...new Set(d.consoles.map((c) => c.marque))];
    d.consoles.forEach((c) => {
      const m = CONSOLE_META[c.id] || guessMeta(c.nom);
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
  function save() {
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
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
  }

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
      ? '<span class="logo' + (big ? ' big' : '') + '" style="background:' + logoBg(c) + ';--bc:' + brandColor(c.marque) + '"><img src="' + esc(c.logo) + '" alt=""></span>'
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
  const S = { print: { what: 'collection', compact: true }, mode: 'table', wishMode: 'table', filters: {}, sort: {}, tab: {} };
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
  const BRAND_BG = { Nintendo: '#d6261b', SEGA: '#14161d', PlayStation: '#1f54d6', Xbox: '#107c10' };
  const LOGO_BGS = { white: '#ffffff', black: '#14161d', grey: '#4a4f5e' };
  const isSwitch2 = (c) => /switch\s*2/i.test(c.nom);
  const isDemat = (g) => g.support === 'Démat';
  function logoBg(c) {
    const m = c.logoBgMode || 'auto';
    if (LOGO_BGS[m]) return LOGO_BGS[m];
    if (m === 'brand' || (m === 'auto' && DB.logoStyle === 'brand')) return BRAND_BG[c.marque] || '#3a3f55';
    return LOGO_BGS[c.logoTone || (c.id === 'saturn' ? 'black' : 'white')];
  }
  const tabOf = (c) => S.tab[c.id] || (c.games.some((g) => !isDemat(g)) || !c.games.some(isDemat) ? 'phys' : 'demat');
  const consoleById = (id) => DB.consoles.find((c) => c.id === id);
  const route = () => (location.hash || '#/dashboard').slice(2).split('/');

  /* ---------- 4. Navigation ---------- */
  function renderNav() {
    const [view, id] = route();
    const a = (href, label, count, active) =>
      '<a href="' + href + '" class="' + (active ? 'active' : '') + '"><span>' + label + '</span>' + (count != null ? '<small>' + count + '</small>' : '') + '</a>';
    let h = '<h3>Tableau de bord</h3>' + a('#/dashboard', '📊 Vue d\'ensemble', null, view === 'dashboard') + a('#/stats', '📈 Statistiques', null, view === 'stats') + (READONLY ? '' : a('#/check', '🔎 Brocante', null, view === 'check'));
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
      [['general', 'Générale'], ['sonic', 'Sonic Full FR'], ['zelda', 'Zelda']].forEach(([k, l]) => {
        if (!READONLY || DB.wishlists[k].length) h += a('#/wish/' + k, l, DB.wishlists[k].length, view === 'wish' && id === k);
      });
    }
    if (!READONLY) {
      h += '<h3>Commandes</h3>' + a('#/orders', '📦 Précommandes & commandes', DB.commandes.length, view === 'orders');
      h += '<h3>Paramètres</h3>' + a('#/settings', '⚙️ Paramètres', unsent() ? '☁️' : null, view === 'settings') + a('#/print', '🖨 Impression', null, view === 'print');
    }
    $('#sidebar').innerHTML = h;
  }

  function router() {
    $('#sidebar').classList.remove('open');
    $('#globalSearch').value = '';
    renderNav();
    const [view, id, gid] = route();
    const app = $('#app');
    if (READONLY && ['settings', 'orders', 'print', 'check'].indexOf(view) >= 0) { location.hash = '#/dashboard'; return; }
    if (view === 'game' && !(consoleById(id) && consoleById(id).games.some((g) => g.id === gid))) { location.hash = consoleById(id) ? '#/console/' + id : '#/dashboard'; return; }
    if (view === 'console' && consoleById(id)) app.innerHTML = consoleView(consoleById(id));
    else if (view === 'wish' && DB.wishlists[id]) app.innerHTML = wishView(id);
    else if (view === 'orders') app.innerHTML = orderView();
    else if (view === 'settings') app.innerHTML = settingsView();
    else if (view === 'stats') app.innerHTML = statsView();
    else if (view === 'print') app.innerHTML = printView();
    else if (view === 'check') app.innerHTML = checkView();
    else if (view === 'game') app.innerHTML = vitrineView(id, gid);
    else app.innerHTML = dashboardView();
    if (view === 'console') paintConsole();
    if (view === 'wish') paintWish();
    if (view === 'orders') paintOrders();
    if (view === 'check') { paintCheck(); }
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
    if (missing && !READONLY) h += '<div class="notice">⚠️ <b>' + missing + ' jeux n\'ont pas encore de titre.</b> Ouvre un jeu puis « Modifier » pour renseigner son nom.</div>';

    /* Rappel de sauvegarde + espace de stockage */
    const bd = DB.lastBackup ? Math.floor((Date.now() - DB.lastBackup) / 86400000) : null, up = usage() / QUOTA * 100;
    if (!READONLY) h += '<div class="backupbar' + (bd === null || bd > 14 ? ' warn' : '') + '"><span>💾 Dernière sauvegarde : <b>' + ago(DB.lastBackup) + '</b>' + (bd === null || bd > 14 ? ' — pense à sauvegarder tes données' : '') + '</span><button class="btn small primary" data-act="export-json">⬇ Sauvegarder maintenant</button></div>';
    h += unsentBar();
    if (!READONLY && up > 75) h += '<div class="notice">⚠️ Le stockage du navigateur est utilisé à <b>' + Math.round(up) + ' %</b>. Va dans <a href="#/settings">Paramètres</a> pour optimiser tes photos.</div>';

    /* Frise des jaquettes qui défile toute seule (pause quand la souris passe dessus) */
    const covers = [];
    DB.consoles.forEach((c) => c.games.forEach((g) => { if (g.image) covers.push({ c, g }); }));
    if (covers.length) {
      const items = covers.map((x) => '<a href="#/console/' + x.c.id + '" data-act="view-game" data-c="' + x.c.id + '" data-id="' + x.g.id + '" title="' + esc(x.g.nom) + '"><img src="' + esc(x.g.image) + '" alt="' + esc(x.g.nom) + '" loading="lazy"></a>').join('');
      h += '<div class="marquee" style="--d:' + Math.max(40, covers.length * 3) + 's"><div class="marquee-track">' + items + items + '</div></div>';
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
          '<div class="tlogo" style="background:' + (c.logo ? logoBg(c) : 'var(--panel2)') + '">' + (c.logo ? '<img src="' + esc(c.logo) + '" alt="' + esc(c.nom) + '">' : '<b>' + esc(c.nom) + '</b>') + '</div>' +
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
      '<span class="spacer"></span><div class="seg"><button data-act="mode" data-m="table" class="' + (S.mode === 'table' ? 'on' : '') + '">Tableau</button><button data-act="mode" data-m="cards" class="' + (S.mode === 'cards' ? 'on' : '') + '">Cartes</button><button data-act="mode" data-m="wall" class="' + (S.mode === 'wall' ? 'on' : '') + '">Vitrine</button></div>' +
      '<button class="btn primary" data-act="add-game" data-id="' + c.id + '">+ Ajouter un jeu</button></div>';
    const BUILTIN = [['Tous', {}], ['Loose', { statut: 'Loose' }], ['Notice manquante', { statut: 'Notice manquante' }], ['⭐ Collectors', { flag: 'special' }], ['🏆 Platine', { flag: 'platine' }], ['⏳ Estimations anciennes', { flag: 'old' }]];
    const full = (f) => Object.assign({ q: '', statut: '', licence: '', flag: '' }, f);
    const same = (f) => { const x = full(f); return ['q', 'statut', 'licence', 'flag'].every((k) => (F[k] || '') === x[k]); };
    h += '<div class="chips">' + BUILTIN.map((p, i) => '<button class="chip' + (same(p[1]) ? ' on' : '') + '" data-act="preset" data-i="' + i + '">' + p[0] + '</button>').join('') +
      DB.presets.map((p) => '<span class="chip user' + (same(p.f) ? ' on' : '') + '"><button data-act="preset" data-pid="' + p.id + '">' + esc(p.nom) + '</button><button class="x" data-act="del-preset" data-pid="' + p.id + '" title="Supprimer ce filtre">✕</button></span>').join('') +
      '<button class="chip add" data-act="save-preset">💾 Enregistrer ce filtre</button></div>';
    h += '<div id="results"></div>';
    return h;
  }
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
      if (q && !JSON.stringify(g, (key, v) => (key === 'image' || key === 'imageEdition' ? undefined : v)).toLowerCase().includes(q)) return false;
      return true;
    });
    const so = S.sort[c.id];
    if (so) {
      list = list.slice().sort((a, b) => {
        const x = a[so.key], y = b[so.key];
        const r = (typeof x === 'number' || typeof y === 'number' || typeof x === 'boolean') ? (Number(x) || 0) - (Number(y) || 0) : String(x || '').localeCompare(String(y || ''), 'fr');
        return so.dir * r;
      });
    }
    return list;
  }

  const gameTitle = (g) => g.nom ? esc(g.nom) : '<span class="muted">Titre à renseigner</span>';
  const gameIcons = (g) => (g.special ? ' <span class="ico gold" title="Édition spéciale">⭐</span>' : '') + (g.platine ? ' <span class="ico plat" title="Terminé à 100 %">🏆</span>' : '') + (g.gamekey ? ' <span class="ico key" title="Game-Key Card : la cartouche ne contient que la clé de téléchargement">🔑</span>' : '');

  function paintConsole() {
    const c = consoleById(route()[1]); if (!c) return;
    const list = filteredGames(c), dm = tabOf(c) === 'demat';
    const q = list.reduce((s, g) => s + (Number(g.quantite) || 1), 0);
    const v = list.reduce((s, g) => s + (Number(g.prixEstime) || 0) * (Number(g.quantite) || 1), 0);
    let h = '<p class="muted">' + list.length + ' lignes · ' + q + ' exemplaires' + (HIDE_PRICE ? '' : ' · valeur estimée ' + eur(v)) + '</p>';
    if (!list.length) { $('#results').innerHTML = h + '<div class="card">Aucun jeu ne correspond.</div>'; return; }

    if (S.mode === 'wall') {
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
      h += '<div class="tablewrap"><table><thead><tr>' + th('nom', 'Jeu') + (dm ? '' : th('support', c.support) + th('boite', 'Boîte') + th('notice', 'Notice') + th('qualite', 'Qualité')) +
        th('quantite', 'Qté') + th('prixEstime', 'Estimé') + th('achat', 'Prix d\'achat - Magasin') + th('version', 'Version') + th('anneeSortie', 'Sortie') + th('anneeAchat', 'Achat') +
        th('test', 'Test') + th('desc100', '100 %') + '<th>Notes</th><th></th></tr></thead><tbody>';
      list.forEach((g) => {
        h += '<tr class="' + rowClass(g).trim() + '" data-act="view-game" data-c="' + c.id + '" data-id="' + g.id + '" style="cursor:pointer"><td><div class="tcell">' + cover(g, 'sm') +
          '<span class="title">' + gameTitle(g) + gameIcons(g) + '</span>' + (g.verifier ? ' <span class="pill e-mauvais">à vérifier</span>' : '') + '</div></td>' +
          (dm ? '' : '<td>' + pill(g.support) + '</td><td>' + pill(g.boite) + '</td><td>' + pill(g.notice) + '</td><td>' + pill(g.qualite) + '</td>') + '<td class="n">' + g.quantite + '</td><td class="n">' + eur(g.prixEstime) + (g.prixDate ? '<small class="pdate' + (isStale(g) ? ' old' : '') + '">' + (isStale(g) ? '⏳ ' : '') + fdate(g.prixDate) + '</small>' : '') + '</td>' +
          '<td>' + esc(g.achat) + '</td><td>' + esc(g.version) + '</td><td class="n">' + esc(g.anneeSortie) + '</td><td class="n">' + esc(g.anneeAchat) + '</td><td>' + esc(g.test) + '</td>' +
          '<td>' + esc(g.desc100) + '</td><td>' + esc((g.notes || '').slice(0, 70)) + ((g.notes || '').length > 70 ? '…' : '') + '</td>' +
          '<td class="actions"><button class="btn small" data-act="edit-game" data-c="' + c.id + '" data-id="' + g.id + '">✏️</button> <button class="btn small danger" data-act="del-game" data-c="' + c.id + '" data-id="' + g.id + '">🗑</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    $('#results').innerHTML = h;
  }

  /* ---------- 7. Wishlists ---------- */
  function wishView(key) {
    const names = { general: 'Wishlist générale', sonic: 'Wishlist Sonic – Full FR', zelda: 'Wishlist Zelda' };
    const l = DB.wishlists[key];
    const mn = l.reduce((s, w) => s + (w.prixMin || 0) * (w.quantite || 1), 0), mx = l.reduce((s, w) => s + (w.prixMax || 0) * (w.quantite || 1), 0);
    return '<h2 class="page">' + names[key] + '</h2><p class="sub">' + l.length + ' jeux à acheter' + (HIDE_PRICE ? '' : ' · budget estimé ' + eur(mn) + ' à ' + eur(mx) + ' (lignes sans prix chiffré ignorées)') + '</p>' +
      '<div class="toolbar"><input id="wishQ" type="search" placeholder="Filtrer…">' +
      '<label class="muted"><input type="checkbox" id="wishPrio"> Prioritaires</label><label class="muted"><input type="checkbox" id="wishCol"> ⭐ Collectors</label><span class="spacer"></span>' +
      '<div class="seg"><button data-act="wmode" data-m="table" class="' + (S.wishMode === 'table' ? 'on' : '') + '">Tableau</button><button data-act="wmode" data-m="cards" class="' + (S.wishMode === 'cards' ? 'on' : '') + '">Cartes</button></div>' +
      '<button class="btn primary" data-act="add-wish" data-k="' + key + '">+ Ajouter</button></div><div id="results"></div>';
  }
  function paintWish() {
    const key = route()[1], l = DB.wishlists[key];
    const q = ($('#wishQ') || {}).value ? $('#wishQ').value.toLowerCase() : '';
    const prio = $('#wishPrio') && $('#wishPrio').checked, col = $('#wishCol') && $('#wishCol').checked;
    const list = l.filter((w) => (!q || JSON.stringify(w, (k, v) => (k === 'image' || k === 'imageEdition' ? undefined : v)).toLowerCase().includes(q)) && (!prio || w.priorite) && (!col || isCollector(w.collector)));
    const groupOf = (w) => (w.section ? w.section + ' · ' : '') + (w.groupeLabel || 'Groupe ' + (w.groupe + 1));
    let h, last = null;
    if (S.wishMode === 'cards') {
      h = '<div class="grid cards">';
      list.forEach((w) => {
        const g = groupOf(w);
        if (g !== last) { last = g; h += '<div class="cardband">' + esc(g) + '</div>'; }
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
        if (g !== last) { last = g; h += '<tr class="band"><td colspan="8">' + esc(g) + '</td></tr>'; }
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
    const list = DB.commandes.filter((o) => !q || JSON.stringify(o, (k, v) => (k === 'image' || k === 'imageEdition' ? undefined : v)).toLowerCase().includes(q));
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
    return '<h2 class="page">Paramètres</h2><p class="sub">Tes données sont enregistrées dans ce navigateur. Fais régulièrement une sauvegarde JSON.</p>' +
      '<div class="card"><h3>Sauvegarde</h3><p class="muted" style="margin:0 0 10px">Dernière sauvegarde : <b>' + ago(DB.lastBackup) + '</b></p><div class="toolbar" style="margin-top:0"><button class="btn primary" data-act="export-json">⬇ Exporter tout (JSON)</button>' +
      '<label class="btn">⬆ Importer un JSON<input type="file" id="importFile" accept=".json" hidden></label></div></div>' +
      '<div class="card"><h3>Espace de stockage</h3>' + gauge() + legacyBtn() + '<div class="toolbar"><button class="btn" data-act="optimize">🗜 Optimiser mes photos</button></div><p class="muted" style="margin:0">Réduit le poids des photos déjà ajoutées (sans changer leur apparence à l\'écran).</p></div>' +
      '<div class="card"><h3>Prix et estimations</h3><p class="muted" style="margin:0 0 10px">Importe un fichier CSV de prix (par exemple l\'export de ta collection sur PriceCharting) : les estimations des jeux dont le titre correspond sont mises à jour, avec la date du jour.</p>' +
      '<div class="toolbar" style="margin-top:0"><label class="btn">⬆ Importer des prix (CSV)<input type="file" id="priceFile" accept=".csv,.txt" hidden></label>' +
      '<button class="btn" data-act="fresh">Considérer toutes mes estimations comme à jour aujourd\'hui</button><a class="btn" href="https://www.pricecharting.com/" target="_blank" rel="noopener">Ouvrir PriceCharting ↗</a></div></div>' +
      '<div class="card"><h3>Export CSV d\'une console</h3><div class="toolbar">' + DB.consoles.map((c) => '<button class="btn" data-act="export-csv" data-id="' + c.id + '">' + esc(c.nom) + '</button>').join('') + '</div></div>' +
      orderCard() +
      syncCard() + shareCard() +
      '<div class="card"><h3>Zone dangereuse</h3><button class="btn danger" data-act="reset">Revenir aux données de départ</button></div>';
  }

  /* ---------- 10. Formulaires ---------- */
  function encodeCanvas(cv) {
    const w = cv.toDataURL('image/webp', 0.8); /* WebP : léger et garde la transparence */
    return w.indexOf('data:image/webp') === 0 ? w : cv.toDataURL('image/png');
  }
  function resizeImage(file, cb) {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 380 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
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
      file.onchange = () => { if (file.files[0]) resizeImage(file.files[0], (url) => { hid.value = url; prev.src = url; prev.classList.remove('hidden'); }); };
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
    ]);
  }

  function editGame(cid, gid, pre, done) {
    const c = consoleById(cid);
    const isNew = !gid;
    const g = isNew ? Object.assign({ support: c.support === 'CD' ? 'Neuf' : 'Très Bon Etat', quantite: 1 }, pre || {}) : c.games.find((x) => x.id === gid);
    const vals = Object.assign({}, g, { demat: isDemat(g) || !!(pre && pre.demat) });
    openForm(isNew ? 'Ajouter un jeu – ' + c.nom : 'Modifier le jeu', gameFields(c), vals, (v) => {
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
      '<div class="etat plain"><i>🔢</i><div><span>Quantité</span><b>' + esc(g.quantite) + '</b></div></div></div></div>';
  }
  function gMore(g) {
    const info = [['Année de sortie', g.anneeSortie], ['Année d\'achat', g.anneeAchat], ['Version', g.version], ['Licence', g.licence], ['Test', g.test], ['Objectif / avancement 100 %', g.desc100]].filter((r) => r[1]);
    let h = '';
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
      { k: 'logoBgMode', label: 'Fond du logo', type: 'select', opts: ['auto', 'brand', 'white', 'black', 'grey'], names: ['Automatique (adapté au logo)', 'Couleur de la marque', 'Blanc', 'Noir', 'Gris'] },
      { k: 'logo', label: 'Logo de la console (optionnel)', type: 'image', wide: true }], c || { support: 'Cartouche', type: 'salon', logoBgMode: 'auto' }, (v) => {
      v.nom = v.nom || 'Nouvelle console'; v.marque = v.marque || 'Autres'; v.support = v.support || 'Cartouche';
      const gm = guessMeta(v.nom);
      if (v.annee === '' || v.annee == null) { v.annee = gm.annee; if (!c) v.type = gm.type; }
      let target;
      if (c) { if (v.logo !== c.logo) c.logoTone = null; Object.assign(c, v); c.couleur = brandColor(c.marque); target = c; }
      else {
        target = { id: 'c' + uid(), nom: v.nom, marque: v.marque, support: v.support, type: v.type, annee: v.annee, logo: v.logo, logoBgMode: v.logoBgMode, couleur: brandColor(v.marque), machines: [], games: [] };
        DB.consoles.push(target); c2 = target;
      }
      if (target.logo && /^data:/.test(target.logo) && !target.logoTone) computeTone(target.logo, (t) => { target.logoTone = t; save(); renderNav(); refresh(); });
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
      card('Évolution : jeux achetés par année', ys.length ? '<div class="vchart">' + cols + '</div><p class="muted" style="margin:6px 0 0">Σ = total cumulé.' + (unknown ? ' ' + unknown + ' jeux sans année d\'achat ne sont pas comptés.' : '') + '</p>' : '<p class="muted">Renseigne l\'« Année d\'achat » de tes jeux pour voir ce graphique.</p>');
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
      const names = { general: 'Wishlist générale', sonic: 'Wishlist Sonic – Full FR', zelda: 'Wishlist Zelda' };
      Object.keys(DB.wishlists).forEach((k) => {
        const l = DB.wishlists[k].filter((w) => w.nom);
        h += '<h3>' + names[k] + ' <small>(' + l.length + ')</small></h3><ul class="plist wl">' + l.map((w) => '<li>☐ ' + esc(w.nom) + (w.priorite ? ' <b>!</b>' : '') + (w.version ? ' <em>' + esc(w.version) + '</em>' : '') + (w.prix ? ' <span class="pp">' + esc(w.prix) + '</span>' : '') + '</li>').join('') + '</ul>';
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
    return '<h2 class="page">Brocante</h2><p class="sub">Tape un titre : je te dis si tu l\'as déjà, s\'il est dans tes wishlists ou déjà commandé.</p>' +
      '<input id="checkQ" class="bigsearch" type="search" placeholder="Titre du jeu…" autocomplete="off">' +
      (s.token ? '<p><button class="btn small" data-act="sync-pull">⟳ Récupérer la dernière version (cloud)</button> <span class="muted" id="syncMsg">' + syncInfo() + '</span></p>'
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
    if (mine.length) h += '<h3 class="ck ok">✅ Tu l\'as déjà (' + mine.length + ')</h3>' + mine.slice(0, 40).map(({ c, g }) =>
      '<a class="ckrow' + rowClass(g) + '" href="#/game/' + c.id + '/' + g.id + '">' + small(g) + '<div><b>' + esc(g.nom) + '</b><div class="muted">' + esc(c.nom) + (g.version ? ' · ' + esc(g.version) : '') + '</div><div class="row">' + pill(statut(g)) + pill(g.qualite) + '<span class="pill">×' + (g.quantite || 1) + '</span></div></div><b class="ckp">' + eur(g.prixEstime) + '</b></a>').join('');
    if (wish.length) h += '<h3 class="ck wish">⭐ Dans tes wishlists (' + wish.length + ')</h3>' + wish.slice(0, 40).map((w) =>
      '<div class="ckrow">' + small(w) + '<div><b>' + esc(w.nom) + '</b>' + (w.priorite ? ' <span class="pill e-mauvais">priorité</span>' : '') + '<div class="muted">' + esc([w.version, w.description].filter(Boolean).join(' · ')) + '</div></div><b class="ckp">' + esc(w.prix || '') + '</b></div>').join('');
    if (orders.length) h += '<h3 class="ck">📦 Déjà commandé (' + orders.length + ')</h3>' + orders.map((o) => '<div class="ckrow">' + small(o) + '<div><b>' + esc(o.nom) + '</b><div class="muted">' + esc(o.site) + ' · ' + esc(o.statut) + '</div></div></div>').join('');
    if (!mine.length) h = '<div class="ckno">' + (words.join('').length < 3 ? 'Continue à taper…' : '🆕 Pas dans ta collection') + '</div>' + h;
    out.innerHTML = h;
  }

  /* ---------- 9h. Synchronisation PC ↔ téléphone (Gist GitHub privé) ---------- */
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
  async function readGist(id) {
    const g = await gh('/gists/' + id), f = g.files && g.files[SYNC_FILE];
    if (!f) throw new Error('Fichier de sauvegarde introuvable dans le cloud.');
    let text = f.content;
    if (f.truncated || text == null) { const r = await fetch(f.raw_url); if (!r.ok) throw new Error('Lecture impossible (' + r.status + ').'); text = await r.text(); }
    return JSON.parse(text);
  }
  const syncMsg = (t) => { const m = $('#syncMsg'); if (m) m.textContent = t; };
  function syncSaveToken() { const i = $('#syncToken'); if (i) setSync({ token: i.value.trim() }); }
  async function cloudPush() {
    try {
      syncSaveToken(); syncMsg('Envoi en cours…');
      const id = await findGist(), body = { description: 'Collection Fazerbleu (sauvegarde privée)', files: {} };
      if (id) {
        const remote = await readGist(id), s = sync();
        const nG = (x) => (x.consoles || []).reduce((n, c) => n + c.games.length, 0);
        if (nG(DB) === 0 && nG(remote) > 0) { syncMsg('Envoi bloqué : cet appareil est vide alors que ton cloud contient ta collection. Utilise « Récupérer depuis le cloud ».'); return; }
        if (remote.modified && remote.modified !== s.lastRemote && !confirm('Le cloud contient des modifications faites depuis un autre appareil. Les écraser avec les données de cet appareil ?')) { syncMsg('Envoi annulé.'); return; }
      }
      body.files[SYNC_FILE] = { content: JSON.stringify(DB) };
      if (id) await gh('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) });
      else { body.public = false; const g = await gh('/gists', { method: 'POST', body: JSON.stringify(body) }); setSync({ gistId: g.id }); }
      setSync({ last: Date.now(), lastRemote: DB.modified }); syncMsg(syncInfo()); toast('Collection envoyée dans le cloud'); renderNav(); if (['dashboard', ''].indexOf(route()[0]) >= 0) router();
    } catch (e) { syncMsg(e.message); toast(e.message); }
  }
  async function cloudPull() {
    try {
      syncSaveToken(); syncMsg('Récupération en cours…');
      const id = await findGist(); if (!id) throw new Error('Aucune sauvegarde trouvée : envoie d\'abord depuis ton ordinateur.');
      const d = await readGist(id);
      if (!d.consoles || !d.wishlists) throw new Error('Sauvegarde illisible.');
      if (DB.consoles.some((c) => c.games.length) && !confirm('Remplacer les données de cet appareil par celles du cloud (' + d.consoles.reduce((n, c) => n + c.games.length, 0) + ' jeux) ?')) { syncMsg('Récupération annulée.'); return; }
      DB = migrate(d); normalize(DB); lastSer = null; save(); setSync({ last: Date.now(), lastRemote: DB.modified });
      router(); toast('Collection mise à jour depuis le cloud');
    } catch (e) { syncMsg(e.message); toast(e.message); }
  }
  function syncCard() {
    const s = sync();
    return '<div class="card"><h3>📱 Synchronisation ordinateur ↔ téléphone</h3>' +
      '<p class="muted" style="margin:0 0 10px">Envoie ta collection dans un <b>cloud privé</b> (un « Gist secret » de ton compte GitHub, visible par toi seul), puis récupère-la sur ton téléphone. Le jeton reste uniquement dans ce navigateur.</p>' +
      '<label class="muted" style="display:block;margin-bottom:6px">Jeton GitHub</label><input type="password" id="syncToken" class="bigsearch" style="max-width:420px" value="' + esc(s.token || '') + '" placeholder="ghp_…" autocomplete="off">' +
      '<div class="toolbar"><button class="btn primary" data-act="sync-push">⬆ Envoyer vers le cloud</button><button class="btn" data-act="sync-pull">⬇ Récupérer depuis le cloud</button></div>' +
      '<p class="muted" id="syncMsg" style="margin:0">' + syncInfo() + '</p>' +
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
  const unsentBar = () => unsent() ? '<div class="backupbar warn"><span>☁️ Tu as des <b>modifications non envoyées</b> vers le cloud.</span><button class="btn small primary" data-act="sync-push">⬆ Envoyer maintenant</button></div>' : '';

  function welcomeView() {
    const s = sync();
    return '<h2 class="page">Bienvenue 👋</h2><p class="sub">Cet appareil ne contient pas encore ta collection.</p>' +
      '<div class="card"><h3>☁️ Récupérer ma collection depuis le cloud</h3><p class="muted" style="margin:0 0 10px">Colle ton jeton GitHub (le même que sur ton ordinateur), puis clique sur « Récupérer ». Pour le créer : Paramètres → Synchronisation → « Comment créer le jeton ».</p>' +
      '<input type="password" id="syncToken" class="bigsearch" style="max-width:420px" value="' + esc(s.token || '') + '" placeholder="ghp_…" autocomplete="off">' +
      '<div class="toolbar"><button class="btn primary" data-act="sync-pull">⬇ Récupérer depuis le cloud</button></div><p class="muted" id="syncMsg" style="margin:0"></p></div>' +
      '<div class="card"><h3>📂 Importer un fichier de sauvegarde</h3><label class="btn">⬆ Importer un JSON<input type="file" id="importFile" accept=".json" hidden></label></div>' +
      '<div class="card"><h3>✨ Commencer une collection vide</h3><div class="toolbar" style="margin-top:0"><button class="btn" data-act="new-console">+ Créer ma première console</button></div></div>';
  }

  const SHARE_FILE = 'partage-fazerbleu.json';
  const shareOpts = () => Object.assign({ prix: false, wish: false, notes: false }, sync().share || {});
  /* Copie « amis » : ce qui n'est pas choisi n'est PAS dans la copie (pas seulement caché) */
  function shareCopy(o) {
    const d = clone(DB);
    d.commandes = []; d.presets = []; d.lastBackup = 0; d.share = { prix: !!o.prix, wish: !!o.wish, notes: !!o.notes, at: Date.now() };
    Object.keys(d.wishlists).forEach((k) => { if (!o.wish) d.wishlists[k] = []; else d.wishlists[k].forEach((w) => { if (!o.prix) { delete w.prix; delete w.prixMin; delete w.prixMax; } }); });
    d.consoles.forEach((c) => {
      c.machines.forEach((m) => { delete m.achat; delete m.serie; delete m.valeurDate; if (!o.notes) delete m.note; if (!o.prix) delete m.valeur; });
      c.games.forEach((g) => { ['achat', 'prixAchat', 'anneeAchat', 'prixDate'].forEach((k) => { delete g[k]; }); if (!o.notes) delete g.notes; if (!o.prix) delete g.prixEstime; });
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
      $('#app').insertAdjacentHTML('beforebegin', '<div class="robar">👀 Mode lecture seule — tu consultes la collection de Fazerbleu.</div>');
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
      '<div class="card"><h3>Fond des logos de consoles</h3><div class="toolbar" style="margin-top:0"><div class="seg"><button data-act="logostyle" data-m="auto" class="' + (DB.logoStyle !== 'brand' ? 'on' : '') + '">Adapté à chaque logo</button><button data-act="logostyle" data-m="brand" class="' + (DB.logoStyle === 'brand' ? 'on' : '') + '">Couleur de la marque</button></div></div>' +
      '<p class="muted" style="margin:0">« Adapté » choisit un fond clair ou foncé selon le logo pour qu\'il reste lisible. « Couleur de la marque » : rouge Nintendo, noir SEGA, bleu PlayStation. Chaque console peut aussi avoir son propre fond (✏️ Modifier la console).</p></div>';
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

  /* ---------- 11. Recherche globale ---------- */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) { router(); return; }
    const hit = (o) => JSON.stringify(o, (k, v) => (k === 'image' || k === 'imageEdition' ? undefined : v)).toLowerCase().includes(q);
    let h = '<h2 class="page">Résultats pour « ' + esc(q) + ' »</h2>', n = 0;
    DB.consoles.forEach((c) => {
      const r = c.games.filter(hit);
      if (!r.length) return; n += r.length;
      h += '<div class="card"><h3>' + esc(c.nom) + ' (' + r.length + ')</h3>' + r.map((g) => '<div class="hit"><a href="#/console/' + c.id + '" data-act="view-game" data-c="' + c.id + '" data-id="' + g.id + '">' + esc(g.nom || 'Titre à renseigner') + '</a>' + gameIcons(g) + ' <span class="muted">· ' + esc(g.licence) + ' · ' + esc(g.achat) + ' · ' + esc((g.notes || '').slice(0, 60)) + '</span></div>').join('') + '</div>';
    });
    Object.keys(DB.wishlists).forEach((k) => {
      const r = DB.wishlists[k].filter(hit);
      if (!r.length) return; n += r.length;
      h += '<div class="card"><h3>Wishlist ' + k + ' (' + r.length + ')</h3>' + r.map((w) => '<div class="hit">' + esc(w.nom || 'Jeu à identifier') + ' <span class="muted">· ' + esc(w.description) + ' · ' + esc(w.prix) + '</span></div>').join('') + '</div>';
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
  function refresh() { const v = route()[0]; if (v === 'console') { $('#app').innerHTML = consoleView(consoleById(route()[1])); paintConsole(); } else router(); }
  const delConfirm = (msg, fn) => { if (confirm(msg)) { fn(); save(); closeModal(); renderNav(); refresh(); } };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const d = t.dataset;
    if (READONLY && ['mode', 'sort', 'zoom', 'view-game', 'vswap', 'open-vitrine', 'tab', 'wmode', 'view-wish', 'preset'].indexOf(d.act) < 0) { e.preventDefault(); return; }
    if (t.tagName === 'A' && d.act === 'view-game') e.preventDefault();
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
      case 'reset': if (confirm('Effacer toutes tes modifications et revenir aux données de départ ?')) { try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } DB = clone(INITIAL_DATA); normalize(DB); lastSer = null; save(); router(); toast('Données réinitialisées'); } break;
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
    if (t.id === 'wishQ') paintWish();
    if (t.id === 'orderQ') paintOrders();
    if (t.id === 'checkQ') paintCheck();
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.f) { S.filters[route()[1]][t.dataset.f] = t.value; paintConsole(); }
    if (t.id === 'wishPrio' || t.id === 'wishCol') paintWish();
    if (t.id === 'priceFile' && t.files[0]) readPriceFile(t.files[0]);
    if (t.id === 'importFile' && t.files[0] && !READONLY) {
      const r = new FileReader();
      r.onload = () => {
        try { const d = JSON.parse(r.result); if (!d.consoles || !d.wishlists) throw 0; DB = migrate(d); normalize(DB); save(); router(); toast('Import réussi'); }
        catch (err) { toast('Fichier invalide'); }
      };
      r.readAsText(t.files[0]);
    }
  });
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
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
    navigator.serviceWorker.register('sw.js').catch(() => {});
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
