# Accordo sul trattamento dei dati personali (art. 28 GDPR)

*Versione 1.0, bozza del 21 novembre 2026. Da far rivedere a un avvocato e dal RPD/DPO della scuola.*

**Titolare del trattamento:** la Scuola indicata nel contratto ("Titolare").
**Responsabile del trattamento:** [RAGIONE SOCIALE], [SEDE LEGALE], P.IVA [P.IVA] ("SchoolHub" o "Responsabile").

Questo accordo è parte del contratto tra le parti (licenza, accordo di partnership o prova gratuita) e regola i trattamenti che SchoolHub svolge **per conto della Scuola**.

## 1. Ambito

L'accordo riguarda solo le **funzioni per la scuola** descritte nell'allegato A:
- pannello della scuola;
- modalità aula e orario;
- amministratori della scuola;
- conferma dei docenti;
- moderazione della scuola.

Non riguarda gli account e i lavori pubblicati da studenti e docenti nell'archivio di SchoolHub: per quelli SchoolHub è titolare autonomo, secondo la propria informativa e i Termini d'uso, accettati da ciascun utente.

## 2. Istruzioni

SchoolHub tratta i dati solo per fornire le funzioni per la scuola, secondo il contratto e le istruzioni scritte del Titolare.

Se ritiene che un'istruzione violi il GDPR o altre norme, lo comunica subito al Titolare.

## 3. Riservatezza

Le persone autorizzate da SchoolHub a trattare i dati:
- sono vincolate alla riservatezza;
- accedono solo quando serve (assistenza, moderazione, sicurezza).

## 4. Sicurezza

SchoolHub applica le misure dell'allegato B (art. 32 GDPR) e le aggiorna all'evoluzione tecnica, senza ridurne il livello.

## 5. Sub-responsabili

- Il Titolare autorizza in via generale i sub-responsabili elencati nell'allegato C.
- SchoolHub comunica per email, con almeno 30 giorni di anticipo, l'aggiunta o la sostituzione di un sub-responsabile. Il Titolare può opporsi per motivi ragionevoli; in mancanza di accordo può recedere senza penali, con rimborso della parte di corrispettivo non goduta.
- SchoolHub impone ai sub-responsabili obblighi equivalenti a quelli di questo accordo e ne risponde verso il Titolare.

## 6. Trasferimenti fuori dall'UE

I dati sono conservati nel Regno Unito (Google Cloud, regione `europe-west2`, Londra), coperto da una decisione di adeguatezza.

Eventuali trasferimenti verso gli Stati Uniti avvengono verso fornitori aderenti all'EU-U.S. Data Privacy Framework, oppure con le clausole contrattuali tipo della Commissione europea.

## 7. Assistenza al Titolare

SchoolHub aiuta il Titolare, con le informazioni di cui dispone:
- a rispondere alle richieste degli interessati (artt. 15–22). Le richieste ricevute direttamente da SchoolHub vengono inoltrate al Titolare entro 5 giorni lavorativi;
- nelle valutazioni d'impatto e nelle consultazioni con il Garante (artt. 35–36);
- a dimostrare il rispetto di questo accordo.

## 8. Violazioni dei dati

SchoolHub comunica al Titolare ogni violazione dei dati personali che riguarda i trattamenti di questo accordo:
- **senza ingiustificato ritardo e comunque entro 48 ore** da quando ne viene a conoscenza;
- indicando natura della violazione, categorie e numero approssimativo di interessati, conseguenze probabili e misure adottate.

In questo modo il Titolare può rispettare il termine di 72 ore per la notifica al Garante.

## 9. Fine del trattamento

Alla fine del contratto, entro 30 giorni e a scelta del Titolare, SchoolHub:
- **restituisce** i dati in formato CSV;
- **e/o li cancella**, salvo obblighi di legge di conservazione.

## 10. Verifiche

