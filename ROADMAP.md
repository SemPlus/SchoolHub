# SchoolHub · Piano

Aggiornato al 16 novembre 2026. Le voci segnate *da verificare* dipendono da regole esterne (Google, fisco, Ministero) che vanno ricontrollate quando si arriva a quel punto.

## Decisioni prese

- **Gratis per sempre per ogni studente, ovunque.** Studenti e genitori non pagano mai niente: niente premium, niente pubblicità, niente ripetizioni a pagamento.
- **Clienti paganti: solo scuole private** (paritarie e internazionali), con una licenza annuale.
- **3 scuole statali tra le migliori d'Italia** (scelte con Eduscopio) hanno le funzioni per la scuola gratis, come partner, per 2 anni rinnovabili. In cambio: permesso di citare il nome, una frase del preside, un resoconto d'uso annuale.
- **Accesso solo con Google.** Niente Microsoft.
- **Piano Firebase Blaze (funzioni sul server) da febbraio 2027**, quando Samuel apre la società. Fino ad allora tutto gira nell'app e nelle regole del database; la classifica delle scuole è sospesa.
- **Stile:** si mantiene il linguaggio premium attuale (oro, nero, serif, effetti, animazioni, ranghi).

## Regole di prodotto: non diventare una copia

**In una frase:** Classroom è dove il professore dà i compiti. Il registro è dove finiscono i voti. SchoolHub è dove la scuola si ricorda quello che ha imparato.

| Strumento | A cosa serve | Quanto dura |
|---|---|---|
| Classroom | Il docente dà compiti alla sua classe | Un anno, poi il corso viene archiviato |
| Drive | Conservare file privati, senza contesto | Per sempre, ma nessuno li trova |
| Registro elettronico | Voti, assenze, atti ufficiali. Ha anche una sezione dove i docenti caricano file, ma sono file sciolti: senza descrizione, senza materia o libro, impossibili da cercare, e spariscono a fine anno | Un anno |
| **SchoolHub** | **La conoscenza che studenti e docenti si passano**, ordinata per scuola, classe, materia e libro | **Resta negli anni, tra classi e tra scuole** |

### Le regole

1. **Quello che esiste già si collega, non si rifà.** I file restano su Drive, i compiti ufficiali su Classroom, i voti si esportano soltanto.
2. **Prima lo studente, ma il docente deve volerlo usare.** Lo studente è al centro. Il docente deve avere un motivo suo per aprire SchoolHub:
   - meno lavoro: pubblica una volta per tutte le sue classi e riusa il materiale negli anni;
   - vede cosa la classe ha aperto prima di una verifica;
   - trova materiali verificati dai colleghi della stessa materia;
   - il suo contributo è riconosciuto (materiali verificati, docente di riferimento della materia);
   - nessun lavoro in più di moderazione.
3. **Il valore cresce con il tempo e con gli altri.** Ogni funzione deve diventare più utile quanto più classi, anni e scuole la usano.
4. **Meglio della sezione file del registro.** Ogni materiale ha titolo, materia, classe, libro e descrizione; si cerca, si verifica, si commenta e passa all'anno dopo. Il registro è un cassetto, SchoolHub è la biblioteca.
5. **Il lato umano che un registro non avrà mai:** richieste, riconoscimenti, ranghi, il voto al lavoro migliore, gli studenti bravi che aiutano gli altri.
6. **Un'identità propria:** "L'Archivio" e lo stile premium. Un luogo, non uno strumento d'ufficio.

### La prova per ogni nuova idea

1. La usa prima di tutto uno studente, e il docente ha un motivo per usarla?
2. Diventa più utile se la usano altre classi, altri anni o altre scuole?
3. Il registro o Google la fanno già *bene*? Se sì, ci si collega. Se la fanno male (come i file sciolti del registro), SchoolHub la fa meglio e con il contesto.

**Se fallisce due domande su tre, non si costruisce.**

### Da non costruire mai

- un editor di documenti, presentazioni o fogli di calcolo
- un registro: voti, assenze, note
- un calendario delle lezioni
- una chat tra docenti e famiglie
- lezioni video

## Prezzi da provare (scuole private)

| Dimensione | Prezzo all'anno |
|---|---|
| Fino a 200 studenti | €490 |
| 200–500 studenti | €790 |
| Oltre 500 o internazionale | da €1.200 |

Prime 10 scuole: 50% di sconto per 2 anni in cambio di una testimonianza.

## Funzioni da costruire, in ordine

