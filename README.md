# ManuTrack

**Le scadenze degli impianti dei tuoi clienti, sotto controllo.**

SaaS verticale per **piccoli installatori e manutentori** di caldaie, climatizzatori, pompe di calore e impianti frigoriferi. Calcola in automatico le scadenze dei controlli obbligatori per legge, avvisa prima che scadano, genera promemoria per il cliente e rapportini PDF.

🔗 **Demo live:** https://didowastaken.github.io/manutrack/
📣 **Volantino stampabile:** [`volantino.html`](https://didowastaken.github.io/manutrack/volantino.html)

> Demo funzionante **senza backend**: apri `index.html` (sito/prezzi + lista d'attesa) o `app.html` (applicazione). I dati vivono in `localStorage` e all'avvio è precaricato un set di dati demo realistici.

---

## Perché questo settore

Ricerca di mercato sintetizzata:

- Le nicchie "noiose" dei mestieri/trade sono **poco servite** e con alta disponibilità a pagare (30–150 €/mese) — oggi lavorano con Excel, carta e WhatsApp.
- Il dolore è **ricorrente e legale**: i controlli sugli impianti sono obbligatori per legge, con sanzioni reali. Non è un "nice to have".
- Mercato **enorme e frammentato** (decine di migliaia di installatori in Italia), **nessun player dominante** verticale → churn bassissimo una volta dentro.
- A differenza di HACCP/prenotazioni ristoranti (già saturi: FoodTag, HaccpOK, TheFork…), qui c'è spazio.

## Cosa fa

| Funzione | Descrizione |
|---|---|
| **Dashboard** | KPI scadute / in scadenza / in regola + fatturato a rischio + prossime scadenze e ultimi interventi. |
| **Scadenzario** | Tutte le scadenze di legge di tutti gli impianti, calcolate e ordinate per urgenza. Filtri per stato. |
| **Clienti** | Anagrafica aziende con referente, contatti, elenco impianti. |
| **Impianti** | Registro impianti per cliente con tipo, potenza, carica F-Gas, matricola. |
| **Interventi** | Registrazione interventi → ricalcolo automatico delle scadenze + numero rapportino. |
| **Promemoria** | Messaggio precompilato pronto da inviare al cliente via **WhatsApp** o **email**. |
| **Rapportino** | Documento stampabile / esportabile in PDF (stampa del browser) con firma tecnico/cliente. |

## Motore di compliance (`js/compliance.js`)

Le scadenze **non sono inserite a mano**: vengono calcolate dal tipo di impianto, dalla potenza/carica e dall'ultimo intervento registrato.

- **Controllo di efficienza energetica** — *DPR 74/2013*
  - Gas ≤100 kW: ogni 4 anni · Gas >100 kW: ogni 2 anni
  - Gasolio/solidi ≤100 kW: ogni 2 anni · >100 kW: ogni anno
  - Climatizzazione ≤100 kW: ogni 4 anni · >100 kW: ogni 2 anni
- **Controllo perdite F-Gas** — *Reg. UE 517/2014*
  - 5–50 t CO₂eq: 12 mesi · 50–500 t: 6 mesi · ≥500 t: 3 mesi (sotto 5 t: nessun controllo periodico)
- **Libretto di impianto** — *DM 10/02/2014*: aggiornato a ogni intervento.

> ⚠️ Le frequenze del *bollino* variano per regione: qui sono codificati i minimi nazionali e centralizzati in `COMPLIANCE_RULES`, pronti per essere resi configurabili per cliente/regione. ManuTrack è uno strumento gestionale, non sostituisce la consulenza tecnica/legale.

## Architettura

```
manutrack/
├── index.html          Sito marketing + pricing + lista d'attesa
├── app.html            Applicazione (mini-SPA)
├── css/style.css       Tema dark, responsive, stili di stampa
└── js/
    ├── compliance.js   Regole normative → calcolo scadenze (zero dipendenze)
    ├── store.js        Data layer su localStorage + seed demo
    └── app.js          Router, viste, form, modali, promemoria, rapportino
```

Vanilla HTML/CSS/JS, **nessun build step**. Tutta la lettura/scrittura dati passa da `Store.*`: sostituendo quel solo file con chiamate `fetch()` a un backend la UI non cambia.

## Roadmap verso il SaaS reale (backend)

1. **Auth multi-tenant** — un account = un'azienda; ruoli admin/tecnico (riuso possibile dello stack JWT di `affariincasa`).
2. **DB** — `store.js` → API REST (Express + MongoDB). I modelli sono già quelli delle collezioni `clienti / impianti / interventi`.
3. **Promemoria automatici** — cron giornaliero che a 30 gg dalla scadenza invia email/WhatsApp (Twilio / WhatsApp Business API) senza azione manuale.
4. **Pagamenti abbonamento** — Stripe Billing (29 / 79 / 149 €/mese).
5. **Export Banca Dati F-Gas** e integrazioni gestionali (tier alto).

## Modello di business

| Piano | Prezzo | Per chi | Impianti |
|---|---|---|---|
| Artigiano | 29 €/mese | tecnico singolo | 100 |
| **Officina** | **79 €/mese** | 2–5 tecnici | 500 |
| Manutenzione+ | 149 €/mese | aziende | illimitati |

**ROI per il cliente:** un manutentore con 250 impianti che ne dimentica il 15%/anno perde ~4.000 € di interventi non fatturati; il piano Officina costa 948 €/anno → ritorno ~4×, multe escluse.

## Avvio

Apri direttamente i file nel browser (doppio clic) — non serve un server. Per evitare blocchi su `localStorage` con `file://` su alcuni browser, in alternativa:

```powershell
cd C:\Dev\personal\manutrack
python -m http.server 8080
# poi visita http://localhost:8080/  (sito)  oppure  /app.html
```

Pulsanti utili nell'app: **↺ Reset demo** (ripristina i dati), **⬇ Esporta dati** (scarica il DB in JSON).
