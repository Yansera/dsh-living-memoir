/**
 * dsh-memoir — browser half（记忆册 · 页面半）
 *
 * 侧边栏底部一个入口，打开一整屏的「记忆册」：左边分类，右边条目，
 * 每条记忆一两句话，能加、能改、能删。数据全部来自后台半注册的
 * /api/dsh-memoir/* 路由，页面自己不存任何东西。
 *
 * 手写的 ModuleLoader bundle —— 不需要构建步骤。
 */
window.__ModuleLoader__.load({
  // bundle id 必须跟包名一致：client-modules 按它注册 factory，
  // 对不上（或与另一份 bundle 撞名）会在启动时报 duplicate factory registration。
  id: "@yansera/dsh-living-memoir",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    // ── 样式（全部走主题变量，跟随明暗色）────────────────────────────────
    var CSS =
      ".__mm_btn{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;cursor:pointer;text-align:left}" +
      ".__mm_btn:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}" +
      ".__mm_btnIcon{flex:none;display:flex;align-items:center;justify-content:center}" +
      ".__mm_btnLabel{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".__mm_mask{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px}" +
      ".__mm_panel{width:min(1040px,100%);height:min(760px,100%);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.32);overflow:hidden}" +
      ".__mm_head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}" +
      ".__mm_title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
      ".__mm_dir{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".__mm_grow{flex:1;min-width:0}" +
      ".__mm_iconBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font:inherit}" +
      ".__mm_iconBtn:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}" +
      ".__mm_body{flex:1;display:flex;min-height:0}" +
      ".__mm_cats{width:190px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);padding:10px;display:flex;flex-direction:column;gap:2px;overflow:auto}" +
      ".__mm_cat{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:8px 10px;border-radius:8px;cursor:pointer;text-align:left}" +
      ".__mm_cat:hover{background:var(--dsw-alias-bg-layer-3)}" +
      ".__mm_catOn{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-weight:600}" +
      ".__mm_count{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".__mm_catTag{color:var(--dsw-alias-brand-primary);font-weight:600}" +
      ".__mm_settings{flex:1;overflow:auto;padding:16px 18px 22px;display:flex;flex-direction:column;gap:16px}" +
      ".__mm_field{display:flex;flex-direction:column;gap:6px}" +
      ".__mm_label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
      ".__mm_desc{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}" +
      ".__mm_switch{display:flex;align-items:center;gap:9px;cursor:pointer}" +
      ".__mm_switch input{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}" +
      ".__mm_input,.__mm_select{font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);width:100%;box-sizing:border-box}" +
      ".__mm_input:focus,.__mm_select:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}" +
      ".__mm_iconBtnOn{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-brand-primary)}" +
      ".__mm_section{margin:6px 0 -2px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}" +
      ".__mm_page{display:flex;width:100%;height:100%;min-height:0;box-sizing:border-box;background:var(--dsw-alias-bg-layer-1);overflow:hidden}" +
      ".__mm_page .__mm_panel{width:100%;height:100%;max-width:none;border:0;border-radius:0;box-shadow:none;background:transparent}" +
      ".__mm_back{flex:none;display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}" +
      ".__mm_back:hover{border-color:var(--dsw-alias-brand-primary)}" +
      ".__mm_main{flex:1;min-width:0;display:flex;flex-direction:column}" +
      ".__mm_hint{padding:10px 18px 0;font-size:12px;color:var(--dsw-alias-label-tertiary)}" +
      ".__mm_list{flex:1;overflow:auto;padding:12px 18px 18px;display:flex;flex-direction:column;gap:10px;margin:0;list-style:none}" +
      ".__mm_item{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:11px 13px;display:flex;gap:10px;align-items:flex-start}" +
      ".__mm_item:hover{border-color:var(--dsw-alias-border-l2)}" +
      ".__mm_text{flex:1;min-width:0;font-size:13.5px;line-height:1.65;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}" +
      ".__mm_meta{margin-top:6px;display:flex;gap:10px;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".__mm_acts{flex:none;display:flex;gap:4px;opacity:0;transition:opacity .12s}" +
      ".__mm_item:hover .__mm_acts{opacity:1}" +
      ".__mm_acts .__mm_iconBtn{width:26px;height:26px;font-size:12px}" +
      ".__mm_new{border:1px dashed var(--dsw-alias-border-l2);background:transparent;border-radius:10px;padding:11px 13px;display:flex;flex-direction:column;gap:8px}" +
      ".__mm_ta{width:100%;box-sizing:border-box;min-height:56px;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;line-height:1.6}" +
      ".__mm_row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".__mm_sel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;height:30px;font:inherit;font-size:12px;padding:0 8px}" +
      ".__mm_primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff;border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}" +
      ".__mm_primary:disabled{opacity:.5;cursor:default}" +
      ".__mm_ghost{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}" +
      ".__mm_status{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:2px 0}" +
      ".__mm_error{font-size:12px;color:var(--dsw-alias-label-error)}" +
      ".__mm_empty{font-size:13px;color:var(--dsw-alias-label-tertiary);padding:22px 4px;text-align:center}";
    var tagId = "dsh-memoir/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-memoir";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── 文案 ───────────────────────────────────────────────────────────────
    var NS = "memoir";
    var zh = {
      nav: "记忆册",
      title: "记忆册",
      back: "返回对话",
      all: "全部",
      allHint: "全部分类的记忆都在这儿；点左边某一类可以只看那一类。",
      pickCategory: "先在左边选一个分类，再记新的。",
      close: "关闭",
      add: "记一条",
      save: "保存",
      cancel: "取消",
      edit: "编辑",
      remove: "删除",
      confirmRemove: "删掉这条记忆？",
      placeholder: "一句话，写成未来会话一看就懂的陈述句…",
      importance: "重要度",
      empty: "这个分类还是空的。",
      loading: "读取中…",
      newHint: "记忆文件可以直接手工编辑，页面会立刻反映。",
      settings: "设置",
      settingsHint: "改完立刻生效，不用重启。",
      enabled: "记忆写入",
      enabledHint: "关掉之后既不读取也不写入。",
      modelSection: "改写用的模型",
      provider: "服务商",
      providerHint: "留空 = 跟 Agent 的默认模型走",
      model: "模型",
      modelHint: "例如 qwen3-8b、deepseek-flash",
      effort: "思考程度",
      effortOff: "关闭",
      effortLow: "低",
      effortHigh: "高",
      effortMax: "最高",
      effortNone: "不发送",
      language: "界面语言",
      langAuto: "跟随宿主",
      saved: "已保存",
      memoryLanguage: "记忆语言",
      memoryLanguageHint: "存进 md 里的字用哪种语言写；跟界面语言是两件事。",
      memoryLangAuto: "不限制（跟随对话）",
      pickModel: "从宿主已注册的模型里选…",
      noCatalog: "宿主还没注册任何模型，下面手动填",
      pickModelHint: "下面这两个框也可以直接手填；点上面选一个会自动填进来。",
    };
    var en = {
      nav: "Memoir",
      title: "Memoir",
      back: "Back to chat",
      all: "All",
      allHint: "Every memory, all categories; pick one on the left to narrow down.",
      pickCategory: "Pick a category on the left to add a new memory.",
      close: "Close",
      add: "New entry",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      remove: "Delete",
      confirmRemove: "Delete this memory?",
      placeholder: "One sentence a future session will understand…",
      importance: "Importance",
      empty: "Nothing in this category yet.",
      loading: "Loading…",
      newHint: "Memory files are editable by hand; the page reflects them immediately.",
      settings: "Settings",
      settingsHint: "Changes apply immediately — no restart needed.",
      enabled: "Memory writes",
      enabledHint: "When off, nothing is read or written.",
      modelSection: "Model for rewriting",
      provider: "Provider",
      providerHint: "Empty = follow the agent's default model",
      model: "Model",
      modelHint: "e.g. qwen3-8b, deepseek-flash",
      effort: "Reasoning effort",
      effortOff: "Off",
      effortLow: "Low",
      effortHigh: "High",
      effortMax: "Max",
      effortNone: "Don't send",
      language: "Language",
      langAuto: "Follow host",
      saved: "Saved",
      memoryLanguage: "Memory language",
      memoryLanguageHint: "Which language the saved text uses — separate from the interface language.",
      memoryLangAuto: "Unrestricted (follow the conversation)",
      pickModel: "Pick a model your host already has…",
      noCatalog: "No models registered yet — fill in below",
      pickModelHint: "You can also type in the two fields below; picking above fills them for you.",
    };
    var fr = {
      nav: "Mémoire",
      title: "Mémoire",
      back: "Retour au chat",
      all: "Tout",
      allHint: "Tous les souvenirs, toutes catégories ; choisissez-en une à gauche pour filtrer.",
      pickCategory: "Choisissez une catégorie à gauche pour ajouter un souvenir.",
      close: "Fermer",
      add: "Nouvelle entrée",
      save: "Enregistrer",
      cancel: "Annuler",
      edit: "Modifier",
      remove: "Supprimer",
      confirmRemove: "Supprimer ce souvenir ?",
      placeholder: "Une phrase qu'une session future comprendra…",
      importance: "Importance",
      empty: "Cette catégorie est encore vide.",
      loading: "Chargement…",
      newHint: "Les fichiers sont modifiables à la main ; la page les reflète aussitôt.",
      settings: "Réglages",
      settingsHint: "Les changements prennent effet immédiatement, sans redémarrage.",
      enabled: "Écriture mémoire",
      enabledHint: "Désactivé : plus aucune lecture ni écriture.",
      modelSection: "Modèle de réécriture",
      provider: "Fournisseur",
      providerHint: "Vide = suivre le modèle par défaut de l'agent",
      model: "Modèle",
      modelHint: "ex. qwen3-8b, deepseek-flash",
      effort: "Effort de raisonnement",
      effortOff: "Désactivé",
      effortLow: "Faible",
      effortHigh: "Élevé",
      effortMax: "Maximal",
      effortNone: "Ne pas envoyer",
      language: "Langue",
      langAuto: "Suivre l'hôte",
      saved: "Enregistré",
      memoryLanguage: "Langue des souvenirs",
      memoryLanguageHint: "Langue du texte enregistré — distincte de la langue de l'interface.",
      memoryLangAuto: "Sans restriction (suivre la conversation)",
      pickModel: "Choisir un modèle déjà enregistré…",
      noCatalog: "Aucun modèle enregistré — remplissez ci-dessous",
      pickModelHint: "Vous pouvez aussi remplir les deux champs ci-dessous ; choisir ci-dessus les remplit.",
    };
    var de = {
      nav: "Memoir",
      title: "Memoir",
      back: "Zurück zum Chat",
      all: "Alle",
      allHint: "Alle Erinnerungen, alle Kategorien; links eine auswählen zum Filtern.",
      pickCategory: "Links eine Kategorie wählen, um eine Erinnerung hinzuzufügen.",
      close: "Schließen",
      add: "Neuer Eintrag",
      save: "Speichern",
      cancel: "Abbrechen",
      edit: "Bearbeiten",
      remove: "Löschen",
      confirmRemove: "Diese Erinnerung löschen?",
      placeholder: "Ein Satz, den eine künftige Sitzung versteht…",
      importance: "Wichtigkeit",
      empty: "Diese Kategorie ist noch leer.",
      loading: "Lädt…",
      newHint: "Die Dateien sind von Hand editierbar; die Seite zeigt Änderungen sofort.",
      settings: "Einstellungen",
      settingsHint: "Änderungen wirken sofort, ohne Neustart.",
      enabled: "Gedächtnis-Schreiben",
      enabledHint: "Aus: kein Lesen und kein Schreiben mehr.",
      modelSection: "Modell fürs Umschreiben",
      provider: "Anbieter",
      providerHint: "Leer = dem Standardmodell des Agenten folgen",
      model: "Modell",
      modelHint: "z. B. qwen3-8b, deepseek-flash",
      effort: "Denkaufwand",
      effortOff: "Aus",
      effortLow: "Niedrig",
      effortHigh: "Hoch",
      effortMax: "Maximal",
      effortNone: "Nicht senden",
      language: "Sprache",
      langAuto: "Dem Host folgen",
      saved: "Gespeichert",
      memoryLanguage: "Sprache der Einträge",
      memoryLanguageHint: "Sprache des gespeicherten Texts — unabhängig von der Oberflächensprache.",
      memoryLangAuto: "Uneingeschränkt (dem Gespräch folgen)",
      pickModel: "Ein bereits registriertes Modell wählen…",
      noCatalog: "Noch kein Modell registriert — unten eintragen",
      pickModelHint: "Die beiden Felder unten gehen auch von Hand; Auswahl oben füllt sie aus.",
    };
    var ja = {
      nav: "記憶帳",
      title: "記憶帳",
      back: "会話に戻る",
      all: "すべて",
      allHint: "全カテゴリの記憶です。左でカテゴリを選ぶと絞り込めます。",
      pickCategory: "左でカテゴリを選んでから記録してください。",
      close: "閉じる",
      add: "記録する",
      save: "保存",
      cancel: "キャンセル",
      edit: "編集",
      remove: "削除",
      confirmRemove: "この記憶を削除しますか？",
      placeholder: "未来のセッションが読んで分かる一文を…",
      importance: "重要度",
      empty: "このカテゴリはまだ空です。",
      loading: "読み込み中…",
      newHint: "記憶ファイルは直接編集できます。ページにすぐ反映されます。",
      settings: "設定",
      settingsHint: "設定はすぐ反映されます（再起動は不要）。",
      enabled: "記憶の書き込み",
      enabledHint: "オフにすると読み書きを一切しません。",
      modelSection: "書き換えに使うモデル",
      provider: "プロバイダ",
      providerHint: "空欄 = エージェント既定のモデルに従う",
      model: "モデル",
      modelHint: "例: qwen3-8b, deepseek-flash",
      effort: "思考の度合い",
      effortOff: "オフ",
      effortLow: "低",
      effortHigh: "高",
      effortMax: "最大",
      effortNone: "送信しない",
      language: "表示言語",
      langAuto: "ホストに従う",
      saved: "保存しました",
      memoryLanguage: "記憶の言語",
      memoryLanguageHint: "保存される本文の言語。表示言語とは別です。",
      memoryLangAuto: "制限なし（会話に合わせる）",
      pickModel: "ホストに登録済みのモデルから選ぶ…",
      noCatalog: "まだモデルがありません — 下に直接入力",
      pickModelHint: "下の 2 つは直接入力もできます。上で選ぶと自動で入ります。",
    };
    var DICTS = { zh: zh, en: en, fr: fr, de: de, ja: ja };

    var inject = ["slots", "locale", "layout"];
    var API = "/api/dsh-memoir";
    /** 侧栏第一项用的伪分类：一屏看完全部记忆。 */
    var ALL_CATEGORY = "__all";
    /**
     * 主面板 id。侧边栏图标（sidebar.panellist 的 id）与主区域插槽（main 的 key）
     * 必须用同一个值——点击图标时 layout 就是拿它去 main 里挑 entry 的。
     */
    var PANEL_ID = "memoir";

    /** 统一的 API 调用：非 2xx 把服务端的 error 抛出来。 */
    function apiFetch(path, options) {
      return fetch(path, Object.assign({ headers: { "content-type": "application/json" } }, options)).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || "HTTP " + res.status);
          return body;
        });
      });
    }

    function Icon(props) {
      var size = props.size || 15;
      return h(
        "svg",
        { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
        h("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
        h("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
      );
    }

    // ── 记忆册面板 ─────────────────────────────────────────────────────────
    function MemoirPanel(props) {
      var t = props.t;
      var onClose = props.onClose;
      /** 整页模式下的出口：回到对话。浮层模式用 onClose，整页模式靠它。 */
      var onExit = props.onExit;
      // 同一个面板有两种承载：主区域的整页（variant="page"），或盖在对话上的浮层。
      var isPage = props.variant === "page";
      var state = react.useState({ loading: true, error: null, dir: "", categories: [] });
      var data = state[0];
      var setData = state[1];
      var activeState = react.useState(ALL_CATEGORY);
      var active = activeState[0];
      var setActive = activeState[1];
      var draftState = react.useState({ text: "", importance: 3, open: false });
      var draft = draftState[0];
      var setDraft = draftState[1];
      var editState = react.useState(null); // { id, text, importance }
      var edit = editState[0];
      var setEdit = editState[1];
      var busyState = react.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];

      // ── 设置面板 ────────────────────────────────────────────────────────
      var viewState = react.useState("list"); // "list" | "settings"
      var view = viewState[0];
      var setView = viewState[1];
      var catalogState = react.useState([]);
      var catalog = catalogState[0];
      var setCatalog = catalogState[1];
      var settingsState = react.useState(null);
      var settings = settingsState[0];
      var setSettings = settingsState[1];
      var savingState = react.useState(false);
      var saving = savingState[0];
      var setSaving = savingState[1];

      /**
       * 插件里选的语言优先于宿主语言。
       * 字典就在这个 bundle 里（DICTS），所以切换是纯前端的事，不用回服务端。
       */
      var tBase = props.t;
      var t = function (key) {
        var want = (settings || {}).locale;
        if (want && DICTS[want] && DICTS[want][key] !== undefined) return DICTS[want][key];
        return tBase(key);
      };

      var loadSettings = react.useCallback(function () {
        // 宿主注册了哪些 provider / 模型——列成下拉，省得用户去背名字。
        apiFetch(API + "/models")
          .then(function (body) {
            var flat = [];
            for (var i = 0; i < (body.providers || []).length; i++) {
              var prov = body.providers[i];
              for (var j = 0; j < (prov.models || []).length; j++) {
                var model = prov.models[j];
                flat.push({
                  value: prov.id + "|" + model.id,
                  label: prov.name + " / " + model.name,
                });
              }
            }
            setCatalog(flat);
          })
          .catch(function () {
            // 宿主没提供 llm（或列不出来）时退化成纯手填，不影响别的设置。
            setCatalog([]);
          });
        apiFetch(API + "/settings")
          .then(function (body) {
            setSettings(body.settings || {});
          })
          .catch(function () {
            // 读不到设置不该让页面打不开——当没设置过。
            setSettings({});
          });
      }, []);

      var saveSettings = function (patch) {
        setSaving(true);
        apiFetch(API + "/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        })
          .then(function (body) {
            setSettings(body.settings || {});
            setSaving(false);
            load(); // 总开关可能刚被关掉，列表要跟着刷新
          })
          .catch(function () {
            setSaving(false);
          });
      };

      var load = react.useCallback(function () {
        apiFetch(API + "/state")
          .then(function (body) {
            setData({ loading: false, error: null, dir: body.dir, categories: body.categories });
          })
          .catch(function (err) {
            setData(function (prev) {
              return Object.assign({}, prev, { loading: false, error: String(err.message || err) });
            });
          });
      }, []);

      react.useEffect(function () {
        load();
      }, [load]);

      // Esc 关闭；打开时锁住 body 滚动。
      react.useEffect(function () {
        if (isPage) return undefined; // 整页用顶部的「返回对话」，Esc 只留给浮层
        var onKey = function (event) {
          if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return function () {
          document.removeEventListener("keydown", onKey);
        };
      }, [onClose]);

      /** 跑一个写操作，成功后重新拉全量——记忆库很小，全量最不容易出错。 */
      var mutate = function (promise) {
        setBusy(true);
        setData(function (prev) {
          return Object.assign({}, prev, { error: null });
        });
        return promise
          .then(function () {
            load();
            setDraft({ text: "", importance: 3, open: false });
            setEdit(null);
          })
          .catch(function (err) {
            setData(function (prev) {
              return Object.assign({}, prev, { error: String(err.message || err) });
            });
          })
          .then(function () {
            setBusy(false);
          });
      };

      var submitNew = function () {
        if (!draft.text.trim()) return;
        mutate(
          apiFetch(API + "/entry", {
            method: "POST",
            body: JSON.stringify({ category: active, text: draft.text, importance: draft.importance }),
          })
        );
      };

      var submitEdit = function () {
        if (!edit || !edit.text.trim()) return;
        mutate(
          apiFetch(API + "/entry", {
            method: "PATCH",
            body: JSON.stringify({ id: edit.id, text: edit.text, importance: edit.importance }),
          })
        );
      };

      var removeEntry = function (id) {
        if (typeof window !== "undefined" && !window.confirm(t("confirmRemove"))) return;
        mutate(apiFetch(API + "/entry?id=" + encodeURIComponent(id), { method: "DELETE" }));
      };

      var categories = data.categories || [];
      var isAll = active === ALL_CATEGORY;
      var current = isAll
        ? null
        : categories.filter(function (c) {
            return c.id === active;
          })[0];
      // 「全部」视图把所有分类摊平，每条带上自己的分类名——一眼看完记住了什么。
      var entries = isAll
        ? categories.reduce(function (acc, cat) {
            return acc.concat(
              cat.entries.map(function (entry) {
                return Object.assign({}, entry, { categoryTitle: cat.title });
              })
            );
          }, [])
        : current
          ? current.entries
          : [];

      // 第二层小节：按 section 分组（没有小节的排最前），渲染时线性摊平。
      var orderedGroups = [];
      var groupIndex = new Map();
      entries.forEach(function (entry) {
        var key = entry.section || "";
        if (!groupIndex.has(key)) {
          groupIndex.set(key, { section: key, items: [] });
          orderedGroups.push(groupIndex.get(key));
        }
        groupIndex.get(key).items.push(entry);
      });
      var flattenGroups = function (groups) {
        var flat = [];
        groups.forEach(function (group) {
          if (group.section) flat.push({ heading: group.section });
          group.items.forEach(function (entry) {
            flat.push(entry);
          });
        });
        return flat;
      };

      var catNav = h(
        "nav",
        { className: "__mm_cats" },
        h(
          "button",
          {
            key: ALL_CATEGORY,
            type: "button",
            className: "__mm_cat" + (isAll ? " __mm_catOn" : ""),
            onClick: function () {
              setActive(ALL_CATEGORY);
              setEdit(null);
            },
          },
          h("span", { className: "__mm_btnLabel" }, t("all")),
          h("span", { className: "__mm_count" }, String(entries.length))
        ),
        categories.map(function (cat) {
          return h(
            "button",
            {
              key: cat.id,
              type: "button",
              className: "__mm_cat" + (cat.id === active ? " __mm_catOn" : ""),
              onClick: function () {
                setActive(cat.id);
                setEdit(null);
              },
            },
            h("span", { className: "__mm_btnLabel" }, cat.title),
            h("span", { className: "__mm_count" }, String(cat.entries.length))
          );
        })
      );

      var newForm = isAll
        ? h("div", { className: "__mm_status", style: { padding: "2px 0 6px" } }, t("pickCategory"))
        : draft.open
        ? h(
            "div",
            { className: "__mm_new" },
            h("textarea", {
              className: "__mm_ta",
              autoFocus: true,
              placeholder: t("placeholder"),
              value: draft.text,
              onChange: function (e) {
                setDraft(function (prev) {
                  return Object.assign({}, prev, { text: e.target.value });
                });
              },
            }),
            h(
              "div",
              { className: "__mm_row" },
              h("span", { className: "__mm_status" }, t("importance")),
              h(
                "select",
                {
                  className: "__mm_sel",
                  value: String(draft.importance),
                  onChange: function (e) {
                    setDraft(function (prev) {
                      return Object.assign({}, prev, { importance: Number(e.target.value) });
                    });
                  },
                },
                [1, 2, 3, 4, 5].map(function (n) {
                  return h("option", { key: n, value: String(n) }, String(n));
                })
              ),
              h("span", { className: "__mm_grow" }),
              h(
                "button",
                {
                  type: "button",
                  className: "__mm_ghost",
                  onClick: function () {
                    setDraft({ text: "", importance: 3, open: false });
                  },
                },
                t("cancel")
              ),
              h(
                "button",
                { type: "button", className: "__mm_primary", disabled: busy || !draft.text.trim(), onClick: submitNew },
                t("save")
              )
            )
          )
        : h(
            "button",
            {
              type: "button",
              className: "__mm_ghost",
              style: { alignSelf: "flex-start" },
              onClick: function () {
                setDraft({ text: "", importance: 3, open: true });
              },
            },
            "+ " + t("add")
          );

      var list = h(
        "ul",
        { className: "__mm_list" },
        h("li", { key: "__new", style: { listStyle: "none" } }, newForm),
        entries.length === 0 && !data.loading
          ? h("li", { key: "__empty", className: "__mm_empty", style: { listStyle: "none" } }, t("empty"))
          : null,
        flattenGroups(orderedGroups).map(function (entry) {
          if (entry.heading) {
            return h("li", { key: "__sec__" + entry.heading, className: "__mm_section", style: { listStyle: "none" } }, entry.heading);
          }
          var isEditing = edit && edit.id === entry.id;
          return h(
            "li",
            { key: entry.id, className: "__mm_item" },
            h(
              "div",
              { className: "__mm_text" },
              isEditing
                ? h("textarea", {
                    className: "__mm_ta",
                    autoFocus: true,
                    value: edit.text,
                    onChange: function (e) {
                      setEdit(function (prev) {
                        return Object.assign({}, prev, { text: e.target.value });
                      });
                    },
                  })
                : entry.text,
              isEditing
                ? h(
                    "div",
                    { className: "__mm_row", style: { marginTop: 8 } },
                    h("span", { className: "__mm_status" }, t("importance")),
                    h(
                      "select",
                      {
                        className: "__mm_sel",
                        value: String(edit.importance),
                        onChange: function (e) {
                          setEdit(function (prev) {
                            return Object.assign({}, prev, { importance: Number(e.target.value) });
                          });
                        },
                      },
                      [1, 2, 3, 4, 5].map(function (n) {
                        return h("option", { key: n, value: String(n) }, String(n));
                      })
                    ),
                    h("span", { className: "__mm_grow" }),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "__mm_ghost",
                        onClick: function () {
                          setEdit(null);
                        },
                      },
                      t("cancel")
                    ),
                    h(
                      "button",
                      { type: "button", className: "__mm_primary", disabled: busy || !edit.text.trim(), onClick: submitEdit },
                      t("save")
                    )
                  )
                : h(
                    "div",
                    { className: "__mm_meta" },
                    entry.categoryTitle ? h("span", { className: "__mm_catTag" }, entry.categoryTitle) : null,
                    h("span", null, "★".repeat(Math.max(1, Math.min(5, entry.importance)))),
                    entry.updatedAt ? h("span", null, entry.updatedAt) : null,
                    entry.source ? h("span", null, entry.source) : null
                  )
            ),
            isEditing
              ? null
              : h(
                  "div",
                  { className: "__mm_acts" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "__mm_iconBtn",
                      title: t("edit"),
                      onClick: function () {
                        setEdit({ id: entry.id, text: entry.text, importance: entry.importance });
                      },
                    },
                    "✎"
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "__mm_iconBtn",
                      title: t("remove"),
                      onClick: function () {
                        removeEntry(entry.id);
                      },
                    },
                    "✕"
                  )
                )
          );
        })
      );

      var body = h(
        "div",
        { className: "__mm_body" },
        catNav,
        h(
          "main",
          { className: "__mm_main" },
          isAll
            ? h("div", { className: "__mm_hint" }, t("allHint"))
            : current
              ? h("div", { className: "__mm_hint" }, current.hint + " · " + t("newHint"))
              : null,
          data.loading ? h("div", { className: "__mm_empty" }, t("loading")) : list
        )
      );

      // 设置面板：写入总开关、改写用的模型与思考程度、界面语言。
      var settingsView = h(
        "div",
        { className: "__mm_settings" },
        h(
          "div",
          { className: "__mm_field" },
          h(
            "label",
            { className: "__mm_switch" },
            h("input", {
              type: "checkbox",
              checked: (settings || {}).enabled !== false,
              disabled: saving,
              onChange: function (e) {
                saveSettings({ enabled: e.target.checked });
              },
            }),
            h("span", { className: "__mm_label" }, t("enabled"))
          ),
          h("span", { className: "__mm_desc" }, t("enabledHint"))
        ),
        h("div", { className: "__mm_field" }, h("span", { className: "__mm_label" }, t("modelSection"))),
        h(
          "div",
          { className: "__mm_field" },
          h("span", { className: "__mm_desc" }, t("pickModelHint")),
          h(
            "select",
            {
              className: "__mm_select",
              value: "",
              disabled: saving || catalog.length === 0,
              onChange: function (e) {
                var picked = e.target.value;
                if (!picked) return;
                var parts = picked.split("|");
                saveSettings({ distillProvider: parts[0], distillModel: parts[1] });
              },
            },
            h("option", { value: "" }, catalog.length === 0 ? t("noCatalog") : t("pickModel")),
            catalog.map(function (item) {
              return h("option", { key: item.value, value: item.value }, item.label);
            })
          )
        ),
        h(
          "div",
          { className: "__mm_field" },
          h("span", { className: "__mm_desc" }, t("provider") + " — " + t("providerHint")),
          h("input", {
            className: "__mm_input",
            type: "text",
            defaultValue: (settings || {}).distillProvider || "",
            placeholder: "deepseek-official / ollama / openai-compatible…",
            onBlur: function (e) {
              saveSettings({ distillProvider: e.target.value.trim() });
            },
            onKeyDown: function (e) {
              if (e.key === "Enter") e.target.blur();
            },
          })
        ),
        h(
          "div",
          { className: "__mm_field" },
          h("span", { className: "__mm_desc" }, t("model") + " — " + t("modelHint")),
          h("input", {
            className: "__mm_input",
            type: "text",
            defaultValue: (settings || {}).distillModel || "",
            placeholder: "qwen3-8b",
            onBlur: function (e) {
              saveSettings({ distillModel: e.target.value.trim() });
            },
            onKeyDown: function (e) {
              if (e.key === "Enter") e.target.blur();
            },
          })
        ),
        h(
          "div",
          { className: "__mm_field" },
          h("span", { className: "__mm_label" }, t("effort")),
          h(
            "select",
            {
              className: "__mm_select",
              value: (settings || {}).distillReasoningEffort || "",
              disabled: saving,
              onChange: function (e) {
                saveSettings({ distillReasoningEffort: e.target.value });
              },
            },
            h("option", { value: "" }, t("langAuto")),
            h("option", { value: "off" }, t("effortOff")),
            h("option", { value: "low" }, t("effortLow")),
            h("option", { value: "high" }, t("effortHigh")),
            h("option", { value: "max" }, t("effortMax")),
            h("option", { value: "none" }, t("effortNone"))
          )
        ),
        h(
          "div",
          { className: "__mm_field" },
          h("span", { className: "__mm_label" }, t("language")),
          h(
            "select",
            {
              className: "__mm_select",
              value: (settings || {}).locale || "",
              disabled: saving,
              onChange: function (e) {
                saveSettings({ locale: e.target.value });
              },
            },
            h("option", { value: "" }, t("langAuto")),
            h("option", { value: "zh" }, "简体中文"),
            h("option", { value: "en" }, "English"),
            h("option", { value: "fr" }, "Français"),
            h("option", { value: "de" }, "Deutsch"),
            h("option", { value: "ja" }, "日本語")
          )
        ),
        h(
          "div",
          { className: "__mm_field" },
          h("span", { className: "__mm_label" }, t("memoryLanguage")),
          h(
            "select",
            {
              className: "__mm_select",
              value: (settings || {}).memoryLanguage || "",
              disabled: saving,
              onChange: function (e) {
                saveSettings({ memoryLanguage: e.target.value });
              },
            },
            h("option", { value: "" }, t("memoryLangAuto")),
            h("option", { value: "zh" }, "简体中文"),
            h("option", { value: "en" }, "English"),
            h("option", { value: "fr" }, "Français"),
            h("option", { value: "de" }, "Deutsch"),
            h("option", { value: "ja" }, "日本語")
          ),
          h("span", { className: "__mm_desc" }, t("memoryLanguageHint"))
        ),
        h("span", { className: "__mm_desc" }, t("settingsHint"))
      );

      var shell = h(
        "div",
        { className: "__mm_panel", role: "dialog", "aria-label": t("title") },
        h(
          "header",
          { className: "__mm_head" },
          isPage
            ? h("button", { type: "button", className: "__mm_back", onClick: onExit }, "← " + t("back"))
            : h(Icon, { size: 17 }),
          h("span", { className: "__mm_title" }, t("title")),
          h("span", { className: "__mm_dir", title: data.dir }, data.dir || ""),
          h("span", { className: "__mm_grow" }),
          data.error ? h("span", { className: "__mm_error" }, data.error) : null,
          h(
            "button",
            {
              type: "button",
              className: "__mm_iconBtn" + (view === "settings" ? " __mm_iconBtnOn" : ""),
              title: t("settings"),
              "aria-label": t("settings"),
              onClick: function () {
                var next = view === "settings" ? "list" : "settings";
                setView(next);
                if (next === "settings") loadSettings();
              },
            },
            "⚙"
          ),
          isPage
            ? null
            : h(
                "button",
                { type: "button", className: "__mm_iconBtn", title: t("close"), onClick: onClose },
                "✕"
              )
        ),
        view === "settings" ? settingsView : body
      );
      // 整页模式去掉遮罩：它占的是主区域，不是盖在对话上的一层。
      if (isPage) return h("div", { className: "__mm_page" }, shell);
      return h(
        "div",
        {
          className: "__mm_mask",
          onMouseDown: function (e) {
            if (e.target === e.currentTarget) onClose();
          },
        },
        shell
      );
    }

    // ── 侧边栏入口 ─────────────────────────────────────────────────────────
    function MemoirEntry(props) {
      var t = props.t;
      var openState = react.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var wide = !!props.wide;

      return h(
        react.Fragment,
        null,
        h(
          "button",
          {
            type: "button",
            className: "__mm_btn",
            title: t("nav"),
            onClick: function () {
              setOpen(true);
            },
          },
          h("span", { className: "__mm_btnIcon" }, h(Icon, { size: wide ? 16 : 18 })),
          wide ? h("span", { className: "__mm_btnLabel" }, t("nav")) : null
        ),
        open
          ? h(MemoirPanel, {
              t: t,
              onClose: function () {
                setOpen(false);
              },
            })
          : null
      );
    }

    // ── 插件 ───────────────────────────────────────────────────────────────
    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () {
        return ctx.locale.register(NS, DICTS);
      }, "dsh-memoir: dictionaries");

      // 主区域的整页：侧边栏出现一个「全局面板」图标，点击把主区域切成记忆册。
      ctx.slots.inject("main", function* () {
        yield ctx.slots.register({ name: "main", key: PANEL_ID }, function (props) {
          return h(MemoirPanel, {
            t: t,
            variant: "page",
            // 整页没有「关闭」，但必须有「回到对话」——ctx.layout.selectPanel(null)
            // 就是那个出口。少了它，用户点进来就出不去，只能强杀进程。
            onExit: function () {
              ctx.layout.selectPanel(null);
            },
            onClose: function () {},
          });
        });
      });
      ctx.slots.inject("sidebar.panellist", function* () {
        yield ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: PANEL_ID,
            order: 50,
            label: function () {
              return t("nav");
            },
          },
          function (props) {
            return h(Icon, { size: props && props.size ? props.size : 16 });
          }
        );
      });

      // 侧边栏底部的入口保留：原生面板万一在某些布局下不出现，这里还能开浮层。
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "dsh-memoir",
            order: 20,
            label: function () {
              return t("nav");
            },
          },
          function (props) {
            return h(MemoirEntry, { wide: !!(props && props.wide), t: t });
          }
        );
      });
    }

    // 自测钩子：只有 test-client.mjs 会设置这个全局变量，生产环境不走这条路。
    if (typeof window !== "undefined" && window.__DSH_MEMOIR_TEST__) {
      window.__DSH_MEMOIR_TEST__.internals = { MemoirEntry: MemoirEntry, MemoirPanel: MemoirPanel, apiFetch: apiFetch };
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
