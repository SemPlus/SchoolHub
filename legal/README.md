# Documenti legali di SchoolHub

Versione 1.0, bozza del 21 novembre 2026.

**Sono bozze.** Vanno fatte rivedere da un avvocato esperto di protezione dei dati e di contratti con le scuole prima di usarle. Sono scritte per la società che verrà costituita da febbraio 2027: fino ad allora si danno solo **versioni di prova** (documento 08).

Le parti tra parentesi quadre, es. `[RAGIONE SOCIALE]`, vanno completate quando la società esiste.

## I documenti

| # | Documento | Per chi | Dove si usa |
|---|---|---|---|
| 01 | [Informativa privacy](01-informativa-privacy.md) | Studenti, docenti, visitatori, responsabili delle scuole | Pagina nell'app, link all'accesso |
| 02 | [Termini d'uso](02-termini-di-uso.md) | Chi usa l'app | Pagina nell'app, accettati all'iscrizione |
| 03 | [Cookie e memoria del dispositivo](03-cookie.md) | Chi usa l'app | Pagina nell'app |
| 04 | [Regole sui contenuti e segnalazioni](04-regole-contenuti.md) | Chi pubblica e chi segnala; titolari di diritti d'autore | Pagina nell'app, link dal pulsante Segnala |
| 05 | [Condizioni di licenza per le scuole](05-licenza-scuole.md) | Scuole private paganti | Firmate con l'ordine |
| 06 | [Accordo sul trattamento dei dati (art. 28 GDPR)](06-accordo-trattamento-dati.md) | Ogni scuola attivata (licenza, partner, prova) | Allegato a 05, 07 e 08 |
| 07 | [Accordo con le scuole statali partner](07-accordo-partner.md) | Le 3 scuole statali partner | Firmato dal dirigente scolastico |
| 08 | [Condizioni della prova gratuita](08-prova-gratuita.md) | Scuole in prova prima del lancio | Firmate o accettate per email |
| 09 | [Registro delle attività di trattamento (art. 30 GDPR)](09-registro-trattamenti.md) | Uso interno; da mostrare al Garante se lo chiede | Non pubblico |

## Come sono divisi i ruoli privacy

- **SchoolHub è titolare** del servizio per gli utenti: account, archivio, profili, commenti, richieste, segnalazioni. Ogni studente e docente si iscrive da solo, anche se la sua scuola non ha la licenza.
- **La scuola è titolare, SchoolHub è responsabile del trattamento** per le funzioni della scuola attivata:
  - pannello della scuola e resoconto annuale;
  - modalità aula e orario delle classi;
  - moderazione da parte della scuola;
  - conferma dei docenti, elenco delle email dei docenti, amministratori della scuola.

  Per queste funzioni serve l'accordo 06.

## Da sistemare nell'app prima del lancio

Le bozze descrivono come l'app **deve** funzionare al lancio. Oggi ci sono queste differenze:

1. **Email leggibili da chiunque (urgente).** Il profilo `users/{uid}` è leggibile da tutti (`allow get: if true`) e contiene l'email. Chi conosce l'identificativo di un utente, che compare nei materiali, può leggerne l'indirizzo: anche quello di uno studente minorenne. Va spostato in un documento privato. **Riguarda già la tua classe.**
2. **Eliminazione dell'account.** Nell'app non c'è un pulsante "Elimina il mio account". La bozza promette la cancellazione entro 30 giorni: serve il pulsante, oppure almeno la procedura via email descritta nell'informativa.
3. **Età minima.** Manca la spunta "Ho almeno 14 anni" all'iscrizione (art. 2-quinquies del Codice privacy).
4. **Pagine nell'app.** Informativa, termini, cookie e regole sui contenuti, con link all'accesso e in fondo alle pagine. All'iscrizione va accettato il testo breve (in fondo al documento 01).
5. **Caratteri Google Fonts.** Oggi sono scaricati dai server di Google (`src/index.css`), che così ricevono l'indirizzo IP di chi apre l'app. Vanno ospitati insieme all'app.
6. **Tempi di conservazione.** I marcatori settimanali di attività e le segnalazioni chiuse oggi restano per sempre. La bozza dice 12 mesi: serve una pulizia periodica, che si può fare con le funzioni sul server (piano Blaze, da febbraio).
7. **Contatti.** Servono un'email per l'assistenza e la privacy e una per le segnalazioni legali, sul punto di contatto previsto dal Digital Services Act. Possono essere la stessa.
8. **Dove stanno i dati.** Il database è a Londra (Google Cloud `europe-west2`) e non si può spostare. È lecito, perché il Regno Unito ha una decisione di adeguatezza dell'UE, ma alcune scuole preferiscono dati nell'UE. Se una scuola lo chiede, l'unica strada è un nuovo database in UE con il trasferimento dei dati: va deciso prima del lancio, quando il progetto passa alla società.

## Da verificare con l'avvocato

- **Prova prima della società.** Fino a febbraio 2027 il fornitore sarebbe una persona fisica minorenne. Bisogna capire se la prova gratuita (08) può essere accettata in questa forma, oppure se va rinviata alla società e nel frattempo si usa solo l'app gratuita, senza funzioni per la scuola.
- **Valutazione d'impatto (DPIA, art. 35 GDPR).** Riguarda dati di minorenni su larga scala: va valutato se è obbligatoria. Si consiglia comunque di farla prima del lancio.
- **Responsabile della protezione dei dati (DPO).** Probabilmente non è obbligatorio, perché SchoolHub non fa monitoraggio sistematico né tratta categorie particolari di dati, ma va confermato.
- **Scuole statali.** Va chiarito se, per un servizio gratuito, serve la qualificazione dei servizi cloud per la Pubblica Amministrazione (ACN) e quale forma deve avere l'accordo 07: comodato d'uso gratuito oppure accordo di collaborazione.
- **Diritto dei consumatori.** Gli studenti usano un servizio gratuito: verificare che le limitazioni di responsabilità del documento 02 siano compatibili con il Codice del consumo.
