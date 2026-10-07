# Memoir

[简体中文](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [日本語](README.ja.md) · **Français**

[![npm](https://img.shields.io/npm/v/@yansera/dsh-memoir?color=0969da&label=npm)](https://www.npmjs.com/package/@yansera/dsh-memoir)
[![CI](https://github.com/Yansera/dsh-memoir/actions/workflows/ci.yml/badge.svg)](https://github.com/Yansera/dsh-memoir/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-238%20passing-2da44e)](test/)
[![license](https://img.shields.io/badge/license-MIT-8250df)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20.18-339933)](package.json)

> **La mémoire inter-sessions pour DeepSeek Harness, tenue comme un document Markdown vivant, court et lisible** — avec sa propre page dans l'interface.

![Memoir : un fichier Markdown par catégorie, trois niveaux, plus une page dédiée](docs/assets/hero.svg)

---

## Le problème qu'il résout

Presque tous les projets de mémoire pour IA cherchent à **retenir plus, et retrouver mieux**.

Memoir fait l'inverse. Il ne résout qu'une chose : **garder la mémoire assez courte pour qu'on ait envie de la lire.**

Un souvenir, c'est une phrase. Lire tout le carnet prend moins de deux minutes. Il ne grossit pas à chaque tour de conversation — parce qu'il est **réécrit**, non **complété**.

---

## ✨ Ce qui change

| | L'approche courante | Memoir |
|---|---|---|
| **Croissance** | Ne fait que croître ; un humain doit élaguer | **Réécrit en entier à chaque tour** : fusionner, raccourcir, supprimer, ajouter. La longueur suit le contenu, pas l'historique |
| **Rôle du modèle** | Un greffier — ajoute une ligne quand du nouveau apparaît | Un **éditeur** — relit tout et rend une meilleure version |
| **Structure** | Une liste plate, ou des catégories figées dans le code | **Trois niveaux** : catégorie → section → entrée. Catégories et sections sont créées et supprimées par le modèle, par thème |
| **Données** | Une base, un index vectoriel, un format propriétaire | **De simples fichiers Markdown.** Ouvrables dans n'importe quel éditeur, modifiables à la main, versionnables |
| **Contrôle de taille** | Erreur quand c'est plein | **Déclencheur de capacité** : au-delà de 12 entrées dans une catégorie ou 40 dans le carnet, un rangement forcé est demandé |
| **Pour l'arrêter** | Le désinstaller | Un **interrupteur d'écriture** dans la page. Éteint = rien n'est lu ni écrit |

En une phrase : **les autres travaillent sur ce qu'il faut retenir ; celui-ci travaille sur le rendre lisible.**

---

## 🚀 Démarrage rapide

### 1. Installer

```sh
dsh plugin --profile desktop add @yansera/dsh-memoir
```

> Remplacez `desktop` par le nom de votre profil (`web` en général côté web).
> `dsh` est fourni avec DeepSeek Harness — côté client de bureau : `<dossier d'installation>\resources\runtime\cli\bin\dsh.cmd`.

**Depuis les sources** (développement) :

```sh
dsh plugin --profile desktop add 'file:D:\chemin\vers\dsh-memoir'
```

### 2. Redémarrer le client

**Cette étape n'est pas facultative.** DSH ne charge le code d'un greffon **qu'au moment de l'installation** ; modifier des fichiers ensuite ne change rien. Fermer la fenêtre ne quitte pas l'application : quittez complètement, puis relancez.

### 3. L'ouvrir

Une icône **Memoir** apparaît dans la barre latérale. Un clic bascule toute la zone principale sur la mémoire : catégories à gauche, entrées à droite. **« ← Retour au chat »** en haut à gauche vous ramène à tout moment.

### 4. S'en servir

Rien à configurer. Ensuite :

- **Le modèle écrit tout seul** — quand vous énoncez une préférence durable, tranchez une décision ou le corrigez, il appelle `memoir_note`
- **Vous pouvez écrire aussi** — bouton « Nouvelle entrée », ou **édition directe des fichiers Markdown** sous `$DSH_HOME/memoir/` (rafraîchissez la page)
- **Chaque tour range** — 20 secondes après qu'un tour se calme, la tâche de fond relit tout le carnet et le réécrit

**Pour l'arrêter ?** En haut à droite, **⚙** → désactivez **Écriture mémoire**. Rien n'est lu, rien n'est écrit.

---

## 🧱 Trois niveaux, jamais plus

```
# Chantiers en cours              ← niveau 1 : catégorie. Peu nombreuses et larges

<!-- projets, étape actuelle · modifiable à la main -->

## Memoir                         ← niveau 2 : section. Une par projet ou thème

- Garde la mémoire inter-sessions comme un document Markdown vivant    ← niveau 3 : entrée
  <!-- memoir id=a1b2c3d4 | imp=4 | at=2026-10-07 | src=auto -->

## Réseau : topologie sémantique

- Faire émerger un réseau dont la topologie porte le sens, par mutation et sélection
```

| Niveau | Syntaxe | Décidé par |
|---|---|---|
| **Catégorie** | un fichier `.md` | le modèle, par thème — aucune liste figée dans le code |
| **Section** | `## Projet` | tout ce qui touche un projet va dessous ; à omettre si inutile |
| **Entrée** | `- une phrase` | fin de la hiérarchie — rien de plus profond |

**Pourquoi organiser par thème et non par nature ?** Parce qu'en cherchant, on pense *« c'était quel projet ? »*, pas *« était-ce une décision ou un état d'avancement ? »*. Organiser par nature éparpille un même projet dans plusieurs tiroirs.

Cinq catégories sont créées au premier lancement : **À propos de l'utilisateur · Préférences et règles · Chantiers en cours · Décisions · À propos de l'assistant**. Ce n'est qu'un point de départ — supprimez ce qui ne vous sert pas.

---

## ✍️ Trois chemins d'écriture, un document vivant

![Trois chemins d'écriture alimentent un document vivant ; un seuil de capacité déclenche un rangement](docs/assets/pipeline.svg)

| Chemin | Déclenché par | Qui écrit |
|---|---|---|
| **Outils du modèle** | le modèle juge que cela vaut d'être gardé | `memoir_note` / `memoir_recall` / `memoir_forget` |
| **La page** | vous cliquez « Nouvelle entrée » ou éditez le Markdown | vous |
| **Réécriture automatique** | à la fin de chaque tour | le modèle relit et rend une réécriture complète |

> Les deux premiers **ajoutent**. Le troisième **réécrit**. C'est lui qui compte : c'est ce qui empêche le carnet de ne faire que grossir.

---

## 🔄 La réécriture automatique

Une fois un tour retombé (20 secondes par défaut), la tâche de fond **réécrit tout le carnet** :

> Le modèle reçoit *le carnet tel qu'il est* plus *cet échange*, et doit rendre **la version complète réécrite** — ce qu'il faut fusionner est fusionné, ce qui est périmé est raccourci, ce qui est mort disparaît, ce qui est nouveau s'ajoute. Les catégories et les sections peuvent aussi changer de forme.

Il se comporte donc comme un **éditeur** qui tient un document vivant, non comme un greffier qui allonge un journal.

**Garde-fous :**

- **Curseur par session** — seuls les événements nouveaux sont consommés, un même passage n'est jamais réécrit deux fois
- **Un échec n'avance pas le curseur** — le tour suivant réessaie le même passage
- **Trop peu de contenu est ignoré** (400 caractères par défaut), mais le curseur avance quand même
- **Sérialisation globale** — plusieurs sessions qui se terminent en même temps mettent leurs requêtes en file
- **Deux filets de sécurité** : si aucune catégorie n'est analysable, rien n'est écrit ; si le nombre d'entrées chute de plus de la moitié (à partir de 6), la réécriture est refusée et le fichier reste intact

Sans service `llm` (aucun modèle configuré), tout ce chemin est ignoré en silence et les outils comme la page continuent de fonctionner.

### Déclencheur de capacité

La réécriture seule ne suffit pas : livrée à elle-même elle ne fait que des retouches, et le compte grimpe quand même. D'où deux seuils :

| Seuil | Défaut | Sens |
|---|---|---|
| `pageEntryLimit` | 12 | entrées dans une même catégorie |
| `bookEntryLimit` | 40 | entrées dans tout le carnet |

**Dès que l'un est franchi**, la réécriture reçoit en plus un **ordre de rangement forcé** indiquant le nombre exact d'entrées et les catégories en excès, et exigeant trois choses :

1. **Fusionner** — regrouper synonymes et entrées proches en une phrase
2. **Raccourcir** — réduire les entrées verbeuses à leur conclusion
3. **Ajouter des sections** — découper une catégorie surchargée avec `##` plutôt que de laisser vingt entrées à plat

**Sous les seuils, rien de tout cela n'est ajouté** et la réécriture reste légère.

---

## ⚙️ Réglages

En haut à droite de la page, **⚙**.

### Interrupteur d'écriture

Éteint signifie **rien n'est lu et rien n'est écrit** :

- la mémoire n'est plus injectée dans le prompt système
- les trois outils refusent de s'exécuter
- les écritures depuis la page et l'API HTTP renvoient 403
- la réécriture automatique s'arrête

Pratique pour « ne note pas cette conversation » — bien plus léger qu'une désinstallation.

### Quel modèle réécrit

| Champ | Sens |
|---|---|
| **Fournisseur** | vide = suivre le modèle par défaut de l'agent. Sinon, le nom du fournisseur côté hôte |
| **Modèle** | vide = suivre le défaut. Sinon un identifiant, par exemple `qwen3-8b` |
| **Effort de raisonnement** | `désactivé` / `faible` / `élevé` / `maximal` / `ne pas envoyer` |

**Quels modèles puis-je choisir ?** Tout fournisseur **déjà enregistré sur l'hôte** :

- **Fourni avec DSH** — par ex. `deepseek-flash` sous `deepseek-official`
- **Un modèle local** — le serveur d'inférence local que vous avez branché sur DSH (Ollama, llama.cpp, …)
- **Une API tierce** — tout point de terminaison compatible OpenAI configuré comme fournisseur dans DSH

> Le greffon **ne fait aucune requête réseau lui-même** : tout passe par la capacité `llm` de l'hôte. Ce que vous pouvez choisir dépend donc de ce que vous avez branché sur DSH.

**Pourquoi le raisonnement est-il désactivé par défaut ?** Réécrire, c'est **ranger**, pas **résoudre**. Nous l'avons mesuré : un modèle « qui réfléchit » brûle le budget de sortie en raisonnement et n'a plus rien pour le texte — symptôme : « requête réussie mais aucun bloc de texte renvoyé ». Le désactiver donne tout le budget au texte.

---

## 🌍 Langues de l'interface

**简体中文 · English · Français · Deutsch · 日本語**

Deux façons de changer :

- **Suivre l'hôte** (défaut) — la langue utilisée par DSH
- **Choisir dans les réglages** — ⚙ → Langue

Le changement se fait **entièrement côté navigateur** : sans redémarrage, sans aller-retour serveur.

---

## 🔧 Configuration

Tout ce qui varie selon le déploiement vit dans `cordis.patch.yml` (ou une surcouche de votre profil). Rien n'est codé en dur.

```yaml
- id: memoir
  name: '@yansera/dsh-memoir'
  config:
    memoryDir: ''              # vide = $DSH_HOME/memoir
    injectIndex: true          # injecter l'index mémoire dans le prompt système
    maxInjectEntries: 12       # nombre maximal d'entrées injectées
    autoDistill: true          # réécrire à la fin de chaque tour
    distillDebounceMs: 20000   # délai de calme avant réécriture (ms)
    distillMinChars: 400       # ignorer un échange plus court que cela
    distillMaxItems: 60        # plafond d'entrées du carnet, suggéré au modèle
    distillMaxTokens: 8000     # plancher du budget de sortie (monte avec la taille)
    distillReasoningEffort: off # réécrire ne demande pas de raisonnement
    pageEntryLimit: 12         # au-delà dans une catégorie → rangement forcé
    bookEntryLimit: 40         # au-delà dans le carnet → rangement forcé
```

**Où vont les réglages modifiés dans la page ?** Dans `.settings.json`, à l'intérieur du répertoire de mémoire — avec vos données, donc conservés malgré un changement de profil ou une mise à jour du greffon.

**Redémarrez après un changement de configuration.** Même règle que pour le code : le rechargement à chaud n'a lieu qu'à l'installation.

---

## 📂 Format de stockage

```
$DSH_HOME/memoir/          ← emplacement par défaut ; modifiable via memoryDir
├── .order                 ← ordre des catégories, un identifiant par ligne
├── .settings.json         ← réglages modifiés dans la page
├── user.md                ← un fichier = une catégorie
└── ...
```

**Aucune base de données, aucun index, aucun cache.** Chaque lecture et écriture va directement sur le disque — les fichiers sont minuscules, et le gain est qu'une modification à la main apparaît au prochain rafraîchissement.

**Règles d'édition manuelle :**

| Ligne | Sens |
|---|---|
| `# Titre` | nom affiché de la catégorie (en-tête, ignoré) |
| `## Section` | section de niveau deux ; les entrées suivantes lui appartiennent |
| `- texte` | un souvenir |
| `  <!-- memoir … -->` | métadonnées de l'entrée précédente (omissibles) |
| lignes indentées de 2 espaces ou plus | suite de l'entrée précédente |
| le reste (vide, prose, `###`) | mise en forme, ignoré |

**Les identifiants dérivent du contenu** : si le texte ne change pas, l'identifiant ne change pas. C'est pourquoi une réécriture complète ne casse jamais votre position dans la page.

---

## ❓ Questions fréquentes

**Quelle différence avec `dsh-mneme` ?**
Ils couvrent des couches différentes. mneme gère la mémoire **court terme et procédurale** (détails techniques, pièges, avancement des projets) ; Memoir gère la couche **long terme et macroscopique** (qui est l'utilisateur, qui est l'assistant, ce qui est en cours, quelles grandes décisions ont été prises). Les deux coexistent et leurs données sont totalement séparées.

**Pourquoi aucun détail technique dans mon carnet ?**
C'est voulu. Le détail technique ensevelit la fiche « À propos de l'utilisateur » sous vingt lignes de commandes, et plus personne ne la lit. Cela relève d'un autre système de mémoire.

**Faut-il redémarrer après avoir édité le Markdown ?**
Non. La lecture se fait à chaque requête ; rafraîchissez la page.

**Couper l'interrupteur d'écriture fait-il perdre des données ?**
Non. Cela arrête lecture et écriture ; les fichiers restent tels quels et tout reprend à la réactivation.

**Fait-il des requêtes réseau dans mon dos ?**
Non. Hormis la capacité `llm` de l'hôte pour la réécriture, il n'émet aucune requête, ne lit rien en dehors du répertoire de mémoire et ne collecte aucune télémétrie.

**Mes souvenirs partent-ils chez un fournisseur de modèle ?**
**Oui** — l'index mémoire est injecté dans chaque requête, et une réécriture envoie tout le carnet. Donc **jamais de mot de passe, de jeton ou de clé privée dans la mémoire**. Voir [SECURITY.md](SECURITY.md).

---

## 🛠 Développement

```sh
npm test                # les 238 tests hors ligne
npm run test:store      # stockage : analyse, déduplication, déplacements, recherche
npm run test:plugin     # moitié hôte : enregistrements, outils, prompt, routes HTTP
npm run test:client     # moitié navigateur : rend le vrai bundle avec un substitut React
npm run test:distill    # réécriture : analyse de sortie, anti-rebond, curseur, seuils
```

Tout tourne hors ligne : aucun hôte DSH requis, aucun profil réel touché.

**Après modification des sources** (Windows) :

```powershell
& .\scripts\sync.ps1
```

pnpm lie les dépendances `file:` par liens physiques : éditer les sources casse le lien et la copie installée devient obsolète — synchronisez, puis redémarrez le client.

**Arborescence :**

```
src/       implémentation (index = hôte, distill = réécriture, client = navigateur)
test/      tests hors ligne
docs/      notes de conception et de format
scripts/   script de synchronisation, test de fumée en direct
```

Plus de détails dans [CONTRIBUTING.md](CONTRIBUTING.md) et [docs/](docs/) :
[conception](docs/design.md) · [format de stockage](docs/storage-format.md) · [configuration](docs/configuration.md).

---

## 📄 Licence

[MIT](LICENSE) © Yansera
