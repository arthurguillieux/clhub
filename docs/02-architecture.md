# LE CLHUB — Architecture

## 1. Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15** (App Router) + React 19 | Server Actions et RSC réduisent énormément le code de plomberie pour une app à formulaires |
| Langage | **TypeScript** strict | `strict: true`, `noUncheckedIndexedAccess: true` |
| Styles | **Tailwind CSS v4** + **shadcn/ui** | Base accessible, entièrement restylable, pas de dette de librairie UI |
| Base | **PostgreSQL 16** | Les types `daterange` et les contraintes d'exclusion résolvent notre problème central |
| ORM | **Drizzle** | Léger, SQL explicite, migrations lisibles. Pas de binaire moteur à embarquer dans une image Alpine |
| Auth | **Better Auth** + plugin magic link | Adaptateur Drizzle de première classe, auto-hébergeable, sans dépendance à un service |
| Mails | **Resend** + **React Email** | Le port 25 sortant est bloqué par tous les FAI ; il faut une API HTTPS. Templates en React |
| Images | `sharp` au moment de l'envoi | La CPU du NAS est faible : on génère les vignettes une fois, jamais à la volée |
| Tests | **Vitest** (domaine) + **Playwright** (parcours) | Le domaine pur se teste sans base ni navigateur |
| Conteneurs | **Docker** + Compose | Container Manager de DSM sait lire un `docker-compose.yml` |
| CI/CD | **GitHub Actions** → **GHCR** | Le NAS n'a pas la RAM pour compiler ; il ne fait que récupérer l'image |

## 2. Structure du dépôt

Une seule application Next.js, découpée par domaine. Pas de monorepo : il n'y a qu'un
artefact déployable, un `turborepo` serait de la cérémonie pure.

```
clhub/
├── docs/
├── drizzle/                     migrations SQL générées
├── src/
│   ├── core/                    ── LE SOCLE ──────────────────
│   │   ├── auth/                Better Auth, magic link, invitations, parrainage
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   └── schema/          un fichier par domaine, réexportés
│   │   ├── mail/                client Resend + templates React Email
│   │   ├── notifications/       création, envoi, préférences, jetons d'action
│   │   ├── activity/            le flux commun
│   │   ├── achievements/        moteur générique + catalogue d'écussons
│   │   ├── storage/             abstraction fichiers (disque local aujourd'hui)
│   │   ├── date/                CalendarDate — voir §5
│   │   └── ui/                  design system, layout, calendrier
│   ├── modules/
│   │   └── pretotheque/
│   │       ├── domain/          LOGIQUE PURE — aucun import DB ni React
│   │       ├── data/            requêtes et mutations Drizzle
│   │       ├── actions/         Server Actions (validation Zod → domain → data)
│   │       ├── ui/              composants de la section
│   │       └── mail/            templates spécifiques (demande, rappel, retard)
│   ├── app/
│   │   ├── (public)/            connexion, invitation, validation par jeton
│   │   ├── (club)/              routes authentifiées : accueil, profils, réglages
│   │   │   └── pretotheque/     catalogue, fiche objet, calendriers, chantiers
│   │   └── api/                 santé, iCal, webhooks, upload
│   └── worker/                  entrée du conteneur de tâches planifiées
├── tests/
├── docker/
│   ├── Dockerfile
│   └── compose.yaml
└── .github/workflows/
```

### La règle de dépendance

```
app/ ──→ actions/ ──→ domain/ (pur)
                └──→ data/ ──→ core/db
```

`modules/*/domain/` **n'importe rien** : ni Drizzle, ni React, ni Next. Ce sont des
fonctions pures sur des types simples. C'est là que vit toute la logique de disponibilité,
et c'est ce qui la rend testable exhaustivement. Une règle de lint interdit les imports
sortants depuis `domain/`.

## 3. Modèle de données

### 3.1 Socle

