# Registro delle attività di trattamento (art. 30 GDPR)

*Uso interno. Versione 1.0, bozza del 21 novembre 2026. Da aggiornare a ogni nuova funzione che tratta dati personali.*

**Titolare / Responsabile:** [RAGIONE SOCIALE], [SEDE LEGALE], P.IVA [P.IVA], contatto [EMAIL PRIVACY].
**RPD/DPO:** [non nominato / nome] (vedi README, punto da verificare).

## Parte 1 – SchoolHub come titolare (art. 30.1)

| # | Trattamento | Finalità | Interessati | Dati | Base giuridica | Destinatari | Trasferimenti | Conservazione |
|---|---|---|---|---|---|---|---|---|
| T1 | Account e profilo | Accesso e funzionamento del servizio | Studenti (14+), docenti | Nome, email, foto e ID Google; scuola, classe; classi e materie dei docenti; tipo di account; ruolo; ultimo accesso | Contratto (6.1.b) | Google (Firebase) | UK (adeguatezza); USA (DPF/SCC) | Fino all'eliminazione dell'account + 30 giorni |
| T2 | Archivio dei lavori | Pubblicare, conservare e cercare i lavori; eredità alle classi successive | Autori, coautori | Contenuti pubblicati, nome e foto dell'autore, scuola, classe; link a Google Drive | Contratto (6.1.b) | Pubblico (archivio aperto); Google, Vercel | Come T1 | Finché il lavoro resta nell'archivio o fino alla cancellazione |
| T3 | Interazioni | Commenti, richieste, risposte, voti nei lotti, salvataggi, aperture, "studiato" | Utenti | Contenuto e autore delle interazioni; conteggi | Contratto (6.1.b) | Pubblico (commenti, richieste); privati (salvataggi, "studiato") | Come T1 | Come T2; privati fino all'eliminazione dell'account |
| T4 | Segnalazioni e moderazione | Sicurezza, rimozione di contenuti illeciti, Regolamento UE 2022/2065 | Chi segnala, autori segnalati | Segnalazione (motivo, nota, autore), decisione | Obbligo di legge (6.1.c); legittimo interesse (6.1.f) | SchoolHub; motivi e note (senza autore) alla scuola attivata | Come T1 | 12 mesi dalla decisione |
| T5 | Attività settimanale | Conteggi anonimi per il pannello e per le statistiche del servizio | Utenti con scuola | Marcatore privato settimana/utente; totali per classe | Legittimo interesse (6.1.f) | Solo SchoolHub; totali alle scuole attivate | Come T1 | Marcatori 12 mesi; totali anonimi senza limite |
| T6 | Accesso a Google Drive | Caricare i file nel Drive dell'utente e condividerli tramite link | Utenti che caricano file | Token temporaneo con permesso `drive.file`; metadati del file | Contratto (6.1.b) | Google | Come T1 | Il token non viene conservato |
| T7 | Assistenza e richieste degli interessati | Rispondere a utenti, scuole e autorità | Chi scrive | Email, contenuto delle richieste | Contratto / obbligo di legge | Fornitore di posta [ ] | [ ] | 24 mesi dalla chiusura della richiesta |
| T8 | Clienti scolastici | Contratti, fatturazione | Referenti delle scuole | Nome, ruolo, email, dati di fatturazione | Contratto e obbligo di legge (6.1.b/c) | Commercialista, Sistema di Interscambio | — | 10 anni (obblighi fiscali) |

## Parte 2 – SchoolHub come responsabile (art. 30.2)

| Titolare | Categorie di trattamento | Sub-responsabili | Trasferimenti | Misure |
|---|---|---|---|---|
| Ogni scuola attivata (licenza, partner, prova), elenco aggiornato nella dashboard del fondatore | Amministratori della scuola; conferma dei docenti (domini, elenco delle email); pannello (conteggi aggregati); modalità aula (ultimo uso per classe); orario; moderazione della scuola | Google Cloud (Firebase), Vercel | UK (adeguatezza); USA (DPF/SCC) | Allegato B del documento 06 |

## Misure di sicurezza generali

Vedi l'allegato B del documento 06. In più, per i trattamenti da titolare:
- l'archivio è pubblico per scelta di prodotto; i dati non necessari alla pubblicazione (email, attività, salvataggi, segnalazioni) sono privati e protetti dalle regole del database;
- [da completare dopo la correzione: le email non sono leggibili pubblicamente – vedi README, punto 1].

## Registro delle violazioni

| Data | Descrizione | Dati e interessati coinvolti | Conseguenze | Misure | Notifica al Garante / alle scuole |
|---|---|---|---|---|---|
| | | | | | |
