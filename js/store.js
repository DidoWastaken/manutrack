/* =========================================================================
 * ManuTrack — Data layer (localStorage)
 * -------------------------------------------------------------------------
 * Unico punto di accesso ai dati. La UI non tocca mai localStorage
 * direttamente: chiama Store.*  ->  così sostituire questo file con chiamate
 * fetch() a un backend reale (Express/Mongo) non richiede toccare la UI.
 *
 * Collezioni: clienti, impianti, interventi.
 * ========================================================================= */

const Store = (() => {
  'use strict';

  const KEY = 'manutrack:v1';

  /* Stato in memoria (specchio di localStorage) */
  let db = null;

  /* ---- ID semplici e ordinabili ---- */
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function nowISO() { return new Date().toISOString(); }

  /* ---- Persistenza ---- */
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { db = JSON.parse(raw); return; }
      catch (e) { console.warn('DB corrotto, rigenero seed', e); }
    }
    db = seed();
    persist();
  }

  /* =======================================================================
   * SEED — dati demo realistici così l'app è "viva" alla prima apertura.
   * Le date sono relative a oggi per mostrare scadute / in scadenza / ok.
   * ===================================================================== */
  function seed() {
    const oggi = new Date();
    const meseFa   = (m) => { const d = new Date(oggi); d.setMonth(d.getMonth() - m); return d.toISOString(); };
    const giorniFa = (g) => { const d = new Date(oggi); d.setDate(d.getDate() - g); return d.toISOString(); };

    const c1 = uid('cli'), c2 = uid('cli'), c3 = uid('cli'), c4 = uid('cli'), c5 = uid('cli');
    const clienti = [
      { id: c1, ragioneSociale: 'Trattoria Da Beppe',        referente: 'Giuseppe Mori',  telefono: '0577 123456', email: 'beppe@trattoriadabeppe.it', indirizzo: 'Via Roma 12',        citta: 'Siena',      note: 'Cucina sempre attiva, intervenire prima delle 11', createdAt: nowISO() },
      { id: c2, ragioneSociale: 'Hotel Le Colline',          referente: 'Anna Verdi',     telefono: '055 998877',  email: 'tecnico@lecolline.it',       indirizzo: 'Strada Provinciale 7', citta: 'Firenze',    note: '3 piani, locale caldaia interrato',               createdAt: nowISO() },
      { id: c3, ragioneSociale: 'Condominio Aurora',         referente: 'Amm. Bianchi',   telefono: '055 445566',  email: 'studio@ammbianchi.it',       indirizzo: 'Viale Europa 88',     citta: 'Prato',      note: 'Centrale termica condominiale',                   createdAt: nowISO() },
      { id: c4, ragioneSociale: 'Supermercato FreshMarket',  referente: 'Luca Pini',      telefono: '0573 221100', email: 'pini@freshmarket.it',        indirizzo: 'Via dell\'Industria 4',citta: 'Pistoia',    note: 'Banchi frigo + celle, F-Gas importante',          createdAt: nowISO() },
      { id: c5, ragioneSociale: 'Studio Dentistico Sereni',  referente: 'Dr.ssa Sereni',  telefono: '0577 332211', email: 'info@studiosereni.it',       indirizzo: 'Corso Italia 30',     citta: 'Siena',      note: 'Clima sale operatorie sempre acceso',             createdAt: nowISO() },
    ];

    const i1 = uid('imp'), i2 = uid('imp'), i3 = uid('imp'), i4 = uid('imp'),
          i5 = uid('imp'), i6 = uid('imp'), i7 = uid('imp');
    const impianti = [
      { id: i1, clienteId: c1, tipo: 'caldaia_gas',     marca: 'Vaillant',  modello: 'ecoTEC plus', matricola: 'VG-2019-0042', potenzaKw: 35,  fgasTonnCO2: 0,   dataInstallazione: '2019-03-10', ubicazione: 'Cucina',          note: '' },
      { id: i2, clienteId: c2, tipo: 'caldaia_gas',     marca: 'Riello',    modello: 'Family Condens',matricola: 'RL-2021-1180', potenzaKw: 120, fgasTonnCO2: 0,   dataInstallazione: '2021-09-01', ubicazione: 'Locale caldaia',  note: 'Potenza >100kW: controllo ogni 2 anni' },
      { id: i3, clienteId: c3, tipo: 'caldaia_gasolio', marca: 'Ferroli',   modello: 'PREXTHERM',   matricola: 'FE-2016-0777', potenzaKw: 230, fgasTonnCO2: 0,   dataInstallazione: '2016-11-20', ubicazione: 'Centrale termica',note: 'Gasolio >100kW: controllo annuale' },
      { id: i4, clienteId: c4, tipo: 'frigo',           marca: 'Epta',      modello: 'Costan',      matricola: 'EP-2020-5520', potenzaKw: 18,  fgasTonnCO2: 62,  dataInstallazione: '2020-05-15', ubicazione: 'Banchi vendita',  note: 'R404A, 62 t CO2eq -> F-Gas ogni 6 mesi' },
      { id: i5, clienteId: c4, tipo: 'frigo',           marca: 'Daikin',    modello: 'Cella -20',   matricola: 'DK-2022-3310', potenzaKw: 12,  fgasTonnCO2: 28,  dataInstallazione: '2022-02-10', ubicazione: 'Magazzino',       note: '28 t CO2eq -> F-Gas ogni 12 mesi' },
      { id: i6, clienteId: c5, tipo: 'clima',           marca: 'Mitsubishi',modello: 'VRF City',    matricola: 'MT-2021-4401', potenzaKw: 45,  fgasTonnCO2: 9,   dataInstallazione: '2021-06-30', ubicazione: 'Tetto',           note: '9 t CO2eq -> F-Gas ogni 12 mesi' },
      { id: i7, clienteId: c2, tipo: 'pompa_calore',    marca: 'Daikin',    modello: 'Altherma',    matricola: 'DK-2023-9087', potenzaKw: 16,  fgasTonnCO2: 3,   dataInstallazione: '2023-04-12', ubicazione: 'Cortile',         note: 'Sotto 5 t CO2eq -> niente F-Gas periodico' },
    ];

    /* Interventi passati -> generano una scadenza realistica per ogni stato:
     * SCADUTE: i1 (CEE), i4 (F-Gas)
     * IN SCADENZA: i2 (CEE ~tra 12 gg), i5 (F-Gas ~tra 20 gg)
     * IN REGOLA: i3, i6 (CEE+F-Gas), i7 (CEE) */
    const interventi = [
      { id: uid('int'), impiantoId: i1, tipo: 'controllo_efficienza', data: meseFa(50),      esito: 'conforme',        tecnico: 'Marco R.', note: 'Combustione ok, sostituito elettrodo', rapportinoN: 'RAP-0007' },
      { id: uid('int'), impiantoId: i2, tipo: 'controllo_efficienza', data: giorniFa(708),   esito: 'conforme',        tecnico: 'Marco R.', note: '',                          rapportinoN: 'RAP-0011' },
      { id: uid('int'), impiantoId: i3, tipo: 'controllo_efficienza', data: meseFa(4),       esito: 'conforme',        tecnico: 'Sara T.',  note: 'Bruciatore tarato',         rapportinoN: 'RAP-0015' },
      { id: uid('int'), impiantoId: i4, tipo: 'fgas_perdite',         data: meseFa(7),       esito: 'nessuna perdita', tecnico: 'Sara T.',  note: 'Annotato su Banca Dati F-Gas', rapportinoN: 'RAP-0009' },
      { id: uid('int'), impiantoId: i4, tipo: 'manutenzione',         data: meseFa(1),       esito: 'conforme',        tecnico: 'Sara T.',  note: 'Pulizia condensatore banchi', rapportinoN: 'RAP-0017' },
      { id: uid('int'), impiantoId: i5, tipo: 'fgas_perdite',         data: giorniFa(340),   esito: 'nessuna perdita', tecnico: 'Marco R.', note: '',                          rapportinoN: 'RAP-0013' },
      { id: uid('int'), impiantoId: i6, tipo: 'controllo_efficienza', data: meseFa(8),       esito: 'conforme',        tecnico: 'Marco R.', note: '',                          rapportinoN: 'RAP-0014' },
      { id: uid('int'), impiantoId: i6, tipo: 'fgas_perdite',         data: meseFa(2),       esito: 'nessuna perdita', tecnico: 'Marco R.', note: '',                          rapportinoN: 'RAP-0018' },
    ];

    return { clienti, impianti, interventi, contatoreRapportino: 19, createdAt: nowISO() };
  }

  /* =======================================================================
   * API pubblica
   * ===================================================================== */
  function all(coll)  { return db[coll].slice(); }
  function byId(coll, id) { return db[coll].find(x => x.id === id) || null; }

  function mapById(coll) {
    const m = {};
    db[coll].forEach(x => { m[x.id] = x; });
    return m;
  }

  function create(coll, obj) {
    const prefix = { clienti: 'cli', impianti: 'imp', interventi: 'int' }[coll] || 'obj';
    const rec = { id: uid(prefix), ...obj };
    if (coll === 'clienti') rec.createdAt = nowISO();
    db[coll].push(rec);
    persist();
    return rec;
  }

  function update(coll, id, patch) {
    const rec = byId(coll, id);
    if (!rec) return null;
    Object.assign(rec, patch);
    persist();
    return rec;
  }

  function remove(coll, id) {
    db[coll] = db[coll].filter(x => x.id !== id);
    // pulizia a cascata
    if (coll === 'clienti') {
      const impEliminati = db.impianti.filter(i => i.clienteId === id).map(i => i.id);
      db.impianti = db.impianti.filter(i => i.clienteId !== id);
      db.interventi = db.interventi.filter(i => !impEliminati.includes(i.impiantoId));
    }
    if (coll === 'impianti') {
      db.interventi = db.interventi.filter(i => i.impiantoId !== id);
    }
    persist();
  }

  function nextRapportino() {
    const n = db.contatoreRapportino || 1;
    db.contatoreRapportino = n + 1;
    persist();
    return 'RAP-' + String(n).padStart(4, '0');
  }

  function resetDemo() {
    db = seed();
    persist();
  }

  function exportJSON() {
    return JSON.stringify(db, null, 2);
  }

  return {
    load, all, byId, mapById, create, update, remove,
    nextRapportino, resetDemo, exportJSON,
  };
})();
