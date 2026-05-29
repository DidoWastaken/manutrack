/* =========================================================================
 * Boilerly — Motore di compliance
 * -------------------------------------------------------------------------
 * Calcola le scadenze legali obbligatorie di ogni impianto a partire dal
 * tipo, dalla potenza/carica e dall'ultimo intervento registrato.
 *
 * Fonti normative codificate (verificare sempre le specifiche regionali):
 *  - DPR 74/2013  -> controllo di efficienza energetica ("controllo fumi")
 *  - Reg. UE 517/2014 (F-Gas) -> controllo perdite per t CO2eq
 *  - DM 10/02/2014 -> libretto di impianto (aggiornamento a ogni intervento)
 *
 * NB: le frequenze del "bollino" variano da regione a regione: qui usiamo i
 * minimi nazionali. Sono tutte centralizzate in COMPLIANCE_RULES così che un
 * domani siano configurabili per cliente/regione senza toccare la UI.
 * ========================================================================= */

const COMPLIANCE = (() => {
  'use strict';

  const GIORNO = 24 * 60 * 60 * 1000;

  /* Tipi di impianto gestiti (la chiave finisce nel data model).
   * cee  = soggetto al controllo di efficienza energetica (DPR 74/2013)
   * fgas = soggetto al controllo perdite F-Gas (se sopra soglia)
   * NB: la refrigerazione commerciale (banchi/celle) NON è climatizzazione
   *     edifici, quindi è soggetta solo all'F-Gas, non al DPR 74. */
  const TIPI_IMPIANTO = {
    caldaia_gas:    { label: 'Caldaia a gas',            icona: '🔥', cee: true,  fgas: false },
    caldaia_gasolio:{ label: 'Caldaia a gasolio/solido', icona: '🛢️', cee: true,  fgas: false },
    pompa_calore:   { label: 'Pompa di calore',          icona: '♨️', cee: true,  fgas: true  },
    clima:          { label: 'Climatizzatore / VRF',     icona: '❄️', cee: true,  fgas: true  },
    frigo:          { label: 'Impianto frigorifero',     icona: '🧊', cee: false, fgas: true  },
  };

  /* -----------------------------------------------------------------------
   * Regola 1 — Controllo di efficienza energetica (DPR 74/2013, All. A)
   * Restituisce l'intervallo in mesi in base a combustibile e potenza.
   * --------------------------------------------------------------------- */
  function intervalloControlloEfficienza(impianto) {
    const kw = Number(impianto.potenzaKw) || 0;
    switch (impianto.tipo) {
      case 'caldaia_gas':
        return kw > 100 ? 24 : 48;            // gas: >100kW ogni 2 anni, altrimenti 4
      case 'caldaia_gasolio':
        return kw > 100 ? 12 : 24;            // liquidi/solidi: >100kW ogni anno, altrimenti 2
      case 'pompa_calore':
      case 'clima':
        return kw > 100 ? 24 : 48;            // climatizzazione: >100kW ogni 2 anni, altrimenti 4
      default:
        return 48;
    }
  }

  /* -----------------------------------------------------------------------
   * Regola 2 — Controllo perdite F-Gas (Reg. UE 517/2014, art. 4)
   * Frequenza per tonnellate di CO2 equivalente. Con sistema di
   * rilevamento perdite gli intervalli raddoppiano (qui non assunto).
   * --------------------------------------------------------------------- */
  function intervalloFGas(impianto) {
    const t = Number(impianto.fgasTonnCO2) || 0;
    if (t <= 0) return null;                  // carica sotto soglia / non soggetto
    if (t < 5)   return null;                 // < 5 t CO2eq: nessun controllo periodico
    if (t < 50)  return 12;                   // 5–50 t   -> 12 mesi
    if (t < 500) return 6;                    // 50–500 t -> 6 mesi
    return 3;                                 // >= 500 t -> 3 mesi
  }

  /* Quale tipo di intervento "soddisfa" una data scadenza */
  const TIPO_INTERVENTO_PER_SCADENZA = {
    controllo_efficienza: ['controllo_efficienza', 'installazione'],
    fgas_perdite:         ['fgas_perdite', 'installazione'],
  };

  /* -----------------------------------------------------------------------
   * Aggiunge mesi a una data restituendo un nuovo oggetto Date.
   * --------------------------------------------------------------------- */
  function addMesi(date, mesi) {
    const d = new Date(date.getTime());
    d.setMonth(d.getMonth() + mesi);
    return d;
  }

  /* Ultimo intervento (per data) tra i tipi che soddisfano la scadenza */
  function ultimoInterventoUtile(impianto, interventi, tipiValidi) {
    const validi = interventi
      .filter(i => i.impiantoId === impianto.id && tipiValidi.includes(i.tipo))
      .map(i => new Date(i.data))
      .sort((a, b) => b - a);
    return validi[0] || null;
  }

  /* Stato di una scadenza in base ai giorni mancanti */
  function statoDaGiorni(giorni) {
    if (giorni < 0)  return 'scaduta';
    if (giorni <= 30) return 'in_scadenza';
    return 'ok';
  }

  /* -----------------------------------------------------------------------
   * computeScadenze — cuore del motore.
   * Per un impianto restituisce la lista delle scadenze applicabili con
   * data prevista, giorni mancanti e stato.
   * --------------------------------------------------------------------- */
  function computeScadenze(impianto, interventi, oggi = new Date()) {
    const out = [];
    const tipo = TIPI_IMPIANTO[impianto.tipo] || {};
    const baseInstall = impianto.dataInstallazione ? new Date(impianto.dataInstallazione) : oggi;

    // --- Controllo efficienza energetica (solo impianti di climatizzazione) ---
    if (tipo.cee) {
      const mesiCEE = intervalloControlloEfficienza(impianto);
      const ultimoCEE = ultimoInterventoUtile(impianto, interventi, TIPO_INTERVENTO_PER_SCADENZA.controllo_efficienza) || baseInstall;
      const prossimaCEE = addMesi(ultimoCEE, mesiCEE);
      const giorniCEE = Math.round((prossimaCEE - oggi) / GIORNO);
      out.push({
        tipo: 'controllo_efficienza',
        label: 'Controllo efficienza energetica',
        normativa: 'DPR 74/2013',
        ogni: mesiCEE >= 12 ? `${mesiCEE / 12} ${mesiCEE === 12 ? 'anno' : 'anni'}` : `${mesiCEE} mesi`,
        ultima: ultimoCEE,
        prossima: prossimaCEE,
        giorni: giorniCEE,
        stato: statoDaGiorni(giorniCEE),
      });
    }

    // --- Controllo perdite F-Gas (solo se applicabile) ---
    if (tipo.fgas) {
      const mesiFG = intervalloFGas(impianto);
      if (mesiFG) {
        const ultimoFG = ultimoInterventoUtile(impianto, interventi, TIPO_INTERVENTO_PER_SCADENZA.fgas_perdite) || baseInstall;
        const prossimaFG = addMesi(ultimoFG, mesiFG);
        const giorniFG = Math.round((prossimaFG - oggi) / GIORNO);
        out.push({
          tipo: 'fgas_perdite',
          label: 'Controllo perdite F-Gas',
          normativa: 'Reg. UE 517/2014',
          ogni: mesiFG >= 12 ? `${mesiFG / 12} anno` : `${mesiFG} mesi`,
          ultima: ultimoFG,
          prossima: prossimaFG,
          giorni: giorniFG,
          stato: statoDaGiorni(giorniFG),
        });
      }
    }

    return out;
  }

  /* Tutte le scadenze di tutti gli impianti, arricchite col cliente */
  function tutteLeScadenze(impianti, interventi, clientiById, oggi = new Date()) {
    const righe = [];
    impianti.forEach(imp => {
      computeScadenze(imp, interventi, oggi).forEach(s => {
        righe.push({
          ...s,
          impianto: imp,
          cliente: clientiById[imp.clienteId] || null,
        });
      });
    });
    return righe.sort((a, b) => a.giorni - b.giorni);
  }

  return {
    GIORNO,
    TIPI_IMPIANTO,
    intervalloControlloEfficienza,
    intervalloFGas,
    computeScadenze,
    tutteLeScadenze,
    statoDaGiorni,
  };
})();