- SchoolHub mette a disposizione del Titolare le informazioni necessarie a dimostrare il rispetto dell'art. 28.
- Il Titolare può svolgere una verifica, anche tramite un incaricato vincolato alla riservatezza, con un preavviso di almeno 30 giorni, una volta l'anno, salvo violazioni accertate. Per le infrastrutture dei sub-responsabili valgono le loro certificazioni (es. ISO 27001, SOC 2).

## 11. Durata

L'accordo dura quanto il contratto. Gli obblighi di riservatezza e cancellazione restano finché SchoolHub conserva dati del Titolare.

---

## Allegato A – Descrizione dei trattamenti

| | |
|---|---|
| **Finalità** | Funzioni per la scuola: modalità aula, orario delle classi, pannello e resoconto annuale, amministratori della scuola, conferma dei docenti, moderazione dei contenuti della scuola |
| **Interessati** | Studenti, docenti e amministratori della Scuola |
| **Durata** | Durata del contratto più 30 giorni |

**Categorie di dati:**

| Funzione | Dati |
|---|---|
| Amministratori | Indirizzo email, scuola |
| Conferma dei docenti | Nome, email, classi e materie dei docenti iscritti per la Scuola; conferma di docente; domini email del personale (max 3); elenco delle email dei docenti |
| Pannello | Conteggi **aggregati** per classe e per settimana (studenti con account, attivi, lavori, lotti); nessun dato del singolo studente |
| Modalità aula | Classe e data/ora dell'ultimo utilizzo del link di ogni aula |
| Orario | Classe, giorno, ora, materia, orari delle campanelle. Nessun nome di docente né aula |
| Moderazione | Contenuti segnalati della Scuola, motivi e note delle segnalazioni, decisioni e nome di chi le ha prese. **Non l'identità di chi ha segnalato** |

**Categorie particolari di dati:** nessuna.

**Operazioni:**
- raccolta, registrazione e conservazione;
- consultazione da parte degli amministratori;
- aggregazione statistica;
- cancellazione.

## Allegato B – Misure di sicurezza

1. **Autenticazione:** solo con account Google, email verificata.
2. **Controllo degli accessi:** regole di sicurezza sul server del database, per ruolo e per scuola. Tra le altre:
   - gli amministratori vedono solo la propria scuola e solo dati aggregati;
   - l'identità di chi segnala non è mai visibile alla scuola;
   - l'elenco delle email dei docenti è leggibile solo dagli amministratori della scuola e da SchoolHub; ogni docente può verificare solo la propria riga.

   Le regole sono verificate con test automatici a ogni modifica.
3. **Minimizzazione:**
   - il pannello mostra solo numeri per classe e materia;
   - l'attività settimanale è registrata con un marcatore privato, leggibile solo dall'interessato, più totali anonimi;
   - l'orario non contiene nomi.
4. **Cifratura:** in transito (HTTPS/TLS) e a riposo (cifratura predefinita di Google Cloud).
5. **Accesso del personale SchoolHub:** solo personale autorizzato, con account Google protetto da verifica in due passaggi, per assistenza, moderazione e sicurezza.
6. **Separazione:** nessuna scrittura è possibile per conto di altri. La modalità "vedi come" del fondatore è di sola lettura.
7. **Continuità:** infrastruttura gestita da Google Cloud, con replica dei dati nella regione.
8. **Gestione delle violazioni:** procedura interna di rilevazione, valutazione e comunicazione entro 48 ore (art. 8).

## Allegato C – Sub-responsabili autorizzati

| Sub-responsabile | Servizio | Luogo dei dati | Garanzie |
|---|---|---|---|
| Google Cloud EMEA Ltd (Irlanda) / Google LLC | Firebase: autenticazione e database Firestore | Regno Unito (Londra, `europe-west2`); servizi di autenticazione anche in UE/USA | Termini per il trattamento dei dati di Google Cloud; decisione di adeguatezza UK; Data Privacy Framework e clausole tipo |
| Vercel Inc. (USA) | Hosting dell'app e funzione di controllo dei link | USA e rete globale | Data Processing Addendum di Vercel; Data Privacy Framework e clausole tipo |
