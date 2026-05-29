/* =========================================================================
 * Boilerly — UI / Router
 * -------------------------------------------------------------------------
 * Mini-SPA senza framework: una funzione render per vista, lo stato vive in
 * Store (localStorage) e in COMPLIANCE per le scadenze. Niente dipendenze.
 * ========================================================================= */
(() => {
  'use strict';

  Store.load();

  /* --------------------------- Helpers --------------------------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const fmtData = (d) => {
    if (!d) return '—';
    const date = (d instanceof Date) ? d : new Date(d);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const fmtGiorni = (g) => {
    if (g < 0)  return `scaduta da ${Math.abs(g)} gg`;
    if (g === 0) return 'scade oggi';
    if (g === 1) return 'tra 1 giorno';
    return `tra ${g} giorni`;
  };
  const labelStato = (s) => ({ scaduta: 'Scaduta', in_scadenza: 'In scadenza', ok: 'In regola' }[s] || s);

  function toast(msg, ok = true) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (ok ? ' toast--ok' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* --------------------------- Modal --------------------------- */
  const modal = $('#modal');
  function openModal(title, bodyEl) {
    $('#modal-title').textContent = title;
    const body = $('#modal-body');
    body.innerHTML = '';
    body.appendChild(bodyEl);
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; }
  modal.addEventListener('click', e => { if (e.target.dataset.close !== undefined) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* =======================================================================
   * VIEW: Dashboard
   * ===================================================================== */
  function viewDashboard() {
    const clientiById = Store.mapById('clienti');
    const impianti = Store.all('impianti');
    const interventi = Store.all('interventi');
    const scadenze = COMPLIANCE.tutteLeScadenze(impianti, interventi, clientiById);

    const scadute = scadenze.filter(s => s.stato === 'scaduta');
    const inScad  = scadenze.filter(s => s.stato === 'in_scadenza');
    const ok      = scadenze.filter(s => s.stato === 'ok');

    setTitle('Dashboard', `${Store.all('clienti').length} clienti · ${impianti.length} impianti monitorati`);
    setActions(`<button class="btn btn--primary" id="act-add-interv">+ Registra intervento</button>`);

    const prossime = scadenze.filter(s => s.stato !== 'ok' || s.giorni <= 120).slice(0, 8);

    const view = $('#view');
    view.innerHTML = `
      <div class="kpis">
        <div class="kpi kpi--danger"><div class="kpi__label">Scadute</div><div class="kpi__value">${scadute.length}</div><div class="kpi__hint">richiedono intervento ora</div></div>
        <div class="kpi kpi--warn"><div class="kpi__label">In scadenza (30 gg)</div><div class="kpi__value">${inScad.length}</div><div class="kpi__hint">da pianificare</div></div>
        <div class="kpi kpi--ok"><div class="kpi__label">In regola</div><div class="kpi__value">${ok.length}</div><div class="kpi__hint">controlli a posto</div></div>
        <div class="kpi"><div class="kpi__label">Fatturato a rischio*</div><div class="kpi__value">€${(scadute.length * 110).toLocaleString('it-IT')}</div><div class="kpi__hint">interventi non ancora schedulati</div></div>
      </div>

      ${scadute.length
        ? `<div class="alert-bar"><strong>⚠ ${scadute.length} controlli scaduti.</strong> Senza registrazione il cliente è fuori norma (sanzioni e responsabilità). Pianificali subito.</div>`
        : `<div class="alert-bar ok">✓ Nessuna scadenza scaduta. Tutti gli impianti sono sotto controllo.</div>`}

      <div class="grid-2">
        <div class="panel">
          <div class="panel__head"><h3>Prossime scadenze</h3><span class="muted">ordinate per urgenza</span></div>
          <table class="table">
            <thead><tr><th>Stato</th><th>Cliente / Impianto</th><th>Controllo</th><th>Scadenza</th><th></th></tr></thead>
            <tbody>
              ${prossime.map(s => `
                <tr class="clickable" data-imp="${s.impianto.id}">
                  <td><span class="pill pill--${s.stato}">${labelStato(s.stato)}</span></td>
                  <td><div class="strong">${esc(s.cliente ? s.cliente.ragioneSociale : '—')}</div><div class="sub">${COMPLIANCE.TIPI_IMPIANTO[s.impianto.tipo].icona} ${esc(s.impianto.marca)} ${esc(s.impianto.modello)}</div></td>
                  <td>${esc(s.label)}<div class="sub">${esc(s.normativa)}</div></td>
                  <td>${fmtData(s.prossima)}<div class="sub">${fmtGiorni(s.giorni)}</div></td>
                  <td class="row-actions"><button class="btn btn--sm" data-remind="${s.impianto.id}" data-tipo="${s.tipo}">Promemoria</button></td>
                </tr>`).join('') || `<tr><td colspan="5"><div class="empty">Nessuna scadenza imminente.</div></td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel__head"><h3>Ultimi interventi</h3></div>
          <table class="table">
            <tbody>
              ${interventi.slice().sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,7).map(i => {
                const imp = Store.byId('impianti', i.impiantoId);
                const cli = imp ? clientiById[imp.clienteId] : null;
                return `<tr>
                  <td><div class="strong">${esc(cli ? cli.ragioneSociale : '—')}</div><div class="sub">${esc(TIPO_INTERVENTO[i.tipo] || i.tipo)} · ${esc(i.tecnico||'')}</div></td>
                  <td style="text-align:right">${fmtData(i.data)}<div class="sub">${esc(i.rapportinoN||'')}</div></td>
                </tr>`;
              }).join('') || `<tr><td><div class="empty">Nessun intervento.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <p class="hint" style="margin-top:18px">* Stima indicativa basata su una tariffa media di 110 € per intervento di controllo. Le frequenze possono variare in base alla normativa regionale (bollino).</p>
    `;

    $('#act-add-interv').onclick = () => formIntervento();
    $$('tr[data-imp]').forEach(tr => tr.onclick = (e) => { if (!e.target.closest('[data-remind]')) dettaglioImpianto(tr.dataset.imp); });
    $$('[data-remind]').forEach(b => b.onclick = (e) => { e.stopPropagation(); promemoria(b.dataset.remind, b.dataset.tipo); });
  }

  /* =======================================================================
   * VIEW: Scadenze
   * ===================================================================== */
  let scadFilter = 'tutte';
  function viewScadenze() {
    const clientiById = Store.mapById('clienti');
    const scadenze = COMPLIANCE.tutteLeScadenze(Store.all('impianti'), Store.all('interventi'), clientiById);

    setTitle('Scadenzario', 'Tutti i controlli di legge calcolati automaticamente');
    setActions(`
      <select class="select" id="scad-filter">
        <option value="tutte">Tutte le scadenze</option>
        <option value="scaduta">Solo scadute</option>
        <option value="in_scadenza">In scadenza (30 gg)</option>
        <option value="ok">In regola</option>
      </select>`);
    $('#scad-filter').value = scadFilter;
    $('#scad-filter').onchange = (e) => { scadFilter = e.target.value; renderScadTable(); };

    $('#view').innerHTML = `<div class="panel"><div id="scad-table"></div></div>`;
    renderScadTable();

    function renderScadTable() {
      const rows = scadenze.filter(s => scadFilter === 'tutte' || s.stato === scadFilter);
      $('#scad-table').innerHTML = `
        <table class="table">
          <thead><tr><th>Stato</th><th>Cliente</th><th>Impianto</th><th>Controllo</th><th>Ultimo</th><th>Scadenza</th><th></th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr class="clickable" data-imp="${s.impianto.id}">
                <td><span class="pill pill--${s.stato}">${labelStato(s.stato)}</span></td>
                <td class="strong">${esc(s.cliente ? s.cliente.ragioneSociale : '—')}</td>
                <td>${COMPLIANCE.TIPI_IMPIANTO[s.impianto.tipo].icona} ${esc(s.impianto.marca)} ${esc(s.impianto.modello)}<div class="sub">${esc(s.impianto.ubicazione||'')}</div></td>
                <td>${esc(s.label)}<div class="sub">${esc(s.normativa)} · ogni ${esc(s.ogni)}</div></td>
                <td>${fmtData(s.ultima)}</td>
                <td>${fmtData(s.prossima)}<div class="sub">${fmtGiorni(s.giorni)}</div></td>
                <td class="row-actions">
                  <button class="btn btn--sm" data-remind="${s.impianto.id}" data-tipo="${s.tipo}">Promemoria</button>
                  <button class="btn btn--sm btn--primary" data-done="${s.impianto.id}" data-tipo="${s.tipo}">Registra</button>
                </td>
              </tr>`).join('') || `<tr><td colspan="7"><div class="empty">Nessuna scadenza in questa categoria.</div></td></tr>`}
          </tbody>
        </table>`;

      $$('#scad-table tr[data-imp]').forEach(tr => tr.onclick = (e) => {
        if (e.target.closest('button')) return;
        dettaglioImpianto(tr.dataset.imp);
      });
      $$('#scad-table [data-remind]').forEach(b => b.onclick = (e) => { e.stopPropagation(); promemoria(b.dataset.remind, b.dataset.tipo); });
      $$('#scad-table [data-done]').forEach(b => b.onclick = (e) => { e.stopPropagation(); formIntervento({ impiantoId: b.dataset.done, tipo: b.dataset.tipo }); });
    }
  }

  /* =======================================================================
   * VIEW: Clienti
   * ===================================================================== */
  let clientiSearch = '';
  function viewClienti() {
    const clienti = Store.all('clienti');
    const impianti = Store.all('impianti');
    setTitle('Clienti', `${clienti.length} aziende in anagrafica`);
    setActions(`<button class="btn btn--primary" id="act-add-cli">+ Nuovo cliente</button>`);

    $('#view').innerHTML = `
      <div class="toolbar"><input class="search" id="cli-search" placeholder="Cerca cliente, città…" value="${esc(clientiSearch)}"/></div>
      <div class="panel"><div id="cli-table"></div></div>`;

    $('#act-add-cli').onclick = () => formCliente();
    const inp = $('#cli-search');
    inp.oninput = () => { clientiSearch = inp.value; render(); };
    render();

    function render() {
      const q = clientiSearch.trim().toLowerCase();
      const list = clienti.filter(c => !q || `${c.ragioneSociale} ${c.citta} ${c.referente}`.toLowerCase().includes(q));
      $('#cli-table').innerHTML = `
        <table class="table">
          <thead><tr><th>Cliente</th><th>Referente</th><th>Contatti</th><th>Impianti</th><th></th></tr></thead>
          <tbody>
            ${list.map(c => {
              const n = impianti.filter(i => i.clienteId === c.id).length;
              return `<tr class="clickable" data-cli="${c.id}">
                <td><div class="strong">${esc(c.ragioneSociale)}</div><div class="sub">${esc(c.indirizzo||'')}, ${esc(c.citta||'')}</div></td>
                <td>${esc(c.referente||'—')}</td>
                <td>${esc(c.telefono||'—')}<div class="sub">${esc(c.email||'')}</div></td>
                <td><span class="tag">⚙ ${n}</span></td>
                <td class="row-actions">
                  <button class="btn btn--sm" data-edit="${c.id}">Modifica</button>
                  <button class="btn btn--sm btn--danger" data-del="${c.id}">Elimina</button>
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="5"><div class="empty"><div class="empty__ico">👥</div><p>Nessun cliente. Aggiungine uno per iniziare.</p></div></td></tr>`}
          </tbody>
        </table>`;

      $$('#cli-table tr[data-cli]').forEach(tr => tr.onclick = (e) => {
        if (e.target.closest('button')) return;
        dettaglioCliente(tr.dataset.cli);
      });
      $$('#cli-table [data-edit]').forEach(b => b.onclick = () => formCliente(Store.byId('clienti', b.dataset.edit)));
      $$('#cli-table [data-del]').forEach(b => b.onclick = () => confermaElimina('clienti', b.dataset.del, 'cliente', 'Verranno eliminati anche i suoi impianti e interventi.'));
    }
  }

  /* =======================================================================
   * VIEW: Impianti
   * ===================================================================== */
  let impSearch = '';
  function viewImpianti() {
    const impianti = Store.all('impianti');
    const clientiById = Store.mapById('clienti');
    const interventi = Store.all('interventi');
    setTitle('Impianti', `${impianti.length} impianti monitorati`);
    setActions(`<button class="btn btn--primary" id="act-add-imp">+ Nuovo impianto</button>`);

    $('#view').innerHTML = `
      <div class="toolbar"><input class="search" id="imp-search" placeholder="Cerca marca, matricola, cliente…" value="${esc(impSearch)}"/></div>
      <div class="panel"><div id="imp-table"></div></div>`;

    $('#act-add-imp').onclick = () => formImpianto();
    const inp = $('#imp-search');
    inp.oninput = () => { impSearch = inp.value; render(); };
    render();

    function render() {
      const q = impSearch.trim().toLowerCase();
      const list = impianti.filter(i => {
        const cli = clientiById[i.clienteId];
        return !q || `${i.marca} ${i.modello} ${i.matricola} ${cli ? cli.ragioneSociale : ''}`.toLowerCase().includes(q);
      });
      $('#imp-table').innerHTML = `
        <table class="table">
          <thead><tr><th>Impianto</th><th>Cliente</th><th>Dati</th><th>Prossima scadenza</th><th></th></tr></thead>
          <tbody>
            ${list.map(i => {
              const cli = clientiById[i.clienteId];
              const sc = COMPLIANCE.computeScadenze(i, interventi).sort((a,b)=>a.giorni-b.giorni)[0];
              return `<tr class="clickable" data-imp="${i.id}">
                <td><div class="strong">${COMPLIANCE.TIPI_IMPIANTO[i.tipo].icona} ${esc(i.marca)} ${esc(i.modello)}</div><div class="sub">${COMPLIANCE.TIPI_IMPIANTO[i.tipo].label} · ${esc(i.matricola||'')}</div></td>
                <td>${esc(cli ? cli.ragioneSociale : '—')}<div class="sub">${esc(i.ubicazione||'')}</div></td>
                <td>${i.potenzaKw||0} kW${i.fgasTonnCO2 ? ` · ${i.fgasTonnCO2} t CO₂eq` : ''}</td>
                <td>${sc ? `<span class="pill pill--${sc.stato}">${labelStato(sc.stato)}</span> <span class="sub">${fmtData(sc.prossima)}</span>` : '—'}</td>
                <td class="row-actions">
                  <button class="btn btn--sm" data-edit="${i.id}">Modifica</button>
                  <button class="btn btn--sm btn--danger" data-del="${i.id}">Elimina</button>
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="5"><div class="empty"><div class="empty__ico">⚙</div><p>Nessun impianto.</p></div></td></tr>`}
          </tbody>
        </table>`;

      $$('#imp-table tr[data-imp]').forEach(tr => tr.onclick = (e) => {
        if (e.target.closest('button')) return;
        dettaglioImpianto(tr.dataset.imp);
      });
      $$('#imp-table [data-edit]').forEach(b => b.onclick = () => formImpianto(Store.byId('impianti', b.dataset.edit)));
      $$('#imp-table [data-del]').forEach(b => b.onclick = () => confermaElimina('impianti', b.dataset.del, 'impianto', 'Verranno eliminati anche i suoi interventi.'));
    }
  }

  /* =======================================================================
   * VIEW: Interventi
   * ===================================================================== */
  const TIPO_INTERVENTO = {
    controllo_efficienza: 'Controllo efficienza energetica',
    fgas_perdite: 'Controllo perdite F-Gas',
    manutenzione: 'Manutenzione ordinaria',
    riparazione: 'Riparazione / guasto',
    installazione: 'Installazione / primo avvio',
  };
  function viewInterventi() {
    const interventi = Store.all('interventi').slice().sort((a,b)=>new Date(b.data)-new Date(a.data));
    const clientiById = Store.mapById('clienti');
    setTitle('Interventi', `${interventi.length} interventi registrati`);
    setActions(`<button class="btn btn--primary" id="act-add-interv">+ Registra intervento</button>`);

    $('#view').innerHTML = `
      <div class="panel"><table class="table">
        <thead><tr><th>Data</th><th>Cliente / Impianto</th><th>Tipo</th><th>Esito</th><th>Tecnico</th><th>Rapportino</th><th></th></tr></thead>
        <tbody>
          ${interventi.map(i => {
            const imp = Store.byId('impianti', i.impiantoId);
            const cli = imp ? clientiById[imp.clienteId] : null;
            return `<tr>
              <td class="strong">${fmtData(i.data)}</td>
              <td>${esc(cli?cli.ragioneSociale:'—')}<div class="sub">${imp?esc(imp.marca+' '+imp.modello):''}</div></td>
              <td>${esc(TIPO_INTERVENTO[i.tipo]||i.tipo)}</td>
              <td><span class="pill pill--${i.esito==='conforme'||i.esito==='nessuna perdita'?'ok':'neutral'}">${esc(i.esito||'—')}</span></td>
              <td>${esc(i.tecnico||'—')}</td>
              <td>${esc(i.rapportinoN||'—')}</td>
              <td class="row-actions"><button class="btn btn--sm" data-print="${i.id}">Stampa</button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="7"><div class="empty"><div class="empty__ico">🛠</div><p>Nessun intervento registrato.</p></div></td></tr>`}
        </tbody>
      </table></div>`;

    $('#act-add-interv').onclick = () => formIntervento();
    $$('[data-print]').forEach(b => b.onclick = () => stampaRapportino(b.dataset.print));
  }

  /* =======================================================================
   * MODAL: dettaglio impianto (con scadenze)
   * ===================================================================== */
  function dettaglioImpianto(id) {
    const imp = Store.byId('impianti', id);
    if (!imp) return;
    const cli = Store.byId('clienti', imp.clienteId);
    const interventi = Store.all('interventi');
    const scadenze = COMPLIANCE.computeScadenze(imp, interventi).sort((a,b)=>a.giorni-b.giorni);
    const storico = interventi.filter(i => i.impiantoId === id).sort((a,b)=>new Date(b.data)-new Date(a.data));
    const T = COMPLIANCE.TIPI_IMPIANTO[imp.tipo];

    const body = el(`<div>
      <dl class="kv">
        <dt>Cliente</dt><dd>${esc(cli?cli.ragioneSociale:'—')}</dd>
        <dt>Tipo</dt><dd>${T.icona} ${T.label}</dd>
        <dt>Marca / modello</dt><dd>${esc(imp.marca)} ${esc(imp.modello)}</dd>
        <dt>Matricola</dt><dd>${esc(imp.matricola||'—')}</dd>
        <dt>Potenza</dt><dd>${imp.potenzaKw||0} kW${imp.fgasTonnCO2?` · ${imp.fgasTonnCO2} t CO₂eq`:''}</dd>
        <dt>Ubicazione</dt><dd>${esc(imp.ubicazione||'—')}</dd>
        <dt>Installazione</dt><dd>${fmtData(imp.dataInstallazione)}</dd>
      </dl>
      <h3 style="font-size:14px;margin-bottom:10px;color:var(--text-dim)">Scadenze di legge</h3>
      <div class="detail-list">
        ${scadenze.map(s => `
          <div class="detail-row">
            <div class="detail-row__main">
              <span class="t">${esc(s.label)}</span>
              <span class="s">${esc(s.normativa)} · ogni ${esc(s.ogni)} · ultima ${fmtData(s.ultima)}</span>
            </div>
            <div style="text-align:right">
              <div><span class="pill pill--${s.stato}">${labelStato(s.stato)}</span></div>
              <div class="s" style="margin-top:4px">${fmtData(s.prossima)} · ${fmtGiorni(s.giorni)}</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="form-actions">
        <button class="btn" data-remind>Genera promemoria cliente</button>
        <button class="btn btn--primary" data-done>Registra intervento</button>
      </div>
      <h3 style="font-size:14px;margin:8px 0 10px;color:var(--text-dim)">Storico interventi (${storico.length})</h3>
      ${storico.length ? storico.map(i => `<div class="detail-row"><div class="detail-row__main"><span class="t">${esc(TIPO_INTERVENTO[i.tipo]||i.tipo)}</span><span class="s">${fmtData(i.data)} · ${esc(i.tecnico||'')} · ${esc(i.esito||'')}</span></div><button class="btn btn--sm" data-print="${i.id}">Stampa</button></div>`).join('') : '<p class="hint">Nessun intervento ancora registrato.</p>'}
    </div>`);

    body.querySelector('[data-remind]').onclick = () => { closeModal(); promemoria(id, scadenze[0] ? scadenze[0].tipo : 'controllo_efficienza'); };
    body.querySelector('[data-done]').onclick = () => { closeModal(); formIntervento({ impiantoId: id }); };
    $$('[data-print]', body).forEach(b => b.onclick = () => stampaRapportino(b.dataset.print));

    openModal(`${T.icona} ${imp.marca} ${imp.modello}`, body);
  }

  function dettaglioCliente(id) {
    const cli = Store.byId('clienti', id);
    if (!cli) return;
    const impianti = Store.all('impianti').filter(i => i.clienteId === id);
    const interventi = Store.all('interventi');
    const body = el(`<div>
      <dl class="kv">
        <dt>Referente</dt><dd>${esc(cli.referente||'—')}</dd>
        <dt>Telefono</dt><dd>${esc(cli.telefono||'—')}</dd>
        <dt>Email</dt><dd>${esc(cli.email||'—')}</dd>
        <dt>Indirizzo</dt><dd>${esc(cli.indirizzo||'—')}, ${esc(cli.citta||'')}</dd>
        ${cli.note?`<dt>Note</dt><dd>${esc(cli.note)}</dd>`:''}
      </dl>
      <h3 style="font-size:14px;margin-bottom:10px;color:var(--text-dim)">Impianti (${impianti.length})</h3>
      <div class="detail-list">
        ${impianti.map(imp => {
          const sc = COMPLIANCE.computeScadenze(imp, interventi).sort((a,b)=>a.giorni-b.giorni)[0];
          const T = COMPLIANCE.TIPI_IMPIANTO[imp.tipo];
          return `<div class="detail-row clickable" data-imp="${imp.id}">
            <div class="detail-row__main"><span class="t">${T.icona} ${esc(imp.marca)} ${esc(imp.modello)}</span><span class="s">${esc(imp.ubicazione||'')} · ${imp.potenzaKw||0} kW</span></div>
            ${sc?`<span class="pill pill--${sc.stato}">${labelStato(sc.stato)}</span>`:''}
          </div>`;
        }).join('') || '<p class="hint">Nessun impianto per questo cliente.</p>'}
      </div>
      <div class="form-actions"><button class="btn btn--primary" data-add-imp>+ Aggiungi impianto</button></div>
    </div>`);
    $$('[data-imp]', body).forEach(r => r.onclick = () => { closeModal(); dettaglioImpianto(r.dataset.imp); });
    body.querySelector('[data-add-imp]').onclick = () => { closeModal(); formImpianto({ clienteId: id }); };
    openModal(cli.ragioneSociale, body);
  }

  /* =======================================================================
   * MODAL: promemoria cliente (WhatsApp / email)
   * ===================================================================== */
  function promemoria(impiantoId, tipoScad) {
    const imp = Store.byId('impianti', impiantoId);
    const cli = Store.byId('clienti', imp.clienteId);
    const sc = COMPLIANCE.computeScadenze(imp, Store.all('interventi')).find(s => s.tipo === tipoScad)
            || COMPLIANCE.computeScadenze(imp, Store.all('interventi'))[0];

    const testo =
`Gentile ${cli.referente || cli.ragioneSociale},
le ricordiamo che per l'impianto ${imp.marca} ${imp.modello} (${imp.ubicazione||'sede'}) è in scadenza il controllo obbligatorio:

• ${sc.label} (${sc.normativa})
• Scadenza: ${fmtData(sc.prossima)}

Per restare in regola e in sicurezza la invitiamo a fissare un appuntamento. Restiamo a disposizione.

Cordiali saluti`;

    const teleRaw = (cli.telefono||'').replace(/\D/g,'');
    const wa = teleRaw ? `https://wa.me/${teleRaw.startsWith('39')?teleRaw:'39'+teleRaw}?text=${encodeURIComponent(testo)}` : null;
    const mail = `mailto:${cli.email||''}?subject=${encodeURIComponent('Promemoria controllo impianto — '+sc.label)}&body=${encodeURIComponent(testo)}`;

    const body = el(`<div>
      <p class="hint" style="margin-bottom:10px">Promemoria precompilato per <strong>${esc(cli.ragioneSociale)}</strong>. Modificalo se serve, poi invialo.</p>
      <textarea id="rem-text" style="width:100%;min-height:200px;background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:12px;font-family:inherit;font-size:13.5px;line-height:1.5">${esc(testo)}</textarea>
      <div class="form-actions">
        <button class="btn" id="rem-copy">⧉ Copia testo</button>
        ${wa?`<a class="btn" href="${wa}" target="_blank">WhatsApp</a>`:''}
        <a class="btn btn--primary" href="${mail}">✉ Email</a>
      </div>
    </div>`);
    body.querySelector('#rem-copy').onclick = () => {
      navigator.clipboard?.writeText($('#rem-text').value).then(()=>toast('Promemoria copiato'));
    };
    openModal('Promemoria al cliente', body);
  }

  /* =======================================================================
   * MODAL: stampa rapportino (print -> PDF dal browser)
   * ===================================================================== */
  function stampaRapportino(interventoId) {
    const i = Store.byId('interventi', interventoId);
    const imp = Store.byId('impianti', i.impiantoId);
    const cli = imp ? Store.byId('clienti', imp.clienteId) : null;
    const T = imp ? COMPLIANCE.TIPI_IMPIANTO[imp.tipo] : null;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>${i.rapportinoN||'Rapportino'}</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;color:#13202b;max-width:720px;margin:40px auto;padding:0 24px}
        h1{font-size:20px;margin:0} .brand{color:#12a886;font-weight:800}
        .head{display:flex;justify-content:space-between;border-bottom:2px solid #12a886;padding-bottom:14px;margin-bottom:22px}
        .num{font-size:13px;color:#667} table{width:100%;border-collapse:collapse;margin:14px 0}
        td,th{text-align:left;padding:8px 6px;border-bottom:1px solid #e2e8ee;font-size:14px} th{color:#667;font-weight:600;width:38%}
        .esito{display:inline-block;background:#e6f7f1;color:#0b7a5e;padding:4px 10px;border-radius:6px;font-weight:700;font-size:13px}
        .firma{margin-top:60px;display:flex;justify-content:space-between} .firma div{border-top:1px solid #99a;width:42%;padding-top:6px;font-size:12px;color:#667;text-align:center}
        .note{background:#f6f8fa;border-radius:8px;padding:12px;font-size:13.5px;margin-top:8px}
        @media print{button{display:none}}
      </style></head><body>
      <div class="head"><div><h1><span class="brand">Boilerly</span> · Rapportino di intervento</h1><div class="num">N. ${i.rapportinoN||'—'} · ${fmtData(i.data)}</div></div></div>
      <table>
        <tr><th>Cliente</th><td>${esc(cli?cli.ragioneSociale:'—')}</td></tr>
        <tr><th>Sede</th><td>${esc(cli?(cli.indirizzo+', '+cli.citta):'—')}</td></tr>
        <tr><th>Impianto</th><td>${T?T.label:''} — ${esc(imp?imp.marca+' '+imp.modello:'')}</td></tr>
        <tr><th>Matricola</th><td>${esc(imp?imp.matricola:'—')}</td></tr>
        <tr><th>Potenza</th><td>${imp?imp.potenzaKw:0} kW${imp&&imp.fgasTonnCO2?` · ${imp.fgasTonnCO2} t CO₂eq`:''}</td></tr>
        <tr><th>Tipo intervento</th><td>${esc(TIPO_INTERVENTO[i.tipo]||i.tipo)}</td></tr>
        <tr><th>Tecnico</th><td>${esc(i.tecnico||'—')}</td></tr>
        <tr><th>Esito</th><td><span class="esito">${esc(i.esito||'—')}</span></td></tr>
      </table>
      ${i.note?`<div class="note"><strong>Note:</strong> ${esc(i.note)}</div>`:''}
      <div class="firma"><div>Il tecnico</div><div>Il cliente</div></div>
      <p style="text-align:center;margin-top:30px"><button onclick="window.print()">🖨 Stampa / Salva PDF</button></p>
      </body></html>`);
    w.document.close();
  }

  /* =======================================================================
   * FORMS
   * ===================================================================== */
  function formCliente(existing) {
    const c = existing || {};
    const body = el(`<form>
      <div class="field"><label>Ragione sociale *</label><input name="ragioneSociale" required value="${esc(c.ragioneSociale||'')}"></div>
      <div class="field-row">
        <div class="field"><label>Referente</label><input name="referente" value="${esc(c.referente||'')}"></div>
        <div class="field"><label>Telefono</label><input name="telefono" value="${esc(c.telefono||'')}"></div>
      </div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${esc(c.email||'')}"></div>
      <div class="field-row">
        <div class="field"><label>Indirizzo</label><input name="indirizzo" value="${esc(c.indirizzo||'')}"></div>
        <div class="field"><label>Città</label><input name="citta" value="${esc(c.citta||'')}"></div>
      </div>
      <div class="field"><label>Note</label><textarea name="note">${esc(c.note||'')}</textarea></div>
      <div class="form-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn btn--primary">Salva</button></div>
    </form>`);
    body.querySelector('[data-close]').onclick = closeModal;
    body.onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(body).entries());
      if (existing) { Store.update('clienti', existing.id, data); toast('Cliente aggiornato'); }
      else { Store.create('clienti', data); toast('Cliente creato'); }
      closeModal(); render();
    };
    openModal(existing ? 'Modifica cliente' : 'Nuovo cliente', body);
  }

  function formImpianto(prefill) {
    const i = (prefill && prefill.id) ? prefill : {};
    const fixedCli = prefill && prefill.clienteId && !prefill.id ? prefill.clienteId : (i.clienteId || '');
    const clienti = Store.all('clienti');
    const tipiOpts = Object.entries(COMPLIANCE.TIPI_IMPIANTO).map(([k,v]) => `<option value="${k}" ${i.tipo===k?'selected':''}>${v.icona} ${v.label}</option>`).join('');
    const cliOpts = clienti.map(c => `<option value="${c.id}" ${fixedCli===c.id?'selected':''}>${esc(c.ragioneSociale)}</option>`).join('');
    const body = el(`<form>
      <div class="field"><label>Cliente *</label><select name="clienteId" required>${cliOpts||'<option value="">— nessun cliente, creane uno prima —</option>'}</select></div>
      <div class="field-row">
        <div class="field"><label>Tipo impianto *</label><select name="tipo" required>${tipiOpts}</select></div>
        <div class="field"><label>Potenza (kW)</label><input name="potenzaKw" type="number" min="0" step="1" value="${i.potenzaKw||''}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Marca</label><input name="marca" value="${esc(i.marca||'')}"></div>
        <div class="field"><label>Modello</label><input name="modello" value="${esc(i.modello||'')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Matricola</label><input name="matricola" value="${esc(i.matricola||'')}"></div>
        <div class="field"><label>Carica F-Gas (t CO₂eq)</label><input name="fgasTonnCO2" type="number" min="0" step="0.1" value="${i.fgasTonnCO2||''}"><div class="hint">Solo clima/frigo/PdC. Lascia 0 se non applicabile.</div></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Ubicazione</label><input name="ubicazione" value="${esc(i.ubicazione||'')}"></div>
        <div class="field"><label>Data installazione</label><input name="dataInstallazione" type="date" value="${i.dataInstallazione||''}"></div>
      </div>
      <div class="field"><label>Note</label><textarea name="note">${esc(i.note||'')}</textarea></div>
      <div class="form-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn btn--primary">Salva</button></div>
    </form>`);
    body.querySelector('[data-close]').onclick = closeModal;
    body.onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(body).entries());
      data.potenzaKw = Number(data.potenzaKw) || 0;
      data.fgasTonnCO2 = Number(data.fgasTonnCO2) || 0;
      if (!data.clienteId) { toast('Crea prima un cliente', false); return; }
      if (i.id) { Store.update('impianti', i.id, data); toast('Impianto aggiornato'); }
      else { Store.create('impianti', data); toast('Impianto creato'); }
      closeModal(); render();
    };
    openModal(i.id ? 'Modifica impianto' : 'Nuovo impianto', body);
  }

  function formIntervento(prefill) {
    prefill = prefill || {};
    const impianti = Store.all('impianti');
    const clientiById = Store.mapById('clienti');
    const impOpts = impianti.map(imp => {
      const cli = clientiById[imp.clienteId];
      return `<option value="${imp.id}" ${prefill.impiantoId===imp.id?'selected':''}>${esc(cli?cli.ragioneSociale:'—')} — ${esc(imp.marca+' '+imp.modello)}</option>`;
    }).join('');
    const tipoOpts = Object.entries(TIPO_INTERVENTO).map(([k,v]) => `<option value="${k}" ${prefill.tipo===k?'selected':''}>${v}</option>`).join('');
    const oggi = new Date().toISOString().slice(0,10);
    const body = el(`<form>
      <div class="field"><label>Impianto *</label><select name="impiantoId" required>${impOpts||'<option value="">— nessun impianto —</option>'}</select></div>
      <div class="field-row">
        <div class="field"><label>Tipo intervento *</label><select name="tipo" required>${tipoOpts}</select></div>
        <div class="field"><label>Data *</label><input name="data" type="date" required value="${oggi}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Esito</label><input name="esito" value="conforme" list="esiti"><datalist id="esiti"><option value="conforme"><option value="nessuna perdita"><option value="non conforme"><option value="riparato"></datalist></div>
        <div class="field"><label>Tecnico</label><input name="tecnico" value=""></div>
      </div>
      <div class="field"><label>Note</label><textarea name="note"></textarea></div>
      <div class="hint">Salvando, la scadenza relativa viene ricalcolata in automatico e viene generato il numero di rapportino.</div>
      <div class="form-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn btn--primary">Salva intervento</button></div>
    </form>`);
    body.querySelector('[data-close]').onclick = closeModal;
    body.onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(body).entries());
      if (!data.impiantoId) { toast('Crea prima un impianto', false); return; }
      data.rapportinoN = Store.nextRapportino();
      const rec = Store.create('interventi', data);
      toast('Intervento registrato · ' + rec.rapportinoN);
      closeModal(); render();
    };
    openModal('Registra intervento', body);
  }

  function confermaElimina(coll, id, label, extra) {
    const body = el(`<div>
      <p style="font-size:14.5px;line-height:1.5">Vuoi eliminare questo ${esc(label)}? ${esc(extra||'')}</p>
      <div class="form-actions"><button class="btn" data-close>Annulla</button><button class="btn btn--danger" data-ok>Elimina</button></div>
    </div>`);
    body.querySelector('[data-close]').onclick = closeModal;
    body.querySelector('[data-ok]').onclick = () => { Store.remove(coll, id); toast(label[0].toUpperCase()+label.slice(1)+' eliminato'); closeModal(); render(); };
    openModal('Conferma eliminazione', body);
  }

  /* =======================================================================
   * Router
   * ===================================================================== */
  const VIEWS = {
    dashboard: { title: 'Dashboard', fn: viewDashboard },
    scadenze:  { title: 'Scadenze',  fn: viewScadenze },
    clienti:   { title: 'Clienti',   fn: viewClienti },
    impianti:  { title: 'Impianti',  fn: viewImpianti },
    interventi:{ title: 'Interventi',fn: viewInterventi },
  };
  let current = 'dashboard';

  function setTitle(t, sub) { $('#view-title').textContent = t; $('#view-sub').textContent = sub || ''; }
  function setActions(html) { $('#topbar-actions').innerHTML = html || ''; }

  function render() {
    (VIEWS[current] || VIEWS.dashboard).fn();
    updateBadge();
    $$('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === current));
  }

  function updateBadge() {
    const scadenze = COMPLIANCE.tutteLeScadenze(Store.all('impianti'), Store.all('interventi'), Store.mapById('clienti'));
    const n = scadenze.filter(s => s.stato !== 'ok').length;
    const badge = $('#nav-badge');
    badge.textContent = n;
    badge.classList.toggle('show', n > 0);
  }

  function go(view) { current = view; render(); }

  /* --------------------------- Init --------------------------- */
  $$('.nav__item').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#btn-reset').onclick = () => { if (confirm('Ripristinare i dati demo? Le modifiche andranno perse.')) { Store.resetDemo(); render(); toast('Dati demo ripristinati'); } };
  $('#btn-export').onclick = () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'boilerly-export.json'; a.click();
    URL.revokeObjectURL(a.href); toast('Database esportato');
  };

  render();
})();
