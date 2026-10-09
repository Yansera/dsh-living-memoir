# Memoir

[简体中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [日本語](README.ja.md) · **Deutsch**

[![CI](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml/badge.svg)](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yansera/dsh-living-memoir?color=0969da&label=npm)](https://www.npmjs.com/package/@yansera/dsh-living-memoir)
[![license](https://img.shields.io/badge/license-MIT-8250df)](LICENSE)

Sitzungsübergreifendes Gedächtnis für DeepSeek Harness. Erinnerungen liegen als eine Gruppe von Markdown-Dateien vor, die am Ende jeder Runde vollständig neu geschrieben werden, statt aneinandergehängt zu werden.

![Die Seite und das Gedächtnisverzeichnis](docs/assets/hero.en.svg)

## 📦 Installation

```sh
dsh plugin --profile desktop add @yansera/dsh-living-memoir
```

Ersetzen Sie `desktop` durch Ihren Profilnamen. `dsh` gehört zu DeepSeek Harness; in der Desktop-Version liegt es unter `<Installationsordner>\resources\runtime\cli\bin\dsh.cmd`.

Aus den Quellen installieren:

```sh
dsh plugin --profile desktop add 'file:D:\Pfad\zu\dsh-living-memoir'
```

Beenden Sie danach den Client vollständig und starten Sie ihn neu. DSH lädt Plugin-Code nur im Moment der Installation, und das Fenster zu schließen ist kein Beenden.

## 🚀 Wie es aussieht

In der Seitenleiste erscheint ein Eintrag „Memoir“. Ein Klick darauf füllt den Hauptbereich: links die Kategorien, rechts die Einträge. „← Zurück zum Chat“ oben links führt zurück ins Gespräch.

Danach ist nichts zu konfigurieren. Das Modell schreibt von selbst, wenn Sie eine dauerhafte Vorliebe äußern, eine Entscheidung festhalten oder es korrigieren. Sie können auch auf „Eintrag hinzufügen“ klicken oder die Markdown-Dateien unter `$DSH_HOME/memoir/` direkt bearbeiten; laden Sie die Seite neu, um die Änderung zu sehen.

Zum Anhalten schalten Sie „Gedächtnis schreiben“ in den Einstellungen oben rechts aus. In diesem Zustand wird nichts gelesen und nichts geschrieben.

## 🧱 Drei Ebenen

```
# Laufende Vorhaben

<!-- ein Abschnitt pro Projekt · von Hand bearbeitbar -->

## Memoir

- Hält sitzungsübergreifendes Gedächtnis als kurzes lebendes Markdown-Dokument
  <!-- memoir id=a1b2c3d4 | imp=4 | conf=high | at=2026-10-07 | src=Nutzer hat es gesagt -->

## Netz: semantische Topologie

- Lässt ein Netz wachsen, dessen Topologie Bedeutung trägt
```

Die erste Ebene ist die Kategorie, je eine Markdown-Datei. Die zweite ist ein Abschnitt, meist einer pro Projekt. Die dritte ist ein Eintrag: ein Satz, und nicht tiefer.

Kategorien sind nach Thema geschnitten, nicht nach Art der Information. Beim Nachschlagen denkt man „welches Projekt ist das“, nicht „ist das eine Entscheidung oder ein Fortschrittsnotiz“. Alles zu einem Projekt liegt unter seinem eigenen Abschnitt.

Anzahl und Form der Kategorien bestimmt das Modell aus dem Inhalt; eine feste Liste gibt es nicht. Bei der Installation werden fünf Startkategorien angelegt, und Sie löschen die, die Sie nicht brauchen. Wird eine Kategorie zu groß oder enthält sie doch zwei unzusammenhängende Dinge, teilt das Modell sie.

## ✍️ Drei Wege hinein

Modellwerkzeuge: das Modell hält etwas für erhaltenswert und ruft `memoir_note` auf. `memoir_recall` und `memoir_forget` lesen und löschen.

Die Seite: auf „Eintrag hinzufügen“ klicken oder die Markdown-Dateien direkt bearbeiten.

Automatisches Umschreiben: zwanzig Sekunden, nachdem eine Runde verstummt ist, wird das ganze Buch gelesen und eine umgeschriebene Fassung geschrieben.

Die ersten beiden hängen an. Die dritte schreibt um, und darum geht es im Ganzen: sie verhindert, dass das Dokument nur noch wächst.

## 🔄 Automatisches Umschreiben

Das Modell bekommt den vollständigen aktuellen Inhalt des Buchs plus den neuen Gesprächsabschnitt und liefert eine komplett umgeschriebene Fassung zurück. Zusammenführen, Streichen, Umformulieren und Ergänzen geschehen alle in diesem einen Schritt.

Ein paar Sicherungen:

- Ein Cursor pro Sitzung verbraucht nur Ereignisse seit dem letzten Lauf, derselbe Abschnitt wird also nie zweimal umgeschrieben
- Ein fehlgeschlagener Lauf rückt den Cursor nicht vor; das Ende der nächsten Runde versucht denselben Abschnitt erneut
- Ein Abschnitt unter 400 Zeichen wird übersprungen, der Cursor rückt trotzdem vor
- Gleichzeitige Sitzungen stellen sich an, statt alle auf einmal zu starten
- Lassen sich die Kategorien nicht auswerten, wird nichts geschrieben; sinkt die Gesamtzahl der Einträge um mehr als die Hälfte (ab 6), wird das Umschreiben rundweg abgelehnt

Jeder Eintrag trägt zwei Marken. `conf` ist die Zuverlässigkeit: `high` für etwas, das Sie selbst gesagt haben, `med` für etwas aus dem Gespräch Gezogenes, `low` für etwas vom Modell Erschlossenes. Wenn Platz gebraucht wird, geht `low` zuerst. `pin` heißt angeheftet: ein angehefteter Eintrag muss ein Umschreiben unverändert überstehen. Es gibt höchstens eine Handvoll davon.

## ⚙️ Einstellungen

Das Zahnrad oben rechts. Änderungen liegen in `.settings.json` im Gedächtnisverzeichnis, bei Ihren Daten, überstehen also einen Profilwechsel.

Ist der Hauptschalter fürs Schreiben aus, wird das Gedächtnis nicht mehr in den Prompt eingefügt, die drei Werkzeuge verweigern die Ausführung, Schreibzugriffe von der Seite und über HTTP antworten mit 403, und das automatische Umschreiben hört auf.

Das Modell fürs Umschreiben wird aus dem gewählt, was der Host bereits registriert hat. Das Plugin ruft `ctx.llm.listProviders()` und `ctx.llm.listModels(provider)` auf und macht daraus eine Auswahlliste, sodass Sie nie einen Anbieternamen oder eine Modellkennung tippen. Alles, was in DSH angebunden ist, erscheint dort, ob eingebaut, lokal oder eine Fremd-API. Unter der Liste bleiben zwei Felder für das, was der Host nicht auflistet.

Das Denken ist standardmäßig aus. Umschreiben ist Aufräumen, nicht Lösen, und ein denkendes Modell verbraucht das Ausgabebudget im Nachdenken und liefert gar keinen Text.

Oberflächensprache und Sprache der Einträge sind zwei getrennte Schalter. Der erste ändert Schaltflächen und Beschriftungen; der zweite bestimmt, welche Sprache in die Dateien geschrieben wird, einschließlich Kategorie- und Abschnittsnamen. Beide stehen standardmäßig auf Englisch.

## 🔧 Konfiguration

Die Bereitstellungskonfiguration steht in `cordis.patch.yml`:

```yaml
- id: memoir
  name: '@yansera/dsh-living-memoir'
  config:
    memoryDir: ''              # leer = $DSH_HOME/memoir
    injectIndex: true          # Gedächtnisindex in den Systemprompt einfügen
    maxInjectEntries: 12       # höchstens so viele Einträge einfügen
    autoDistill: true          # am Ende jeder Runde umschreiben
    distillDebounceMs: 20000   # Ruhezeit vor dem Umschreiben (ms)
    distillMinChars: 400       # kürzere Abschnitte überspringen
    distillMaxItems: 60        # Obergrenze für Einträge im ganzen Buch
    distillMaxTokens: 8000     # Untergrenze des Ausgabebudgets, steigt mit der Größe
    distillReasoningEffort: off # Umschreiben braucht kein Denken
    memoryLanguage: ''         # Sprache der Einträge; leer = uneingeschränkt
    pageEntryLimit: 12         # Einträge je Kategorie, die ein Aufräumen auslösen
    bookEntryLimit: 40         # Einträge im Buch, die ein Aufräumen auslösen
```

Danach ist ein Neustart nötig, genau wie bei Codeänderungen.

## 📂 Wie die Dateien aussehen

Eine Markdown-Datei pro Kategorie. Reiner Text, in jedem Editor zu öffnen, versionsverwaltbar. Keine Datenbank, kein Cache, kein eigenes Format.

Die Metadaten eines Eintrags stehen in HTML-Kommentaren und stören das Lesen nicht:

```
- Fragt vor jedem Download und will die Größe in GB
  <!-- memoir id=8daa8849 | imp=5 | conf=high | at=2026-10-09 | src=Nutzer hat es gesagt | pin -->
```

Eine Zeile, die mit `- ` beginnt, fügt einen Eintrag hinzu. Der Parser kennt drei Zeilenarten (`# Kategorie`, `## Abschnitt`, `- Eintrag`) und ignoriert alles andere.

## ❓ Fragen

**Kollidiert das mit anderen Gedächtniseinrichtungen.** Nein. Memoir behandelt nur die langfristige, makroskopische Ebene: wer der Nutzer ist, wer der Assistent ist, was läuft, welche großen Entscheidungen gefallen sind. Kurzfristiges und Prozedurales wie technische Details, Fallstricke und Fortschrittsprotokolle liegt außerhalb und wird hier nie geschrieben. Die Daten liegen in einem eigenen Verzeichnis.

**Wächst das nicht einfach immer weiter.** Nein. Es wird umgeschrieben statt angehängt, seine Länge folgt also dem Inhalt und nicht der Geschichte. Über 12 Einträge in einer Kategorie oder 40 im Buch lösen ein erzwungenes Aufräumen aus.

**Was, wenn eine Erinnerung falsch umgeschrieben wird.** Jede Kategoriedatei lässt sich direkt bearbeiten, und ein Neuladen der Seite übernimmt die Änderung. Das nächste Umschreiben respektiert geänderte Kategorienamen. Wichtige Einträge lassen sich mit `pin` anheften.

**Werden Daten irgendwohin gesendet.** Nein. Das Plugin stellt selbst keine Netzwerkanfragen; das Umschreiben läuft über die `llm`-Fähigkeit des Hosts.

**Kann ich das Gedächtnis mitnehmen.** Ja. Der ganze Speicher ist ein Verzeichnis; kopieren Sie es.

## 🛠 Entwicklung

```sh
npm test                # alle 259 Offline-Selbsttests
npm run test:store      # Speicher: Auswertung, Dedupe, Verschieben, Suche
npm run test:plugin     # Host-Hälfte: Registrierungen, Werkzeuge, Prompt, HTTP-Routen
npm run test:client     # Seiten-Hälfte: echtes Bundle gegen einen React-Ersatz
npm run test:distill    # Umschreiben: Auswertung, Entprellung, Cursor, Wiederholungen
```

Die Tests laufen vollständig offline. Sie brauchen keinen DSH-Host und berühren kein echtes Profil.

Nach Änderungen am Quelltext (Windows):

```powershell
& .\scripts\sync.ps1
```

Wenn pnpm ein lokales Paket über `file:` installiert, legt es harte Links an. Änderungen am Quelltext brechen den Link, und die installierte Kopie aktualisiert sich nicht mehr, also sind Synchronisieren und Neustart beide nötig.

Aufbau:

```
src/       die Umsetzung (index = Host-Hälfte, distill = Umschreiben, client = Seiten-Hälfte)
test/      Offline-Selbsttests
docs/      Notizen zu Entwurf und Format
scripts/   Synchronisationsskript, Smoke-Test gegen einen laufenden Client
```

Mehr im Detail in [CONTRIBUTING.md](CONTRIBUTING.md) und [docs/](docs/): [Entwurf](docs/design.md), [Speicherformat](docs/storage-format.md), [Konfiguration](docs/configuration.md).

## 📄 Lizenz

[MIT](LICENSE) © Yansera