```
user                 -- géré par Better Auth, forme standard, on n'y touche pas
  id text pk, name, email unique, email_verified, image, created_at, updated_at
session / account / verification        -- idem, tables Better Auth standard

member               -- le profil club, distinct de l'identité (voir ADR-011)
  id                uuid pk
  user_id           text unique → user.id
  member_number     int unique          -- identity Postgres, attribué à la 1re connexion
  avatar_path       text null           -- upload propre au club, distinct de user.image
  bio               text null
  phone             text null           -- pour se donner rendez-vous
  role              text                -- 'member' | 'admin'
  invited_by_id     uuid null → member  -- parrainage → l'arbre du club
  joined_at         timestamptz
  notif_prefs       jsonb               -- { digest: 'instant'|'daily'|'off', ... }
  created_at, updated_at

invitation           id, email, token_hash, invited_by_id → member, expires_at, accepted_at

action_token         -- validation en un clic depuis un mail, sans connexion
  id, token_hash unique, member_id, action text, payload jsonb,
  expires_at, used_at, created_at

notification         id, member_id, kind, payload jsonb, entity_ref, read_at, email_sent_at
activity             id, section text, kind text, actor_id, subject_ref, payload jsonb, created_at

achievement          key pk, section, name, description, hint, icon, tier, sort
member_achievement   member_id, achievement_key, unlocked_at, progress jsonb   pk(member_id, key)
```

### 3.2 Prêtothèque

```
item
  id, slug unique
  owner_id → member
  name, description
  category            text     -- 'bricolage'|'jardinage'|'menage'|'festif'|'autre'
  tags                text[]
  brand, model
  product_url, price_cents, purchase_year
  replacement_value_cents null
  condition           text     -- 'neuf'|'bon'|'usage'|'fragile'
  accessories, consumables, safety_notes   text
  pickup_location, pickup_notes            text
  auto_approve        boolean default false
  max_loan_days       int null
  buffer_days         int default 0
  status              text     -- 'available'|'unavailable'|'broken'|'retired'
  created_at, updated_at, archived_at

item_photo           id, item_id, path, width, height, sort, is_primary
item_unit            id, item_id → item, label null, archived_at null   -- ADR-004
item_owner           item_id, member_id            -- copropriété (achat groupé)
kit / kit_item                                     -- lots : « kit soirée »

project              -- un « chantier »
  id, owner_id, name, description, start_date, end_date, created_at

booking
  id
  item_id       → item
  unit_id       → item_unit     -- ADR-004 : l'exemplaire réellement emprunté
  borrower_id   → member
  project_id    → project null
  start_date    date          -- inclusif
  end_date      date          -- inclusif
  start_slot    text null     -- 'matin'|'aprem'|'soir'
  end_slot      text null
  status        text  -- 'pending'|'approved'|'rejected'|'cancelled'|'active'|'returned'
  message       text          -- « pour refaire ma terrasse »
  owner_note    text null
  responded_at, responded_by
  picked_up_at, returned_at
  return_condition text null
  created_at, updated_at

booking_event        id, booking_id, kind, actor_id, payload jsonb, created_at
item_comment         id, item_id, author_id, body, created_at
maintenance_log      id, item_id, author_id, kind, note, cost_cents, photo_path, happened_on
item_request         id, requester_id, label, description, needed_by, status, fulfilled_by_item_id
item_request_interest request_id, member_id, created_at    -- achat groupé
waitlist             id, item_id, member_id, from_date, to_date, notified_at
```

### 3.3 Le garde-fou anti-double-réservation