| # | Cosa | Perché | Prima di febbraio? |
|---|---|---|---|
| 1 | **Pannello della scuola**, con resoconto PDF annuale | È il prodotto che si vende al preside | Sì |
| 2 | **Moderazione della scuola** e pulsante Segnala | Prima paura del preside: contenuti e copyright | Sì |
| 3 | **Docenti verificati dal dominio email** della scuola (Google Workspace) | Toglie la conferma manuale del fondatore | Sì, nelle regole del database |
| 4 | **Pacchetto privacy e pagine legali** (privacy, termini, cookie) | Serve alle scuole e anche a Google (vedi sotto) | Sì |
| 5 | **Sito di presentazione e scuola demo** | Credibilità prima della prova | Sì |
| 6 | **Google Classroom, fase 0–1** (vedi sotto) | I docenti vivono già in Classroom | Fase 0 sì, fase 1 dopo la verifica Google |
| 7 | **Funzioni per studenti con DSA** | Inclusione: obbligo per le scuole, argomento forte | Sì |
| 8 | **Notifiche push** | Riportano gli studenti nell'app | No: servono le funzioni sul server |
| 9 | **Attestati per crediti e PCTO** | Motivano a condividere | No: serve la società |
| 10 | **Google Workspace Marketplace** (vedi sotto) | La scuola attiva SchoolHub per tutti in un clic | Preparazione sì, pubblicazione dopo febbraio |

## Google: Marketplace e Classroom

### Cosa serve prima (vale per entrambi)

- [ ] **Dominio proprio** (es. `schoolhub.it`): Google verifica la proprietà del sito, e un indirizzo `vercel.app` non basta.
- [ ] **Pagine pubbliche di privacy e termini d'uso** sul dominio.
- [ ] **Progetto Google Cloud intestato alla società.** Oggi Firebase vive nel progetto `gen-lang-client-0781069215`, creato da AI Studio: da febbraio va spostato in un'organizzazione Google Cloud della società, oppure va creato un progetto nuovo. *Da verificare quale conviene.*
- [ ] **Schermata di consenso OAuth verificata** con il nome della società. Il permesso Drive che usiamo (`drive.file`) è tra i meno delicati; i permessi di Classroom richiedono la verifica di Google. *Tempi e requisiti da verificare al momento della richiesta.*
- [ ] **Assistenza raggiungibile** (email dedicata) e icone e screenshot per la scheda.

### Google Classroom, a fasi

| Fase | Cosa fa | Permessi Google | Quando |
|---|---|---|---|
| 0 | Pulsante **"Condividi su Classroom"** su ogni materiale e raccolta | Nessuno: usa il pulsante di condivisione pubblico di Classroom | Subito |
| 1 | **Importa le classi**: il docente collega Classroom e abbina ogni corso a una classe SchoolHub (es. 3B) | Lettura di corsi e iscritti | Dopo la verifica OAuth |
| 2 | **Importa i compiti con scadenza** come raccolte in modalità consegna | Lettura dei compiti | 2027/28 |
| 3 | **Rimanda voti e feedback** delle consegne a Classroom | Scrittura sui compiti | 2027/28 |
| 4 | **Componente aggiuntivo dentro Classroom** | Programma add-on di Classroom | Più avanti. *Da verificare: potrebbe richiedere che la scuola abbia la versione a pagamento di Workspace for Education.* |

### Google Workspace Marketplace

1. Completare i prerequisiti sopra.
2. Configurare il Marketplace SDK nel progetto Google Cloud: installazione da parte del singolo docente e da parte dell'amministratore per tutta la scuola.
3. Preparare la scheda in italiano e inglese: descrizione, icone, screenshot, link a privacy, termini e assistenza.
4. Inviare a Google per la revisione e correggere quello che chiedono.
5. Dopo la pubblicazione: nelle scuole Google l'amministratore installa SchoolHub per tutti, e la verifica dei docenti tramite dominio diventa automatica.

### Altri programmi Google (quando ci sono i requisiti)

- **Google for Startups Cloud Program:** crediti per pagare Firebase Blaze. Con la società.
- **Google for Education Partner Program:** badge di partner ufficiale. Dopo i primi clienti e l'integrazione Classroom.
- **Google for Startups Accelerator (Europa):** mentori e visibilità. Quando c'è trazione.

## Calendario

| Periodo | Prodotto | Commerciale |
|---|---|---|
| Novembre 2026 – gennaio 2027 | Funzioni 1–5 e 7; Classroom fase 0; testi legali | Scelta delle 3 statali su Eduscopio; pilota gratuito; raccolta dei numeri |
| Febbraio 2027 | Piano Blaze; dominio; progetto Google Cloud della società; richiesta di verifica OAuth | Apertura della società (commercialista: forma giuridica e contributi INPS) |
| Marzo – giugno 2027 | Classroom fase 1; scheda Marketplace in revisione; notifiche push | Vendita alle prime private di Roma; contratti firmati per settembre |
| Settembre 2027 | Marketplace pubblicato; attestati | Prime licenze attive; partner statali al secondo anno |
| 2027/28 | Classroom fasi 2–3 | Altre città italiane |
| Dopo 50–100 private paganti | | Spagna |

## Numeri da seguire

- Studenti attivi ogni settimana, per scuola (obiettivo: oltre il 50% nelle scuole pilota)
- Quanti tornano dopo la prima settimana
- Materiali condivisi per studente attivo
- Scuole private paganti e quante rinnovano
