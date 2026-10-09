# Memoir

[简体中文](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [日本語](README.ja.md) · **Français**

[![CI](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml/badge.svg)](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yansera/dsh-living-memoir?color=0969da&label=npm)](https://www.npmjs.com/package/@yansera/dsh-living-memoir)
[![license](https://img.shields.io/badge/license-MIT-8250df)](LICENSE)

Mémoire inter-sessions pour DeepSeek Harness. Les souvenirs sont conservés dans un ensemble de fichiers Markdown qui sont réécrits en entier à la fin de chaque tour, au lieu d'être ajoutés à la suite.

![La page et le répertoire de mémoire](docs/assets/hero.en.svg)

## 📦 Installation

```sh
dsh plugin --profile desktop add @yansera/dsh-living-memoir
```

Remplacez `desktop` par le nom de votre profil. `dsh` est fourni avec DeepSeek Harness ; sur la version bureau il se trouve dans `<dossier d'installation>\resources\runtime\cli\bin\dsh.cmd`.

Pour installer depuis les sources :

```sh
dsh plugin --profile desktop add 'file:D:\chemin\vers\dsh-living-memoir'
```

Quittez complètement le client et relancez-le ensuite. DSH ne charge le code d'un greffon qu'au moment de l'installation, et fermer la fenêtre ne revient pas à quitter.

## 🚀 À quoi ça ressemble

Une entrée « Memoir » apparaît dans la barre latérale. Un clic occupe toute la zone principale : les catégories à gauche, les entrées à droite. « ← Retour au chat » en haut à gauche ramène à la conversation.

Rien à configurer ensuite. Le modèle écrit de lui-même quand vous énoncez une préférence durable, arrêtez une décision ou le corrigez. Vous pouvez aussi cliquer sur « Ajouter une entrée », ou modifier directement les fichiers Markdown sous `$DSH_HOME/memoir/` ; rechargez la page pour voir le changement.

Pour l'arrêter, désactivez « Écritures mémoire » dans les réglages en haut à droite. Dans cet état, rien n'est lu et rien n'est écrit.

## 🧱 Trois niveaux

```
# Chantiers en cours

<!-- une section par projet · modifiable à la main -->

## Memoir

- Garde la mémoire inter-sessions comme un court document Markdown vivant
  <!-- memoir id=a1b2c3d4 | imp=4 | conf=high | at=2026-10-07 | src=l'utilisateur l'a dit -->

## Réseau : topologie sémantique

- Fait pousser un réseau dont la topologie porte le sens
```

Le premier niveau est la catégorie, un fichier Markdown chacune. Le deuxième est une section, en général une par projet. Le troisième est une entrée : une phrase, et pas plus profond.

Les catégories sont découpées par thème, pas par type d'information. Quand on cherche quelque chose, on pense « c'est quel projet », pas « est-ce une décision ou une note d'avancement ». Tout ce qui concerne un projet vit sous sa propre section.

Le nombre et la forme des catégories sont décidés par le modèle à partir du contenu ; il n'y a pas de liste figée. Cinq catégories de départ sont posées à l'installation, et vous supprimez celles dont vous ne voulez pas. Quand une catégorie devient trop grosse, ou s'avère contenir deux choses sans rapport, le modèle la scinde.

## ✍️ Trois façons d'écrire

Outils du modèle : le modèle juge que quelque chose vaut la peine d'être gardé et appelle `memoir_note`. `memoir_recall` et `memoir_forget` lisent et suppriment.

La page : cliquez sur « Ajouter une entrée », ou modifiez les fichiers Markdown directement.

Réécriture automatique : vingt secondes après qu'un tour s'est tu, tout le carnet est relu et une version réécrite est écrite.

Les deux premières ajoutent. La troisième réécrit, et c'est tout l'intérêt de la chose : elle empêche le document de ne faire que grossir.

## 🔄 Réécriture automatique

Le modèle reçoit le contenu complet actuel du carnet plus le nouvel extrait de conversation, et renvoie une version entièrement réécrite. Fusion, suppression, reformulation et ajout ont tous lieu dans cette seule étape.

Quelques garde-fous :

- Un curseur par session ne consomme que les événements depuis la dernière exécution, donc le même extrait n'est jamais réécrit deux fois
- Une exécution en échec n'avance pas le curseur ; la fin du tour suivant réessaie le même extrait
- Un extrait de moins de 400 caractères est ignoré, mais le curseur avance quand même
- Les sessions simultanées font la queue au lieu de partir toutes en même temps
- Si les catégories ne se laissent pas analyser, rien n'est écrit ; si le total des entrées chute de plus de moitié (à partir de 6), la réécriture est purement rejetée

Chaque entrée porte deux marques. `conf` est la confiance : `high` pour ce que vous avez dit vous-même, `med` pour ce qui a été tiré de la conversation, `low` pour ce que le modèle a déduit. Quand il faut faire de la place, `low` part en premier. `pin` signifie épinglé : une entrée épinglée doit survivre à une réécriture sans changement. Il y en a tout au plus quelques-unes.

## ⚙️ Réglages

L'icône d'engrenage en haut à droite. Les changements sont stockés dans `.settings.json`, à l'intérieur du répertoire de mémoire, avec vos données, donc ils survivent à un changement de profil.

Quand l'interrupteur principal d'écriture est désactivé, la mémoire n'est plus injectée dans le prompt, les trois outils refusent de s'exécuter, les écritures depuis la page et par HTTP renvoient 403, et la réécriture automatique s'arrête.

Le modèle utilisé pour la réécriture se choisit parmi ce que l'hôte a déjà enregistré. Le greffon appelle `ctx.llm.listProviders()` et `ctx.llm.listModels(provider)` et transforme le résultat en liste déroulante, donc vous ne tapez jamais un nom de fournisseur ni un identifiant de modèle. Tout ce qui est branché sur DSH y apparaît, qu'il soit intégré, local ou une API tierce. Deux champs restent sous la liste pour ce que l'hôte n'énumère pas.

Le raisonnement est désactivé par défaut. Réécrire, c'est ranger, pas résoudre, et un modèle qui réfléchit dépense le budget de sortie en raisonnement et ne renvoie aucun texte.

La langue de l'interface et celle des souvenirs sont deux réglages distincts. La première change les boutons et les libellés ; la seconde décide quelle langue est écrite dans les fichiers, noms de catégories et de sections compris. Les deux sont en anglais par défaut.

## 🔧 Configuration

La configuration de déploiement va dans `cordis.patch.yml` :

```yaml
- id: memoir
  name: '@yansera/dsh-living-memoir'
  config:
    memoryDir: ''              # vide = $DSH_HOME/memoir
    injectIndex: true          # injecter l'index mémoire dans le prompt système
    maxInjectEntries: 12       # nombre maximum d'entrées injectées
    autoDistill: true          # réécrire à la fin de chaque tour
    distillDebounceMs: 20000   # temps de silence avant réécriture (ms)
    distillMinChars: 400       # ignorer les extraits plus courts
    distillMaxItems: 60        # plafond d'entrées pour tout le carnet
    distillMaxTokens: 8000     # plancher du budget de sortie, relevé selon la taille
    distillReasoningEffort: off # la réécriture n'a pas besoin de raisonnement
    memoryLanguage: ''         # langue des entrées ; vide = sans restriction
    pageEntryLimit: 12         # entrées par catégorie déclenchant un rangement forcé
    bookEntryLimit: 40         # entrées du carnet déclenchant un rangement forcé
```

Un redémarrage est nécessaire ensuite, comme pour les changements de code.

## 📂 À quoi ressemblent les fichiers

Un fichier Markdown par catégorie. Du texte brut, ouvrable dans n'importe quel éditeur, compatible avec un système de versions. Pas de base de données, pas de cache, pas de format propriétaire.

Les métadonnées d'une entrée sont dans des commentaires HTML et ne gênent pas la lecture :

```
- Demande avant tout téléchargement, et veut la taille en Go
  <!-- memoir id=8daa8849 | imp=5 | conf=high | at=2026-10-09 | src=l'utilisateur l'a dit | pin -->
```

Ajouter une ligne qui commence par `- ` ajoute une entrée. L'analyseur reconnaît trois sortes de lignes (`# catégorie`, `## section`, `- entrée`) et ignore tout le reste.

## ❓ Questions

**Est-ce que ça entre en conflit avec d'autres dispositifs de mémoire.** Non. Memoir ne traite que la couche long terme et macroscopique : qui est l'utilisateur, qui est l'assistant, ce qui est en cours, quelles grandes décisions ont été prises. Le contenu court terme et procédural, comme les détails techniques, les pièges et les journaux d'avancement, est hors périmètre et n'est jamais écrit ici. Les données vivent dans leur propre répertoire.

**Est-ce que ça va grossir sans fin.** Non. C'est réécrit plutôt qu'ajouté, donc sa longueur suit le contenu et non l'historique. Dépasser 12 entrées dans une catégorie ou 40 dans le carnet déclenche un rangement forcé.

**Et si un souvenir est réécrit de travers.** Chaque fichier de catégorie peut être modifié directement, et un rechargement de la page prend le changement en compte. La réécriture suivante respecte les noms de catégories que vous avez changés. Les entrées importantes peuvent être marquées `pin`.

**Est-ce que ça envoie des données quelque part.** Non. Le greffon ne fait aucune requête réseau lui-même ; la réécriture passe par la capacité `llm` de l'hôte.

**Puis-je emporter la mémoire avec moi.** Oui. Tout le magasin de mémoire tient dans un répertoire ; copiez-le.

## 🛠 Développement

```sh
npm test                # les 259 autotests hors ligne
npm run test:store      # stockage : analyse, déduplication, déplacement, recherche
npm run test:plugin     # moitié hôte : enregistrements, outils, prompt, routes HTTP
npm run test:client     # moitié page : vrai bundle rendu contre un substitut React
npm run test:distill    # réécriture : analyse, anti-rebond, curseurs, reprises
```

Les tests sont entièrement hors ligne. Ils n'ont besoin d'aucun hôte DSH et ne touchent à aucun profil réel.

Après avoir modifié les sources (Windows) :

```powershell
& .\scripts\sync.ps1
```

Quand pnpm installe un paquet local via `file:`, il crée des liens durs. Modifier les sources casse le lien et la copie installée cesse de se mettre à jour, donc une synchronisation et un redémarrage sont tous deux nécessaires.

Arborescence :

```
src/       l'implémentation (index = moitié hôte, distill = réécriture, client = moitié page)
test/      autotests hors ligne
docs/      notes de conception et de format
scripts/   script de synchronisation, test de fumée sur un client en cours
```

Plus de détails dans [CONTRIBUTING.md](CONTRIBUTING.md) et [docs/](docs/) : [conception](docs/design.md), [format de stockage](docs/storage-format.md), [configuration](docs/configuration.md).

## 📄 Licence

[MIT](LICENSE) © Yansera