La validation applicative ne suffit pas : deux requêtes concurrentes peuvent passer le
contrôle avant que l'une n'ait écrit. On l'interdit **au niveau de la base** :

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status IN ('approved', 'active'));
```

Deux propriétés importantes de cette contrainte :

- Elle ne s'applique **qu'aux réservations confirmées ou en cours**. Les demandes en
  attente peuvent se chevaucher librement — c'est un choix produit délibéré (§5.2 du
  document produit), et il tombe naturellement du `WHERE`.
- Un double clic simultané ne peut pas produire deux prêts confirmés. La deuxième
  transaction échoue avec une violation de contrainte, qu'on traduit en message clair.
- Elle porte sur `unit_id`, pas `item_id` (ADR-004) : deux exemplaires du même objet se
  prêtent indépendamment, chacun avec sa propre garantie anti-chevauchement.

## 4. Le calendrier — construit à la main, et pourquoi

**Décision : aucune bibliothèque de calendrier.** FullCalendar, react-big-calendar et
leurs équivalents sont lourds, imposent leur DOM et leur CSS, et se battent contre toute
direction artistique précise. Or le calendrier est *le* produit ici.

Une grille mensuelle avec plages multi-jours, c'est de la CSS Grid plus un algorithme de
placement en couloirs — le même que celui de Google Agenda. Environ 300 lignes, entièrement
sous contrôle, et testable.

```ts
// core/ui/calendar/layout.ts — fonctions pures, testées unitairement
buildMonthGrid(month, { weekStartsOn: 1 }): Week[]   // 6 semaines, lundi en premier
sliceByWeek(range, weeks): Segment[]                 // découpe une plage par semaine
packLanes(segments): PlacedSegment[]                 // empilement glouton first-fit
```

L'algorithme :

1. Construire une grille de 6 × 7 jours couvrant le mois (débords inclus).
2. Pour chaque réservation, la découper en segments hebdomadaires.
3. Par semaine, trier les segments (date de début, puis durée décroissante) et les
   affecter au premier couloir libre.
4. Rendre chaque segment en `grid-column: <col> / span <n>` et `grid-row: <lane>`.

Le détail qui fait tout : **les coins ne sont arrondis qu'aux vraies extrémités de la
réservation**, plats sur les bords de continuation. C'est précisément ce qui donne à une
plage sur trois semaines l'apparence d'un ruban continu plutôt que de trois blocs séparés.

La **vue planning** (lignes = objets, colonnes = jours) réutilise `sliceByWeek` sans le
découpage, et est en réalité plus simple que la vue mensuelle.

## 5. Dates : `CalendarDate`

Toutes les réservations sont en **dates pures**, jamais en horodatages. On n'utilise ni
`Date` de JavaScript, ni `date-fns` pour la logique métier : les deux manipulent des
instants et réintroduisent les fuseaux horaires, donc les décalages d'un jour selon le
navigateur.

`core/date/` fournit un module d'environ 80 lignes, sans dépendance, sur des chaînes
`YYYY-MM-DD` typées de façon nominale :

```ts
type CalendarDate = string & { readonly __brand: 'CalendarDate' }
parse, format, today(tz), addDays, diffDays, compare, eachDay,
startOfMonth, endOfMonth, weekday, isWeekend
```

Les horodatages réels (création, réponse, retour) restent en `timestamptz`, affichés en
`Europe/Paris`. La frontière est nette : **une date de réservation n'a pas de fuseau, un
événement en a un.**

## 6. Logique de disponibilité

Le cœur métier, en fonctions pures dans `modules/pretotheque/domain/` :

```ts
overlaps(a: Range, b: Range): boolean
mergeRanges(ranges: Range[]): Range[]
busyRanges(bookings, { includePending }): Range[]
applyBuffer(range, bufferDays): Range
freeSlots(busy: Range[], window: Range, minDays: number): Range[]
canBook(item, request, existing): Ok | Conflict
suggestAlternatives(busy, request, window, limit): Range[]
```

Ce module est le premier écrit et le plus densément testé du projet : bornes inclusives,
plages adjacentes, chevauchement d'un seul jour, jours tampon, durée maximale, objet
indisponible, changement d'heure d'été. C'est là que se cachent tous les bugs de ce genre
d'application.

La requête de chevauchement côté base, en miroir :

```sql
SELECT * FROM booking
WHERE item_id = $1
  AND status IN ('pending', 'approved', 'active')
  AND daterange(start_date, end_date, '[]') && daterange($2, $3, '[]');
```

## 7. Notifications et validation en un clic

```
Demande créée
  → notification en base
  → mail au propriétaire (React Email) contenant deux liens signés :
       /valider/<jeton>?a=approve
       /valider/<jeton>?a=reject
  → jeton stocké haché (SHA-256), à usage unique, expirant à 14 jours
  → la page confirme l'action et propose de se connecter pour la suite
