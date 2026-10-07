# Memoir

[简体中文](README.md) · [English](README.en.md) · [Français](README.fr.md) · [日本語](README.ja.md) · **Deutsch**

[![npm](https://img.shields.io/npm/v/@yansera/dsh-memoir?color=0969da&label=npm)](https://www.npmjs.com/package/@yansera/dsh-memoir)
[![CI](https://github.com/Yansera/dsh-memoir/actions/workflows/ci.yml/badge.svg)](https://github.com/Yansera/dsh-memoir/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-222%20passing-2da44e)](test/)
[![license](https://img.shields.io/badge/license-MIT-8250df)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20.18-339933)](package.json)

> **Sitzungsübergreifendes Gedächtnis für DeepSeek Harness — geführt als kurzes, lesbares Markdown-Lebenddokument**, mit eigener Seite in der Oberfläche.

![Memoir: eine Markdown-Datei je Kategorie, drei Ebenen, plus eine eigene Seite](docs/assets/hero.svg)

---

## Welches Problem es löst

Fast jedes KI-Gedächtnisprojekt arbeitet daran, **mehr zu behalten und besser wiederzufinden**.

Memoir geht den umgekehrten Weg. Es löst genau eine Sache: **das Gedächtnis so kurz zu halten, dass es jemand tatsächlich liest.**

Eine Erinnerung ist ein Satz. Das ganze Heft zu lesen dauert unter zwei Minuten. Es wächst nicht mit jedem Gesprächsschritt — denn es wird **umgeschrieben**, nicht **angehängt**.

---

## ✨ Was anders ist

| | Der übliche Weg | Memoir |
|---|---|---|
| **Wachstum** | Wächst nur; ein Mensch muss ausdünnen | **Jede Runde vollständig umgeschrieben**: zusammenfassen, kürzen, löschen, ergänzen. Länge folgt dem Inhalt, nicht der Historie |
| **Rolle des Modells** | Ein Schreiber — hängt eine Zeile an, wenn Neues auftaucht | Ein **Lektor** — liest alles und liefert eine bessere Fassung |
| **Struktur** | Eine flache Liste oder im Code fest verdrahtete Kategorien | **Drei Ebenen**: Kategorie → Abschnitt → Eintrag. Kategorien und Abschnitte legt das Modell nach Thema an und wieder ab |
| **Daten** | Datenbank, Vektorindex, eigenes Format | **Einfache Markdown-Dateien.** In jedem Editor zu öffnen, von Hand zu ändern, versionierbar |
| **Größenkontrolle** | Fehler, wenn voll | **Kapazitätsauslöser**: über 12 Einträge in einer Kategorie oder 40 im Heft wird ein Zwangs-Aufräumen verlangt |
| **Abschalten** | Deinstallieren | Ein **Schreibschalter** in der Seite. Aus heißt: nichts wird gelesen, nichts geschrieben |

In einem Satz: **andere arbeiten daran, was man behalten soll; dieses hier daran, dass man es lesen kann.**

---

## 🚀 Schnellstart

### 1. Installieren

```sh
dsh plugin --profile desktop add @yansera/dsh-memoir
```

> `desktop` durch den eigenen Profilnamen ersetzen (im Web-Build meist `web`).
> `dsh` gehört zu DeepSeek Harness — im Desktop-Client unter `<Installationsordner>\resources\runtime\cli\bin\dsh.cmd`.

**Aus dem Quelltext** (Entwicklung):

```sh
dsh plugin --profile desktop add 'file:D:\pfad\zu\dsh-memoir'
```

### 2. Client neu starten

**Dieser Schritt ist nicht optional.** DSH lädt Plugin-Code **nur im Moment der Installation**; spätere Dateiänderungen zählen nicht. Das Fenster zu schließen beendet die Anwendung nicht — wirklich beenden und neu starten.

### 3. Öffnen

In der Seitenleiste erscheint ein **Memoir**-Symbol. Ein Klick macht den Hauptbereich zur Gedächtnisseite: links Kategorien, rechts Einträge. **„← Zurück zum Chat“** oben links führt jederzeit zurück.

### 4. Benutzen

Nichts zu konfigurieren. Danach:

- **Das Modell schreibt selbst** — bei dauerhaften Vorlieben, getroffenen Entscheidungen oder Korrekturen ruft es `memoir_note`
- **Sie können auch schreiben** — „Neuer Eintrag“, oder **die Markdown-Dateien direkt bearbeiten** unter `$DSH_HOME/memoir/` (Seite neu laden genügt)
- **Jede Runde räumt auf** — 20 Sekunden nachdem eine Runde zur Ruhe kommt, liest der Hintergrund das ganze Heft und schreibt es neu

**Soll es aufhören?** Oben rechts **⚙** → **Gedächtnis-Schreiben** ausschalten. Dann wird nichts gelesen und nichts geschrieben.

---

## 🧱 Drei Ebenen, nie mehr

```
# Laufende Vorhaben              ← Ebene 1: Kategorie. Groß und wenige

<!-- Projekte, aktueller Stand · von Hand editierbar -->

## Memoir                        ← Ebene 2: Abschnitt. Einer je Projekt oder Thema

- Hält sitzungsübergreifendes Gedächtnis als kurzes Markdown-Lebenddokument    ← Ebene 3: Eintrag
  <!-- memoir id=a1b2c3d4 | imp=4 | at=2026-10-07 | src=auto -->

## Netz: semantische Topologie

- Ein Netz wachsen lassen, dessen Topologie Bedeutung trägt — durch Mutation und Auslese
```

| Ebene | Syntax | Entschieden von |
|---|---|---|
| **Kategorie** | eine `.md`-Datei | dem Modell, nach Thema — es gibt keine feste Liste im Code |
| **Abschnitt** | `## Projekt` | alles zu einem Projekt gehört darunter; weglassen, wenn unpassend |
| **Eintrag** | `- ein Satz` | Ende der Hierarchie — nichts Tieferes |

**Warum nach Thema statt nach Art?** Weil man beim Suchen denkt *„welches Projekt war das?“* und nicht *„war das eine Entscheidung oder ein Fortschritt?“*. Nach Art zu ordnen verstreut ein Projekt über mehrere Schubladen.

Beim ersten Start werden fünf Kategorien angelegt: **Zum Nutzer · Vorlieben und Regeln · Laufende Vorhaben · Entscheidungen · Zum Assistenten**. Nur ein Anfang — löschen Sie, was Sie nicht brauchen.

---

## ✍️ Drei Schreibwege, ein Lebenddokument

![Drei Schreibwege speisen ein Lebenddokument; ein Kapazitätsschwellwert erzwingt ein Aufräumen](docs/assets/pipeline.svg)

| Weg | Ausgelöst durch | Wer schreibt |
|---|---|---|
| **Modell-Werkzeuge** | das Modell hält etwas für behaltenswert | `memoir_note` / `memoir_recall` / `memoir_forget` |
| **Die Seite** | Klick auf „Neuer Eintrag“ oder Markdown-Bearbeitung | Sie |
| **Automatisches Umschreiben** | am Ende jeder Runde | das Modell liest und liefert eine vollständige Neufassung |

> Die ersten beiden **hängen an**. Der dritte **schreibt um**. Er ist der Kern — er verhindert, dass das Heft nur noch wächst.

---

## 🔄 Das automatische Umschreiben

Sobald eine Runde zur Ruhe kommt (standardmäßig 20 Sekunden), **schreibt der Hintergrund das ganze Heft um**:

> Das Modell bekommt *das Heft im aktuellen Zustand* plus *diesen Gesprächsabschnitt* und muss **die vollständig umgeschriebene Fassung** liefern — zusammenführen, was zusammengehört; kürzen, was veraltet ist; streichen, was tot ist; ergänzen, was neu ist. Auch Kategorien und Abschnitte dürfen ihre Form ändern.

Es verhält sich also wie ein **Lektor**, der ein Lebenddokument pflegt — nicht wie ein Schreiber, der ein Protokoll verlängert.

**Leitplanken:**

- **Cursor je Sitzung** — nur neue Ereignisse werden verarbeitet, ein Abschnitt wird nie doppelt umgeschrieben
- **Ein Fehler schiebt den Cursor nicht weiter** — die nächste Runde versucht denselben Abschnitt erneut
- **Zu wenig Inhalt wird übersprungen** (standardmäßig 400 Zeichen), der Cursor läuft trotzdem weiter
- **Global serialisiert** — mehrere gleichzeitig endende Sitzungen stellen sich in eine Warteschlange
- **Zwei Sicherheitsnetze**: lassen sich keine Kategorien auslesen, wird nichts geschrieben; fällt die Eintragszahl um mehr als die Hälfte (ab 6 Einträgen), wird das Umschreiben abgelehnt und die Datei bleibt unangetastet

Ohne `llm`-Dienst (kein Modell konfiguriert) wird dieser Weg still übersprungen; Werkzeuge und Seite arbeiten weiter.

### Kapazitätsauslöser

Umschreiben allein reicht nicht: für sich genommen bessert es nur nach, während die Zahl weiter steigt. Daher zwei Schwellwerte:

| Schwellwert | Standard | Bedeutung |
|---|---|---|
| `pageEntryLimit` | 12 | Einträge in einer einzelnen Kategorie |
| `bookEntryLimit` | 40 | Einträge im ganzen Heft |

**Wird einer überschritten**, trägt dieses Umschreiben zusätzlich einen **Zwangs-Aufräumbefehl**: wie viele Einträge es gibt, welche Kategorien zu voll sind — und drei Forderungen:

1. **Zusammenfassen** — Synonyme und eng Verwandtes zu einem Satz
2. **Kürzen** — weitschweifige Einträge auf ihr Ergebnis eindampfen
3. **Abschnitte bilden** — eine übervolle Kategorie mit `##` aufteilen statt zwanzig Einträge flach zu lassen

**Unterhalb der Schwellwerte wird nichts davon angehängt** und das Umschreiben bleibt leicht.

---

## ⚙️ Einstellungen

Oben rechts in der Seite: **⚙**.

### Schreibschalter

Aus bedeutet **es wird nichts gelesen und nichts geschrieben**:

- das Gedächtnis wird nicht mehr in den Systemprompt eingefügt
- alle drei Werkzeuge verweigern die Ausführung
- Schreibzugriffe von Seite und HTTP-API antworten mit 403
- das automatische Umschreiben stoppt

Praktisch für „diese Unterhaltung nicht mitschreiben“ — viel leichter als eine Deinstallation.

### Welches Modell umschreibt

| Feld | Bedeutung |
|---|---|
| **Anbieter** | leer = dem Standardmodell des Agenten folgen. Sonst der Anbietername des Hosts |
| **Modell** | leer = Standard. Sonst eine Kennung wie `qwen3-8b` |
| **Denkaufwand** | `aus` / `niedrig` / `hoch` / `maximal` / `nicht senden` |

**Welche Modelle stehen zur Wahl?** Jeder **bereits beim Host registrierte** Anbieter:

- **In DSH eingebaut** — z. B. `deepseek-flash` unter `deepseek-official`
- **Ein lokales Modell** — der lokale Inferenzdienst, den Sie in DSH eingebunden haben (Ollama, llama.cpp, …)
- **Eine Fremd-API** — jeder OpenAI-kompatible Endpunkt, der in DSH als Anbieter eingerichtet ist

> Das Plugin **stellt selbst keine Netzwerkanfragen**; alles läuft über die `llm`-Fähigkeit des Hosts. Was wählbar ist, hängt davon ab, was Sie in DSH angebunden haben.

**Warum ist das Denken standardmäßig aus?** Umschreiben ist **Aufräumen**, nicht **Lösen**. Gemessen: ein denkendes Modell verbrennt das Ausgabebudget im Nachdenken und hat dann nichts mehr für den Text — Symptom: „Anfrage erfolgreich, aber kein einziger Textblock“. Ausgeschaltet geht das ganze Budget in den Text.

---

## 🌍 Oberflächensprachen

**简体中文 · English · Français · Deutsch · 日本語**

Zwei Wege:

- **Dem Host folgen** (Standard) — die Sprache, die DSH verwendet
- **In den Einstellungen wählen** — ⚙ → Sprache

Der Wechsel geschieht **vollständig im Browser**: kein Neustart, kein Weg zum Server.

---

## 🔧 Konfiguration

Alles, was je nach Einsatz variiert, steht in `cordis.patch.yml` (oder einer Überlagerung im Profil). Nichts ist fest verdrahtet.

```yaml
- id: memoir
  name: '@yansera/dsh-memoir'
  config:
    memoryDir: ''              # leer = $DSH_HOME/memoir
    injectIndex: true          # Gedächtnisindex in den Systemprompt einfügen
    maxInjectEntries: 12       # höchstens so viele Einträge einfügen
    autoDistill: true          # am Ende jeder Runde umschreiben
    distillDebounceMs: 20000   # Ruhezeit vor dem Umschreiben (ms)
    distillMinChars: 400       # kürzere Abschnitte überspringen
    distillMaxItems: 60        # Obergrenze an Einträgen, dem Modell vorgeschlagen
    distillMaxTokens: 8000     # Untergrenze des Ausgabebudgets (wächst mit dem Heft)
    distillReasoningEffort: off # Umschreiben braucht kein Nachdenken
    pageEntryLimit: 12         # darüber in einer Kategorie → Zwangs-Aufräumen
    bookEntryLimit: 40         # darüber im Heft → Zwangs-Aufräumen
```

**Wohin gehen in der Seite geänderte Einstellungen?** In `.settings.json` im Gedächtnisverzeichnis — bei Ihren Daten, also profil- und update-fest.

**Nach Konfigurationsänderungen neu starten.** Dieselbe Regel wie beim Code: Hot Reload gibt es nur bei der Installation.

---

## 📂 Speicherformat

```
$DSH_HOME/memoir/          ← Standardort; über memoryDir änderbar
├── .order                 ← Reihenfolge der Kategorien, eine Kennung je Zeile
├── .settings.json         ← in der Seite geänderte Einstellungen
├── user.md                ← eine Datei = eine Kategorie
└── ...
```

**Keine Datenbank, kein Index, kein Cache.** Jedes Lesen und Schreiben geht direkt auf die Platte — die Dateien sind winzig, und der Gewinn ist, dass eine Handänderung beim nächsten Neuladen sichtbar ist.

**Regeln für Handarbeit:**

| Zeile | Bedeutung |
|---|---|
| `# Titel` | Anzeigename der Kategorie (Kopfzeile, übersprungen) |
| `## Abschnitt` | Abschnitt der zweiten Ebene; folgende Einträge gehören dazu |
| `- Text` | eine Erinnerung |
| `  <!-- memoir … -->` | Metadaten des vorigen Eintrags (weglassbar) |
| um 2+ Leerzeichen eingerückte Zeilen | Fortsetzung des vorigen Eintrags |
| alles andere (leer, Fließtext, `###`) | Formatierung, ignoriert |

**Kennungen leiten sich vom Inhalt ab**: bleibt der Text gleich, bleibt die Kennung gleich. Deshalb zerstört ein vollständiges Umschreiben nie Ihre Position in der Seite.

---

## ❓ Häufige Fragen

**Worin unterscheidet es sich von `dsh-mneme`?**
Sie decken verschiedene Ebenen ab. mneme pflegt **kurzfristiges, prozedurales** Gedächtnis (technische Details, Fallstricke, Projektfortschritt); Memoir pflegt die **langfristige, makroskopische** Ebene (wer der Nutzer ist, wer der Assistent ist, was läuft, welche großen Entscheidungen fielen). Beide bestehen nebeneinander, die Daten sind völlig getrennt.

**Warum stehen keine technischen Details in meinem Heft?**
Absicht. Technische Details begraben die Karte „Zum Nutzer“ unter zwanzig Kommandozeilen, und dann liest sie niemand. Das gehört zu einem anderen Gedächtnissystem.

**Muss ich nach dem Bearbeiten des Markdown neu starten?**
Nein. Gelesen wird bei jeder Anfrage; Seite neu laden genügt.

**Verliere ich Daten, wenn ich den Schreibschalter ausschalte?**
Nein. Er stoppt Lesen und Schreiben; die Dateien bleiben unverändert und beim Einschalten geht es weiter.

**Stellt es heimlich Netzwerkanfragen?**
Nein. Abgesehen von der `llm`-Fähigkeit des Hosts zum Umschreiben stellt es keine eigenen Anfragen, liest nichts außerhalb des Gedächtnisverzeichnisses und sammelt keine Telemetrie.

**Gehen meine Erinnerungen an einen Modellanbieter?**
**Ja** — der Gedächtnisindex wird in jede Modellanfrage eingefügt, und ein Umschreiben sendet das ganze Heft. Also **niemals Passwörter, Token oder private Schlüssel ins Gedächtnis**. Siehe [SECURITY.md](SECURITY.md).

---

## 🛠 Entwicklung

```sh
npm test                # alle 222 Offline-Tests
npm run test:store      # Speicher: Analyse, Dedupe, Verschieben, Suche, Kürzung
npm run test:plugin     # Host-Hälfte: Registrierungen, Werkzeuge, Prompt, HTTP-Routen
npm run test:client     # Browser-Hälfte: rendert das echte Bundle mit React-Ersatz
npm run test:distill    # Umschreiben: Ausgabeanalyse, Entprellung, Cursor, Schwellwerte
```

Alles läuft offline: kein DSH-Host nötig, kein echtes Profil wird berührt.

**Nach Änderungen am Quelltext** (Windows):

```powershell
& .\scripts\sync.ps1
```

pnpm verlinkt `file:`-Abhängigkeiten per Hardlink: Quelltext bearbeiten bricht den Link, und die installierte Kopie veraltet — synchronisieren, dann den Client neu starten.

**Aufbau:**

```
src/       Implementierung (index = Host, distill = Umschreiben, client = Browser)
test/      Offline-Tests
docs/      Notizen zu Entwurf und Format
scripts/   Synchronisationsskript, Live-Smoke-Test
```

Mehr in [CONTRIBUTING.md](CONTRIBUTING.md) und [docs/](docs/):
[Entwurf](docs/design.md) · [Speicherformat](docs/storage-format.md) · [Konfiguration](docs/configuration.md).

---

## 📄 Lizenz

[MIT](LICENSE) © Yansera
