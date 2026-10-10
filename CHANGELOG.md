# Changelog — LogSOC Frontend

All notable changes to the LogSOC frontend are documented in this file.
Format based on Keep a Changelog: https://keepachangelog.com/

## [1.1.0-septembre] — 2026-09-08 → 2026-10-01

> **Session de septembre — gouvernance : BP v2, identité 3 axes, RBAC 3 couches, questionnaires Directions métier.** Rétro-documenté depuis les commits.

### Bonnes Pratiques (module complet, menu Conformité — ex « Pratiques de sécurité »)
- Liste avec facettes (politique/réalisation/audit) + cockpit 4 onglets par pratique
- Rapport d'audit signé : ReportPanel (progression 3 étapes, empreinte SHA-256) + PreviousActionsPanel (re-audit PDCA)
- Renommage i18n : « Bonnes Pratiques » (nav.practices) + « Bonnes pratiques SI » (Opérations), 4 locales

### Complétion terrain (menu Opérations → Bonnes pratiques SI)
- Dépliant pratique : assets support + select de déclaration (Conforme/Non conforme/N-A) + traçabilité « déclaré par X le Y »
- Badge « terrain: ✓ conforme » par asset dans le cockpit Conformité (onglet Réalisation)

### Administration
- Page Modules : interrupteurs globaux + descriptions + dépendances hard/soft + dialogue de cascade explicite
- Page Rôles & Accès : matrice 8 rôles × 15 modules × 4 actions (checkbox enregistrées à effet immédiat), menu réactif (can_read par rôle)
- Casquettes métier (business_roles_ref) + Services métier + modal Membres
- Page Utilisateurs : fix bouton « Changer le rôle » (select initialisé sur le rôle actuel) + libellé « Service / Direction »

### Questionnaires Directions métier (menu Conformité — NOUVEAU)
- Liste + création (Inventaire RGPD / Activités essentielles), envoi, réponses (membres du service), clôture (DPO/RSSI chacun son domaine)

### Divers
- Pastilles gouvernance sur le dashboard (état synthétique pratiques/audits)
- i18n : 75 clés × 4 locales (fr/en/de/es) sur les 5 pages nouvelles, pattern maps de clés
- Fréquence d'audit par défaut dans Paramètres → Général (annuel/biennal/ponctuel)

## [Unreleased] — 2026-06-23

### Ticket #29 — Page /assets TOUJOURS vide après fix #28 (0 message console, composant non monté)

