# Memoir

[简体中文](README.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [日本語](README.ja.md) · **English**

[![CI](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml/badge.svg)](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yansera/dsh-living-memoir?color=0969da&label=npm)](https://www.npmjs.com/package/@yansera/dsh-living-memoir)
[![license](https://img.shields.io/badge/license-MIT-8250df)](LICENSE)

Cross-session memory for DeepSeek Harness. Memories are kept as a set of Markdown files that get rewritten in full at the end of each turn, instead of being appended to.

![The page and the memory directory](docs/assets/hero.en.svg)

## 📦 Install

```sh
dsh plugin --profile desktop add @yansera/dsh-living-memoir
```

Replace `desktop` with your profile name. `dsh` ships with DeepSeek Harness; on the desktop build it lives at `<install dir>\resources\runtime\cli\bin\dsh.cmd`.

To install from source:

```sh
dsh plugin --profile desktop add 'file:D:\path\to\dsh-living-memoir'
```

Fully quit the client and reopen it afterwards. DSH loads plugin code only at install time, and closing the window is not quitting.

## 🚀 What it looks like

A "Memoir" entry appears in the sidebar. Clicking it takes over the main area: categories on the left, entries on the right. "← Back to chat" in the top left returns to the conversation.

Nothing to configure after that. The model writes on its own when you state a lasting preference, settle a decision, or correct it. You can also click "Add entry", or edit the Markdown files under `$DSH_HOME/memoir/` directly; refresh the page to see the change.

To stop it, turn off "Memory writes" in the settings at the top right. With that off nothing is read and nothing is written.

## 🧱 Three layers

```
# Things in flight

<!-- one section per project · hand-editable -->

## Memoir

- Keeps cross-session memory as a short Markdown living document
  <!-- memoir id=a1b2c3d4 | imp=4 | conf=high | at=2026-10-07 | src=user said so -->

## Net: semantic topology

- Grows a network whose topology carries meaning
```

The first layer is the category, one Markdown file each. The second is a section, usually one per project. The third is an entry: one sentence, and no deeper.

Categories are split by topic, not by kind of information. When people look something up they think "which project is this", not "is this a decision or a progress note". Everything about one project lives under its own section.

The number and shape of categories is decided by the model from the content; there is no fixed list. Five starter categories are laid down on install, and you can delete the ones you don't want. When a category grows too large, or turns out to hold two unrelated things, the model splits it.

## ✍️ Three ways in

Model tools: the model decides something is worth keeping and calls `memoir_note`. `memoir_recall` and `memoir_forget` read and delete.

The page: click "Add entry", or edit the Markdown files directly.

Automatic rewriting: 20 seconds after a turn goes quiet, the whole book is read and a rewritten version is committed.

The first two append. The third rewrites, and that is the point of the whole thing: it keeps the document from only ever growing.

## 🔄 Automatic rewriting

The model is given the full current contents of the book plus the new stretch of conversation, and returns a complete rewritten version. Merging, dropping, rewording and adding all happen in that one step.

A few guards:

- A per-session cursor consumes only events since the last run, so the same stretch is never rewritten twice
- A failed run does not advance the cursor; the next turn end retries the same stretch
- A stretch shorter than 400 characters is skipped, but the cursor still advances
- Concurrent sessions queue rather than all firing at once
- If categories cannot be parsed nothing is written; if the total entry count drops by more than half (from at least 6), the rewrite is rejected outright

Each entry carries two marks. `conf` is confidence: `high` for something you said yourself, `med` for something distilled from the conversation, `low` for something the model inferred. When space is needed, `low` goes first. `pin` means pinned: a pinned entry must survive a rewrite unchanged. There are at most a handful of those.

## ⚙️ Settings

The gear icon at the top right. Changes are stored in `.settings.json` inside the memory directory, alongside your data, so they survive a profile switch.

With the master write switch off, memory is no longer injected into the prompt, the three tools refuse to run, writes from the page and over HTTP return 403, and automatic rewriting stops.

The model used for rewriting is picked from what the host already has registered. The plugin calls `ctx.llm.listProviders()` and `ctx.llm.listModels(provider)` and turns the result into a dropdown, so you never type a provider name or a model id. Anything wired into DSH shows up there, whether built in, local, or a third-party API. There are still two fields below the dropdown for anything the host does not list.

Reasoning is off by default. Rewriting is tidying, not problem solving, and a thinking model spends the output budget on reasoning and returns no text at all.

Interface language and memory language are separate switches. The first changes buttons and labels; the second decides which language is written into the files, category and section names included. Both default to English.

## 🔧 Configuration

Deployment-level configuration goes in `cordis.patch.yml`:

```yaml
- id: memoir
  name: '@yansera/dsh-living-memoir'
  config:
    memoryDir: ''              # empty = $DSH_HOME/memoir
    injectIndex: true          # inject the memory index into the system prompt
    maxInjectEntries: 12       # how many entries to inject at most
    autoDistill: true          # rewrite at the end of every turn
    distillDebounceMs: 20000   # quiet period before rewriting (ms)
    distillMinChars: 400       # skip stretches shorter than this
    distillMaxItems: 60        # entry ceiling for the whole book
    distillMaxTokens: 8000     # output budget floor; raised automatically with size
    distillReasoningEffort: off # rewriting needs no reasoning
    memoryLanguage: ''         # language of the entries; empty = unrestricted
    pageEntryLimit: 12         # entries per category that trigger a forced tidy-up
    bookEntryLimit: 40         # entries in the book that trigger a forced tidy-up
```

A restart is needed afterwards, same as for code changes.

## 📂 What the files look like

One Markdown file per category. Plain text, openable in any editor, fine under version control. No database, no cache, no private format.

Entry metadata sits in HTML comments and does not get in the way of reading:

```
- Asks before any download, and wants the size in GB
  <!-- memoir id=8daa8849 | imp=5 | conf=high | at=2026-10-09 | src=user said so | pin -->
```

Adding a line that starts with `- ` adds an entry. The parser recognises three kinds of line (`# category`, `## section`, `- entry`) and ignores everything else.

## ❓ Questions

**Does it clash with other memory setups.** No. Memoir only handles the long-term, high-level layer: who the user is, who the assistant is, what is in flight, which big decisions were made. Short-term and procedural content, such as technical details, pitfalls and progress logs, is out of scope and never written here. The data lives in its own directory.

**Will it just keep growing.** No. It is rewritten rather than appended to, so its length follows the content and not the history. Passing 12 entries in a category or 40 in the book triggers a forced tidy-up.

**What if a memory gets rewritten wrong.** Every category file can be edited directly, and a page refresh picks the change up. The next rewrite respects category names you have changed. Important entries can be marked `pin`.

**Does it send data anywhere.** No. The plugin makes no network requests of its own; rewriting goes through the host's own `llm` capability.

**Can I take the memory with me.** Yes. The whole memory store is one directory; copy it.

## 🛠 Development

```sh
npm test                # all 259 offline self-tests
npm run test:store      # storage: parsing, dedupe, move, search, injected text
npm run test:plugin     # host half: registrations, tools, prompt, HTTP routes
npm run test:client     # page half: real bundle rendered against a React stand-in
npm run test:distill    # rewriting: parsing, debounce, cursors, retries
```

The tests are fully offline. They need no DSH host and touch no real profile.

After changing source (Windows):

```powershell
& .\scripts\sync.ps1
```

When pnpm installs a local package through `file:`, it hard-links the files. Editing the source breaks the link and the installed copy stops updating, so a sync and a restart are both required.

Layout:

```
src/       the implementation (index = host half, distill = rewriting, client = page half)
test/      offline self-tests
docs/      design and format notes
scripts/   sync script, smoke test against a running client
```

More detail in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/): [design](docs/design.md), [storage format](docs/storage-format.md), [configuration](docs/configuration.md).

## 📄 License

[MIT](LICENSE) © Yansera