```

Le jeton est lié à `(booking_id, action, member_id)`. Il n'ouvre aucune session : il
autorise exactement une transition d'état, et rien d'autre. C'est ce qui permet de le
mettre dans un mail sans risque.

**Tâches planifiées** (conteneur `worker`, même image, entrée différente, `node-cron`) :

| Fréquence | Tâche |
|---|---|
| 08:00 | Rappel de récupération à J-1 |
| 08:05 | Rappel de retour le jour J |
| 08:10 | Relance de retard : à l'emprunteur à J+1, au propriétaire à J+3 |
| 08:15 | Expiration des demandes non traitées depuis 7 jours |
| 09:00 | Résumé quotidien pour les membres qui l'ont choisi |
| 02:00 | Sauvegarde `pg_dump` |
| 03:00 | Recalcul des écussons et des statistiques |

Pas de Task Scheduler DSM à configurer à la main : tout est dans le `compose.yaml`, donc
versionné et reproductible.

## 8. Moteur d'écussons

Une règle est du code, un écusson est une ligne en base.

```ts
type Rule = {
  key: string
  section: string
  evaluate(ctx: MemberStats): { unlocked: boolean; progress?: unknown }
}
```

Le moteur tourne à deux moments : **par événement** (après une transition de réservation,
sur les règles concernées) et **la nuit** (passage complet, qui rattrape tout et permet
d'ajouter une règle rétroactive sans script de migration). Le déblocage écrit dans
`member_achievement` puis pousse une entrée dans `activity` et une notification.

`MemberStats` est une vue agrégée : jours prêtés, jours empruntés, nombre d'objets,
retours à l'heure, retards, valeur du matériel partagé, économies estimées, filleuls. La
jauge prêteur / emprunteur en sort directement.

## 9. Déploiement

```
Internet
  │  box : redirection des ports 80 et 443 (déjà en place pour puzzpok.fr)
  ▼