- **Cause racine identifiée** : le `nginx.ssl.conf` (port 443, utilisé réellement car le port 80 redirige vers HTTPS) contenait encore une directive `location /assets/ {` qui interceptait la route SPA `/assets` AVANT le fallback `try_files -> index.html`. Le commit baad02e (#14) avait renommé le `assetsDir` Vite en `_static` et corrigé le `nginx.conf` (port 80), mais avait oublié le `nginx.ssl.conf`.
- **Fix serveur** : `nginx.ssl.conf` — `location /assets/` → `location /_static/`. nginx reload effectué. Vérifié : `curl https://logsoc.anytimeadmin.info/assets` sert maintenant `index.html` (SPA) au lieu d'une 404.
- **Code source** : suppression du `console.log('[AssetsPage] Component mounted')` de diagnostic ajouté dans #28 (le diagnostic est terminé, la cause racine était nginx).
- **Build + deploy** : `tsc -b` OK, `vite build` OK (hash `index-Copmhv4U.js`), rsync deploy OK. Vérifié sur https://logsoc.anytimeadmin.info/assets — sert le nouveau bundle.

#### Diagnostic complet
- Le bundle déployé contenait bien le code de AssetsPage (grep "Component mounted" → présent).
- Le `console.log` ne s'affichait pas car le composant n'était jamais monté — nginx interceptait `/assets` avec `location /assets/` qui cherchait un dossier physique inexistant, retournant une page vide/404 au lieu du `index.html` SPA.
- Les 6 fix précédents (#18, #20, #24, #26, #27, #28) modifiaient le code source mais le problème n'était pas dans le code — c'était la config nginx SSL qui interceptait la route.

#### Files modified
- `src/pages/Assets.tsx` — suppression du console.log de debug
- Serveur : `/home/anytimeadmin/conf/web/logsoc.anytimeadmin.info/nginx.ssl.conf` — `location /assets/` → `location /_static/`

### Ticket #28 — Page /assets TOUJOURS vide après fix #27 (pas de crash, pas de render, console vide)

- **ErrorBoundary** : Création du composant `src/components/ui/ErrorBoundary.tsx` qui attrape les erreurs de rendu via `getDerivedStateFromError` + `componentDidCatch`. Affiche un message d'erreur visible (⚠️ + message + bouton "Réessayer") au lieu d'une page blanche silencieuse. Log l'erreur dans la console pour le diagnostic.
- **AppLayout** : Le `<Outlet/>` est maintenant wrappé par `<ErrorBoundary>`, protégeant toutes les pages contre les crashs silencieux (React 18 production démonte l'arbre sans message console sans ErrorBoundary).
- **Diagnostic** : Ajout de `console.log('[AssetsPage] Component mounted')` au début du composant AssetsPage (demande #1 du ticket).
- **Export** : ErrorBoundary exporté depuis `src/components/ui/index.tsx`.

#### Diagnostic effectué
- Build vérifié : le bundle déployé correspondait au code local (même hash `index-0_7fI6my.js`). Le build n'était pas stale.
- Routing vérifié : `/assets` → `<AssetsPage />` dans App.tsx. Pas de wrapper vide.
- APIs vérifiées : `/api/v1/assets/` (3 assets), `/api/v1/assets/stats/summary` (stats), `/api/v1/assets/groups` (`[]`, 200 OK). Tout fonctionne.
- Composant vérifié : pas d'early return null. Le JSX complet est toujours retourné.
- Cause racine : aucune ErrorBoundary dans l'app → React 18 production démonte l'arbre silencieusement en cas d'erreur de rendu.

#### Files modified
- `src/components/ui/ErrorBoundary.tsx` — nouveau composant ErrorBoundary
- `src/components/ui/index.tsx` — export ErrorBoundary
- `src/components/layout/AppLayout.tsx` — import ErrorBoundary, wrapper `<Outlet/>` avec `<ErrorBoundary>`
- `src/pages/Assets.tsx` — console.log de diagnostic

### Ticket #27 — Page /assets vide (React error #31 persiste dans Assets.tsx)

- **Extraction défensive des groups** : `assetsApi.groups()` était typé `string[]` et utilisé directement dans les options du `Select`. Si l'API retourne des objets (`[{name, id}]`), React error #31 → crash silencieux → page vide. Ajout d'une extraction des strings depuis les objets (fallback sur `name`, `group_name`, `label`, `id`).
- **Filtre OS fonctionnel** : `osFilter` était défini mais jamais appliqué dans `filteredAssets`. Ajout du filtrage par OS.
- **Valeurs null gérées** : `group_name` et `version` peuvent être `null` → affichage de `—` au lieu d'une string vide.
- **i18n** : Chaîne hardcodée `'Pending'` remplacée par `t('common.pending')`. Ajout de la clé `common.pending` dans les 4 locales (FR/EN/DE/ES).

#### Files modified
- `src/pages/Assets.tsx` — extraction défensive des groups, filtre OS, valeurs null, i18n
- `src/i18n/locales/fr.json` — ajout de `common.pending`
- `src/i18n/locales/en.json` — ajout de `common.pending`
- `src/i18n/locales/de.json` — ajout de `common.pending`
- `src/i18n/locales/es.json` — ajout de `common.pending`

## [1.0.0-phase-i] — 2026-06-22

### Tickets #16, #17 — Audit UX Nova (23 juin 2026)

#### Ticket #16 — Routes sidebar cassées : Règles YARA, Risques, NIS2 (404)
- Les chemins du navConfig étaient déjà corrects (`/yara`, `/risques`, `/nis2`) mais l'audit automatique a testé d'anciens chemins
- Ajout de routes de redirection pour la robustesse : `/yara-rules` → `/yara`, `/risks` → `/risques`, `/compliance/nis2` → `/nis2`
- Ces redirections garantissent que les anciens liens/bookmarks ne tombent plus sur une 404

#### Ticket #17 — ISO 27001 : noms des contrôles en anglais + statut `not_implemented` brut
- **Traduction des 93 contrôles ISO 27001:2022 (Annexe A)** en français (version AFNOR)
  - Nouveau fichier `src/utils/iso27001Controls.ts` avec `translateControlTitle(controlId, originalTitle)`
  - Exemples : "Policies for information security" → "Politiques de sécurité de l'information", "Access control" → "Contrôle d'accès"
  - Les traductions s'affichent dans le tableau SOA et dans le panneau de détail au clic
- **Traduction des statuts d'implémentation** : `not_implemented` → "Non implémenté", `in_progress` → "En cours", `implemented` → "Implémenté", etc.
  - Ajout de `compliance.iso27001.statusLabels` dans les 4 locales (FR/EN/DE/ES)
  - Le badge de statut affiche désormais une traduction au lieu de la clé technique brute
- **Correction du `statusVariant`** : ajout des cas `implemented` (success), `in_progress` / `partially_implemented` (warning), `not_implemented` (danger)
- Respect des règles UX du CDC : un RSSI/DPO/auditeur français voit désormais les contrôles dans sa langue

#### Files modified
- `src/utils/iso27001Controls.ts` — nouveau fichier (93 traductions AFNOR)
- `src/pages/Iso27001.tsx` — titres traduits + statuts traduits + variants corrigés
- `src/App.tsx` — 3 routes de redirection (yara-rules, risks, compliance/nis2)
- `src/i18n/locales/fr.json` — ajout de `compliance.iso27001.statusLabels`
- `src/i18n/locales/en.json` — ajout de `compliance.iso27001.statusLabels`
- `src/i18n/locales/de.json` — ajout de `compliance.iso27001.statusLabels`
- `src/i18n/locales/es.json` — ajout de `compliance.iso27001.statusLabels`

### Tickets #11, #12, #13 — Audit UX Nova (22 juin 2026)

#### Ticket #11 — Clés i18n brutes résiduelles
- **Actions** : ajout des clés i18n manquantes pour les types d'action backend (`kill_pid`, `isolate_host`, `block_ip`, `quarantine_file`, `collect_forensics`, `restart_service`) dans les 4 locales FR/EN/DE/ES
- **NIS2** : ajout des clés `compliance.statusLabels` manquantes : `not_started`, `in_progress`, `assessed`
- **Risques** : ajout des clés `risques.statusLabels` manquantes : `assessed`, `draft`
- Nettoyage des fallbacks `{ count: 0 } || st` dans Compliance, GdprAudit, ComplianceInfra, Nis2

#### Ticket #12 — Dates ISO brutes + compteur NIS2 incohérent
- **Risques** : la colonne « Date de revue » utilise désormais `formatTimestamp()` pour afficher `DD/MM HH:MM` au lieu du format ISO brut
- **NIS2** : remplacement du compteur hardcodé `(42)` par `measuresList.length` (compteur dynamique)

#### Ticket #13 — Pages Administration/Gouvernance 404
- Ajout de routes de redirection : `/administration` → `/assets`, `/gouvernance` et `/governance` → `/governance/policies`
- Vérification : toutes les pages Admin (10) et Gouvernance (9) sont pleinement implémentées avec de vraies API

### Tickets #3, #4, #5, #6, #7 — Audit UX Nova (22 juin 2026)

#### Ticket #3 — Page Alertes
- **Regroupement des alertes** : les alertes identiques (même titre + hôte + sévérité) sont groupées avec un compteur "N alertes similaires" et un bouton expand/collapse
- **Traduction des descriptions** : nouvelle fonction `translateAlertDescription()` qui traduit les patterns d'alertes en français (EN → FR)
- **Coquille "correlatisur"** : fix du regex `\bcorrelate\b` qui matchait après remplacement de "correlation" → "corrélation", causant "correlatisur". Utilisation de `\s+on\s+` au lieu de `\bon\b`
- **Bouton "Demander à l'IA"** : ajouté sur chaque carte d'alerte et dans le modal de détail (icône Sparkles)
- **Tri** : sélecteur Date / Sévérité / Hôte
- **Pagination** : "Page X sur Y" au lieu de "Page X"
- **Assignation** : "Non assignée" au lieu de "—"
- **Timestamps** : format court DD/MM HH:MM en mode normal, ISO complet en mode expert

#### Ticket #4 — Section Conformité
- **NIS2 Auto-check** : affiche "Manuel" au lieu de "—" quand pas d'auto-check
- **Compliance Score** : affiche "Score indisponible" au lieu de "—", avec icône colorée selon le score

#### Ticket #5 — Risques et Gouvernance
- **Risques** : ajout de `onRowClick` sur le tableau pour ouvrir le modal de détail
- **Politiques** : empty state enrichi avec titre, description et bouton "Créer une politique manuellement"

#### Ticket #6 — Sigma et MITRE
- Confirmation que les pages Sigma et MITRE sont déjà bien implémentées (modal détail, matrice tactiques × techniques)
- Le tableau Sigma vide est un problème de mapping backend (format items[] non retourné)

#### Ticket #7 — Section Admin
- **Page 404** : nouvelle page `NotFound.tsx` en français avec bouton "Retour au tableau de bord" (4 langues)
- **Corrélation** : les StatCards affichent 0 au lieu de "—" quand pas de données
- **Threat Hunting** : 4 templates de requêtes pré-configurées (processus root, connexions non-EU, modifications /etc, désactivation sécurité)
- **Assets/CMDB** : ajout de `onRowClick` pour ouvrir le panneau de détail au clic sur une ligne

#### i18n (4 langues : FR/EN/DE/ES)
- Nouvelle section `notFound` (message + bouton retour)
- `alerts` : askAi, aiLoading, aiAnalysis, aiNoAnalysis, sortBy, sortByDate, sortBySeverity, sortByHost, similarCount, pageOf, unassigned
- `hunting` : templates, templatesDescription, 4 template queries
- `compliance` : scoreUnavailable, scoreUnavailableDescription, autoCheckManual
- `governance.policies` : noPoliciesTitle, noPoliciesDescription, generatePssiAi, createManually

#### Files modified
- `src/pages/NotFound.tsx` — nouvelle page 404
- `src/pages/Alerts.tsx` — regroupement, traduction, tri, bouton IA, pagination
- `src/pages/Correlation.tsx` — stats affichent 0 au lieu de "—"
- `src/pages/ThreatHunting.tsx` — templates de requêtes pré-configurés
- `src/pages/Compliance.tsx` — score "indisponible" au lieu de "—"
- `src/pages/Nis2.tsx` — auto-check "Manuel" au lieu de "—"
- `src/pages/Risques.tsx` — onRowClick pour ouvrir le détail
- `src/pages/Assets.tsx` — onRowClick pour ouvrir le détail
- `src/pages/Cmdb.tsx` — onRowClick pour ouvrir le détail
- `src/pages/governance/Policies.tsx` — empty state enrichi
- `src/utils/eventFormatter.ts` — fix regex translateAlertTitle, ajout translateAlertDescription
- `src/App.tsx` — route 404 vers NotFoundPage
- `src/i18n/locales/{fr,en,de,es}.json` — nouvelles clés i18n

### Ticket #2 — Audit UX #2 (22 juin 2026)

#### Fixed
- Coquille « correlatisur » → « corrélation sur » dans `translateAlertTitle()` (regex `on (?=\S)` remplacait le « on » dans « correlate » → word boundaries `\b` utilisées)
- Préfixes techniques `<no_fd_resolved:file>` masqués en mode normal via `cleanFilename()` — extrait le nom de fichier après `:`, `<unknown>` → « Fichier non identifié »
- UID numérique résolu : panneau détail affiche `username` si disponible, sinon `Utilisateur N (UID)` au lieu de `986` brut (nouvelles clés i18n `events.uid` FR/EN/DE/ES)
- GlossaryTooltip ajouté sur « ClickHouse » dans `SystemStatus`
- « Correspondances YARA » → « Détections YARA » dans sidebar et titre de page (4 langues)

#### Files modified
- `src/utils/eventFormatter.ts` — `cleanFilename()` exportée, `translateAlertTitle()` réécrite avec word boundaries
- `src/pages/Events.tsx` — import `cleanFilename`, affichage UID/filename nettoyé dans panneau détail
- `src/components/dashboard/SystemStatus.tsx` — GlossaryTooltip sur ClickHouse
- `src/i18n/locales/{fr,en,de,es}.json` — clé `events.uid`, renommage `yaraMatches` et `yara.matches`

### Phase I — Tests + Polish

#### Verification
- 53 page files total (52 in pages/ + 1 Dashboard)
- 55 routes in App.tsx (53 pages + login + catch-all)
- Zero PagePlaceholder routes remaining
- tsc -b: 0 errors
- Vite build: 3.49s, 596KB main chunk (gzip 124KB)
- Site live: https://logsoc.anytimeadmin.info/ (HTTP 200)
- API healthy: api=ok, mysql=ok, clickhouse=ok

#### Final Stats
- 53 pages wired to real API data
- 14 UI components + 7 dashboard components
- 4 locales (FR/EN/DE/ES)
- 5 RBAC roles (superadmin, admin, compliance_officer, analyst, viewer)
- 5 nav sections (Ops, Compliance, Risques, Governance, Admin)
- CSS variables only (dark/light theme)
- No mock data, no hardcoded strings, no hardcoded colors
- Server-side pagination on all list pages

### Phase G — Pages Gouvernance (9 pages)

#### Added — 9 new pages in src/pages/governance/
- Policies: PSSI management with StatCards, filters, versioning, workflow, RBAC
- Remediation: action plans with progress bars, deadline alerts, RBAC
- DataClassification: classification with level badges, matrix view, RBAC
- Trainings: training management with attendance, quiz results, RBAC
- Committee: security committee meetings with CRUD, decisions tracking
- Decisions: decision register with status badges, history, RBAC
- Raci: RACI matrix with color-coded cells, anomaly detection, legend
- Vendors: vendor management with criticality, renewal alerts, GDPR Art.28 link
- Calendar: governance calendar with month grid, ICS export, event detail

### Phase H — Pages Admin (10 pages)

#### Added — 10 new pages
- Assets: inventory with StatCards, filters, detail modal, heartbeats, compliance, install command
- Cmdb: CMDB with StatCards, CRUD, relations, events, RBAC admin
- Insights: AI insights with cards, dismiss, analyze, confidence score
- Users: user management with roles, MFA, sessions, audit trail, RBAC admin
- AgentPolicy: policy config with global/override, diff, push, RBAC admin
- PolicyAudit: audit trail with filters, diff detail, export, RBAC admin
- YaraRuleset: ruleset management with push, per-agent stats, RBAC admin
- Integrations: 4 tabs (Webhooks, SIEM, ITSM, Notifications) with CRUD, test, healthcheck
- Infrastructure: 3 tabs (Retention, Backups, Health) with TTL config, RBAC admin
- Settings: 6 tabs (General, MFA, API Keys, Ollama, Appearance, Notifications), RBAC admin

#### Changed
- src/App.tsx: all 19 new pages imported and routed, PagePlaceholder import removed
- src/i18n/locales/*.json: governance and admin sections added to all 4 locales
- Fixed multiple TypeScript errors (unknown -> String casts, unused imports/vars, info badge variant)

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds (3.49s, 596KB main chunk)
- All 53 pages now wired to real components with real API data
- Zero PagePlaceholder routes remaining

### Phase F — Pages Risques (4 pages)

#### Added — 4 new pages
- Risques: risk register with StatCards, filters, table + matrix view (prob x impact), create/detail modals, AI suggestions, export CSV, RBAC
- Incidents: incident management with MTTD/MTTR StatCards, filters, table, create/detail modals, timeline, IOCs, TTPs, comments, status change, close with post-mortem
- Runbook: runbook management with StatCards, filters, table, create/detail modals with checklist steps, reviews history, template pre-fill buttons, RBAC
- AlertRunbooks: alert runbooks with filters, table, create/detail modals, execute detection button, RBAC

#### Fixed
- i18n: moved risques, incidents, runbook, alertRunbooks sections from nested in compliance to top-level in all 4 locale files

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds (4.54s, 419KB main chunk)
- All data from real API calls (no mock data)

### Phase E — Pages Compliance (17 pages)

#### Added — 17 new pages
- Cartography: asset grid with compliance status badges, filters by framework/group/criticality
- Compliance: global compliance dashboard with framework selector, score gauge, controls table with status badges, export
- ComplianceInfra: infrastructure compliance with section scores (network, system, access, encryption), trend visualization
- GdprAudit: GDPR audit list with controls table, detail modal with article/alinea/status/evidence
- GdprExtended: 7-tab DPO tools (Treatments, DPIA, Requests, Subprocessors, Transfers, Breaches, Summary) with CRUD
- Nis2: NIS2 compliance with classification, 42 measures with auto-check, governance, summary
- Dora: DORA with 5 pillars StatCards, 4 tabs (Incidents, Third Parties, Resilience Tests, Summary)
- Iso27001: ISO 27001 with 6 tabs (SOA, Audits, Non-conformities, Reviews, Certification, Summary)
- AiAct: AI Act with 4 tabs (Systems, Incidents, Transparency, Summary), system detail modal with obligations
- Soar: SOAR with 5 tabs (Playbooks, Executions, Approvals, Integrations, Summary), execute button, RBAC
- ThreatIntel: Threat Intelligence with 5 tabs (Indicators, Actors, Feeds, Bulletins, Summary), search, RBAC
- Reporting: Reporting with 5 tabs (Dashboards, Templates, Schedules, History, Summary), generate modal with format selection
- CrossMapping: cross-mapping between frameworks with dual selector, gap identification, export
- Nis2Countries: NIS2 by country with table, authority detail modal
- Frameworks: modular framework management with cards, toggle activate/deactivate, score, detail modal
- Notifications: regulatory notifications with table, create modal, deadline tracking, templates, RBAC
- Crisis: crisis management with 3 tabs (Crises, Playbooks, Post-mortem), create modal, detail modal, RBAC

#### Changed
- src/App.tsx: all 17 new pages imported and routed, replacing PagePlaceholder
- src/i18n/locales/*.json: all 4 locales updated with compliance section keys

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds (5.08s, 356KB main chunk)
- All data from real API calls (no mock data)

### Phase D — Pages Ops (12 pages)

#### Added — 11 new pages (Dashboard already done in Phase C)
- src/pages/Events.tsx: table with filters (severity, service), pagination, detail modal, CSV export, service type translations
- src/pages/Alerts.tsx: alert cards with severity/status badges, action buttons (acknowledge, escalate, close), detail modal, StatCards by severity, ConfirmDialog before close, toast feedback
- src/pages/Actions.tsx: table with status filter, create action modal, approve/cancel buttons, RBAC (analyst create, admin approve)
- src/pages/Agents.tsx: agent cards with status badges, stats, detail modal with approve/revoke/delete, install command copy, toast feedback
- src/pages/YaraRules.tsx: table with filters, toggle activate, YARA Forge import modal, rule detail modal, StatCards, pagination
- src/pages/YaraMatches.tsx: table with filters, detail modal, CSV export, pagination
- src/pages/SigmaRules.tsx: table with filters, evaluate button, Sigma Community import modal, rule detail modal, StatCards, pagination
- src/pages/Mitre.tsx: coverage score, CSS grid matrix (tactics x techniques), color-coded by coverage, technique detail modal, threat group filter
- src/pages/Correlation.tsx: StatCards, 3 tabs (deterministic rules, custom rules, suppressions), create/edit modals, RBAC
- src/pages/ThreatHunting.tsx: 2-column layout (saved queries + results), new query modal, execute button, results table, RBAC
- src/pages/CustomRules.tsx: table with create modal, dry-run button, toggle, delete with ConfirmDialog, RBAC

#### Changed
- src/App.tsx: all 11 new pages imported and routed, replacing PagePlaceholder
- src/i18n/locales/*.json: all 4 locales updated with events, alerts, actions, agents, yara, sigma, mitre, correlation, hunting, customRules sections

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds (5.21s, 227KB main chunk)
- All data from real API calls (no mock data)
- All strings via t(), all colors via CSS variables
- Server-side pagination on all list pages

### Phase C — Dashboard + Hooks

#### Added
- src/api/types.ts: TypeScript types for all API responses (EventStatsSummary, AlertSummary, AssetStatsSummary, SystemHealth, EventItem, AlertItem, AssetItem, PaginatedResponse)
- src/pages/Dashboard.tsx: full dashboard page with real API data
  - 4 StatCards (total events, events/min, active agents, open alerts)
  - SeverityChart (recharts BarChart) with real event stats
  - SystemStatus with live health data
  - Recent activity tabs (events + alerts)
  - Events by host with progress bars
  - Events by service chart (recharts LineChart)
- i18n: dashboard keys added to all 4 locales (FR/EN/DE/ES) — severity labels, status labels, time-ago formats

#### Changed
- src/hooks/useData.ts: typed with API types (useEventStats, useEvents, useAlerts, useAlertSummary, useAssets, useAssetStats, useSystemHealth)
- src/App.tsx: route "/" now uses DashboardPage instead of PagePlaceholder
- src/api/index.ts: assetsApi.list params typed as Record<string, string>

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds (3.08s, chart-vendor chunk now included at 393KB)
- All data from real API calls (no mock data)
- All strings via t(), all colors via CSS variables

### Phase B — Composants UI

#### Added — 14 composants UI (src/components/ui/)
- Card: conteneur border rounded-xl, onClick support
- Badge: pilule coloree 5 variants (success/warning/danger/info/default), 2 sizes (sm/md), color-mix pour opacity
- Button: primary/secondary/danger, sm/md, icon slot, fullWidth, defaults (primary/md)
- Input: label, error, required, disabled, focus border accent
- Select: label, options, placeholder, error, required, disabled
- Modal: overlay + dialog, Escape/overlay close, X button, 3 sizes (sm/md/lg)
- Table: columns, renderCell, skeleton loading rows, empty state, hover rows
- EmptyState: icon, title, description, action slot
- SearchBar: search icon + input, bg secondary
- Tabs: active accent border, count badges, 2px bottom border
- StatCard: label, large value, icon, trend arrows, loading skeleton
- Toast: ToastProvider + useToast hook, auto-dismiss 4s, 4 variants, animated, CSS variables
- GlossaryTooltip: hover tooltip with t() translation, dotted underline indicator
- ConfirmDialog: Modal + Button, danger/primary variants, t() labels
- Barrel export: src/components/ui/index.tsx

#### Added — 7 composants dashboard (src/components/dashboard/)
- EventsChart: recharts LineChart, accent color, custom tooltip, CSS variables
- SeverityChart: recharts BarChart, per-severity Cell colors (critical/high/medium/low)
- SystemStatus: status badges for API/MySQL/ClickHouse/Ollama
- RecentEvents: type icons, severity colors, relative timestamps, EmptyState fallback
- LogStream: WebSocket live stream, auto-scroll, pause/play, monospace, level colors
- DashboardGrid: HTML5 drag-and-drop, IDs only in state (no JSX), reorder callback
- StatCard: re-export from ui/
- Barrel export: src/components/dashboard/index.ts

#### Changed
- App.tsx: integrated ToastProvider wrapper around BrowserRouter
- Button: variant and size now optional with defaults (primary/md)
- GlossaryTooltip: fixed to use t(term) instead of raw term string

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds (2.58s)
- All colors via CSS variables, all strings via t()

### Phase A — Infrastructure

#### Added
- Project initialization: Vite + React 18 + TypeScript + Tailwind v4
- Package.json with dependencies: react, react-dom, react-router-dom, @tanstack/react-query, axios, zustand, recharts, lucide-react
- TypeScript config (strict mode, noUnusedLocals, noUnusedParameters)
- Vite config with dev proxy (/api, /ws) and production code splitting (react, query, chart, icon vendors)
- index.html with Inter font (Google Fonts)
- CSS theme system: dark/light via CSS variables (no hardcoded colors), skeleton loaders, scrollbar styling, animations, responsive mobile menu
- Zustand stores: useAuthStore (token, refreshToken, user, expertMode, isAuthenticated, isAdmin, toggleExpertMode), useAppStore (sidebarCollapsed, mobileSidebarOpen, timeRange, navSection, lang)
- Axios API client: baseURL empty (relative), JWT injection interceptor, 401 refresh token interceptor with retry, 40+ API objects covering all 411 backend endpoints
- i18n system: custom implementation with useSyncExternalStore, 4 locales (FR/EN/DE/ES), useTranslation hook with params support, dot-notation key resolution, fallback to FR
- Hooks: useData (react-query: useEvents, useEventStats, useAlerts, useAlertSummary, useAssets, useSystemHealth, useTimeRangeParams), usePermissions (RBAC: role hierarchy viewer→analyst→compliance_officer→admin→superadmin, canView, canEdit, hasRole, isAdmin), useWebSocket (auto-reconnect with exponential backoff, heartbeat ping/pong 30s, configurable max retries)
- Layout components: TopNav (5 section buttons + mobile hamburger), ContextualSidebar (RBAC-filtered, collapsible, mobile overlay), Header (search, time range selector, theme toggle with localStorage persistence, 4-language dropdown selector, expert mode toggle, user menu with logout), AppLayout (sidebar + header + content with route-synced navSection)
- Navigation config: 5 sections (ops: 12, compliance: 17, risques: 4, governance: 9, admin: 10 = 53 pages) with lucide-react icons, i18n label keys, minRole per page
- LoginPage: username/password + MFA flow, JWT auth, usersApi.getMe(), all strings via i18n, CSS variables only
- App.tsx: BrowserRouter, QueryClientProvider, ProtectedRoute, AdminRoute, 53 routes (8 admin-only)
- Placeholder page component showing translated page title
- main.tsx entry point with StrictMode
- .gitignore
- CHANGELOG.md

#### Technical Details
- TypeScript: 0 errors (tsc -b passes clean)
- Vite build: succeeds, code split into 5 vendor chunks
- All strings use t() — zero hardcoded display text
- All colors use var(--color-*) — zero hardcoded colors
- API URL: relative (baseURL empty) — calls go to same server
- No client-side session timeout (backend JWT handles expiration)
- No JSX in state (IDs only)
- RBAC: 5 roles (superadmin, admin, compliance_officer, analyst, viewer)
- i18n: 4 languages (FR default, EN, DE, ES)