Synology DS720+  (DSM 7.2, Container Manager en mode « Projet »)
  │
  ├─ Reverse Proxy DSM
  │     puzzpok.fr/factures      → localhost:5001   ← app Flask existante, INTACTE
  │     clhub.puzzpok.fr:443     → localhost:3000   ← nouvelle règle
  │  certificat Let's Encrypt de DSM, avec clhub.puzzpok.fr en nom alternatif
  │
  ├─ Projet Container Manager « monapp »  (existant, on n'y touche pas)
  │     monapp   5001:5000
  │
  └─ Projet Container Manager « clhub »   (nouveau)
        web      ghcr.io/arthurguillieux/clhub:latest  →  127.0.0.1:3000
        worker   même image, entrée cron
        db       postgres:16-alpine + btree_gist       (aucun port publié)
                 volume /volume1/docker/clhub/pg
        uploads  bind mount /volume1/docker/clhub/uploads

DNS   CNAME clhub.puzzpok.fr → puzzpok.fr
      (hérite automatiquement du mécanisme de suivi d'IP déjà en place sur l'apex)
Mails Resend, avec SPF et DKIM sur puzzpok.fr
```

**CGNAT : écarté.** `puzzpok.fr` est joignable depuis Internet, donc la redirection de
ports fonctionne sur cette ligne. Le plan Cloudflare Tunnel est abandonné.

**Cohabitation.** Le NAS héberge déjà une application Flask (facturation) sur le port hôte
5001, derrière une règle de proxy inversé DSM en sous-chemin. Le CLHUB s'installe à côté
sans y toucher : projet Container Manager distinct, ports distincts, sous-domaine distinct.

| Port hôte | Occupé par |
|---|---|
| 5000, 5001 | Application Flask existante — **ne pas utiliser** |
| 3000 | CLHUB `web` (publié sur `127.0.0.1` uniquement) |
| — | Postgres : aucun port publié, accessible seulement dans le réseau du projet |

**Plafonds mémoire obligatoires.** Le NAS a 2 Go de RAM et fait tourner l'application de
facturation de la famille. Les conteneurs CLHUB déclarent des limites explicites, pour
qu'aucun bug de notre côté ne puisse jamais faire tomber l'app de quelqu'un d'autre :

```yaml
web:      { mem_limit: 400m }
worker:   { mem_limit: 200m }
db:       { mem_limit: 256m }
```

**Postgres réglé pour un petit NAS** — sans ça, la configuration par défaut réserve
inutilement de la mémoire :

```
shared_buffers = 96MB      effective_cache_size = 256MB
work_mem = 4MB             maintenance_work_mem = 32MB
max_connections = 20       wal_compression = on
```

**Construction de l'image** : GitHub Actions, `linux/amd64`, multi-étapes sur
`node:22-alpine`, `output: 'standalone'`, utilisateur non-root, `HEALTHCHECK`. Le NAS ne
compile jamais — un build Next.js dans 2 Go de RAM se fait tuer par l'OOM killer.

**Migrations** : `drizzle-kit migrate` s'exécute au démarrage du conteneur `web`, avant le
serveur. Instance unique, donc aucune course possible.

**Secrets** : un fichier `/volume1/docker/clhub/.env` en `chmod 600`, hors du dépôt.
`.env.example` versionné.

## 10. Décisions consignées

### ADR-001 — Comptes par magic link, plutôt qu'aucun compte
Sans identité stable, n'importe qui peut annuler la réservation d'un autre, et toute la
gamification devient impossible. Or une adresse mail est déjà nécessaire pour notifier les
propriétaires : le compte existe de fait. Le magic link supprime la seule vraie friction
(créer et retenir un mot de passe). Accès sur invitation uniquement.

### ADR-002 — Postgres auto-hébergé, plutôt que SQLite
SQLite serait suffisant en volume, mais on perd les contraintes d'exclusion sur plages de
dates — exactement notre problème de correction central. Un conteneur Postgres sur un NAS
est une configuration parfaitement banale.

### ADR-003 — Calendrier construit à la main
Voir §4. Le calendrier est le produit ; on ne délègue pas le produit à une dépendance qui
impose son DOM.

### ADR-004 — `item_unit` : la disponibilité par exemplaire
Un objet en 6 exemplaires (des tréteaux) ne peut pas être couvert par la contrainte
d'exclusion sur `item_id` seul. La table `item_unit` porte une ligne par exemplaire ;
`booking.unit_id` référence l'unité réellement empruntée, et la contrainte d'exclusion
`booking_no_overlap` porte sur `(unit_id, daterange)` plutôt que sur `(item_id,
daterange)` — deux tréteaux du même objet se prêtent désormais indépendamment
(drizzle/0013_wakeful_skullbuster.sql).

La logique de disponibilité vivant dans des fonctions pures, l'extension est restée
circonscrite : `combinedBusyRanges` (modules/pretotheque/domain/availability.ts) combine
les plages occupées de chaque unité — un objet n'est réellement complet que le jour où
*toutes* ses unités le sont — puis réutilise `canBook`/`suggestAlternatives` sans
modification. `findAvailableUnitIndex` choisit ensuite l'unité réellement assignée à une
nouvelle demande. Un objet à une seule unité est simplement le cas particulier où cette
combinaison ne change rien.

Chaque objet démarre avec une unité par défaut (créée par `createItem`) ; le propriétaire
en ajoute d'autres depuis la fiche objet (section « Exemplaires ») s'il possède plusieurs
exemplaires. Retirer (archiver) une unité est bloqué s'il s'agit de la dernière active —
rendre l'objet indisponible est un choix explicite via `item.status`, pas un effet de
bord. La migration a créé une unité par objet existant (`quantity`, jamais exposé dans
aucun formulaire, est supprimé).

### ADR-005 — Réservations en dates pures
Voir §5. Élimine par construction toute une classe de bugs, et correspond à la réalité
d'usage : on ne prête pas une perceuse pour 90 minutes.

### ADR-006 — Une demande en attente ne bloque pas le créneau
Choix produit : plusieurs membres peuvent demander les mêmes dates, le propriétaire
arbitre. Évite les réservations défensives et la course au clic. Tombe naturellement du
`WHERE` de la contrainte d'exclusion.

### ADR-007 — Écussons et flux d'activité dans le socle
Ils doivent agréger toutes les sections présentes et futures. Les placer dans la
Prêtothèque imposerait une réécriture à la deuxième section.

### ADR-011 — `user` et `member` séparés, plutôt qu'une table unique
Section 3.1 sketchait à l'origine un `member` unique portant aussi l'identité (email,
nom). En implémentant Better Auth, ses deux mécanismes de personnalisation du modèle
utilisateur (mapping `schema.user` vers une table maison, ou `user.modelName` +
`fields`) demandent de renommer des colonnes et de faire correspondre exactement la forme
interne attendue — fragile, et mal documenté pour l'adaptateur Drizzle à la version
testée (1.6.25).

Plus sûr : laisser Better Auth posséder entièrement `user` (forme standard, jamais
modifiée), et faire de `member` une table de profil applicatif reliée par `member.user_id`.
Toute la mécanique d'authentification (session, magic link, tokens) reste l'affaire de
Better Auth ; `member` ne porte que ce qui est propre au club (numéro, parrainage, bio,
préférences). Coût : une jointure pour afficher un nom quelque part. Bénéfice : aucune
dépendance à un comportement interne non garanti d'une version à l'autre.

### ADR-012 — `member_number` en colonne IDENTITY, pas calculé en application
Un calcul `max(member_number) + 1` côté application peut faire race entre deux
acceptations d'invitation simultanées. Une colonne `GENERATED ALWAYS AS IDENTITY`
délègue l'atomicité à Postgres : le numéro est assigné au moment de l'insertion de la
ligne `member`, sans jamais pouvoir se dupliquer.

### ADR-013 — Portes d'entrée sur invitation : dans `sendMagicLink`, pas `disableSignUp`
Le plugin magic-link expose `disableSignUp` pour bloquer toute création de compte, mais
ça empêcherait aussi la création légitime lors du premier clic d'un invité. À la place,
`sendMagicLink` vérifie avant l'envoi : e-mail déjà membre → toujours autorisé ; sinon
→ il faut une invitation valide (ou être le tout premier membre du club, cas de
bootstrap). Si l'envoi est refusé, aucun lien n'est jamais généré : personne ne peut donc
se créer un compte sans invitation, sans qu'il soit nécessaire de désactiver l'auto-création
gérée nativement par Better Auth au moment de la vérification du lien.

### ADR-009 — Sous-domaine `clhub.puzzpok.fr`, pas un sous-chemin
L'application Flask déjà hébergée utilise une règle de proxy en sous-chemin
(`puzzpok.fr/factures`), ce qui est le bon choix pour Flask. Pour Next.js, le sous-chemin
impose un `basePath` que doivent respecter tous les liens, ressources statiques,
redirections d'authentification et la portée du service worker de la PWA — une source
durable de bugs subtils. Surtout, **deux applications sur le même domaine partagent leurs
cookies**, ce qui provoque des déconnexions inexplicables.

Un sous-domaine coûte un `CNAME`, une règle de proxy et un nom alternatif sur le
certificat. Le `CNAME` pointe vers l'apex plutôt que vers une IP, afin d'hériter
automatiquement du mécanisme de suivi d'IP dynamique déjà opérationnel.

### ADR-010 — Image construite par GitHub Actions, jamais sur le NAS
La méthode en place pour l'app Flask (copier les sources, laisser Container Manager
construire) fonctionne parce que Python n'a pas d'étape de compilation. `next build`
réclame 1,5 à 2,5 Go de mémoire vive d'un seul coup, sur une machine qui en a 2 au total et
qui héberge déjà DSM et une autre application : le processus serait tué. La compilation a
donc lieu sur les exécuteurs GitHub, et le `compose.yaml` référence `image:` au lieu de
`build:`. Effet de bord agréable : le déploiement devient un simple `docker compose pull`,
sans transfert de sources.

### ADR-008 — Mono-club, pas de multi-locataire
Un second cercle se règle par un second déploiement (dix minutes) plutôt que par un
système de permissions multi-locataires qui coûterait des semaines et ne servirait
probablement jamais.
