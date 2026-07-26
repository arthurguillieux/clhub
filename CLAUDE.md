# Instructions pour Claude Code — LE CLHUB

## Le projet

Plateforme privée auto-hébergée pour un groupe d'amis. Première section : une
**prêtothèque** (catalogue de matériel partagé + calendrier de réservation + validation par
le propriétaire).

**Lire avant de coder** : [docs/02-architecture.md](docs/02-architecture.md) puis
[docs/03-roadmap.md](docs/03-roadmap.md). Les décisions consignées (ADR) en fin du document
d'architecture ont déjà été tranchées — ne pas les rouvrir sans raison nouvelle et
explicite.

## Langue

- **Interface, mails, contenu : en français.** Pas d'internationalisation, chaînes en dur.
- **Code, noms de variables, commentaires techniques, messages de commit : en anglais.**
- Vocabulaire du produit à respecter : un **membre** (pas « utilisateur »), une **section**
  (pas « catégorie » ni « app »), un **écusson** (pas « badge » ni « succès »), un
  **chantier** (pas « projet »), une **carte de membre**.

## Règles d'architecture non négociables

1. **`src/modules/*/domain/` est pur.** Aucun import de Drizzle, React, Next, ni d'aucun
   module de `core/` autre que `core/date`. Ce sont des fonctions sur des types simples.
   Toute la logique de disponibilité vit là, et y est testée exhaustivement.

2. **Sens des dépendances** : `app/` → `actions/` → `domain/` et `data/`. Jamais l'inverse.
   Les composants de `app/` restent fins : ils valident, appellent, affichent.

3. **Les dates de réservation utilisent `CalendarDate`** (`core/date`), c'est-à-dire des
   chaînes `YYYY-MM-DD` typées nominalement. **Ne jamais utiliser `Date` de JavaScript ni
   `date-fns` pour de la logique métier de réservation** — ils manipulent des instants et
   réintroduisent les bugs de fuseau horaire. Les horodatages réels (création, réponse,
   retour) restent en `timestamptz`.

4. **Pas de bibliothèque de calendrier.** La grille est construite à la main en CSS Grid,
   avec l'algorithme de placement en couloirs décrit au §4 de l'architecture. Ne pas
   installer FullCalendar, react-big-calendar ou équivalent.

5. **La contrainte d'exclusion Postgres est la source de vérité** contre les doubles
   réservations. La validation applicative améliore le message d'erreur, elle ne remplace
   pas la contrainte. Toute violation doit être rattrapée et traduite en français lisible.

6. **Les écussons et le flux d'activité appartiennent à `core/`**, pas à la Prêtothèque.
   Ils doivent agréger les sections futures.

7. **Server Actions plutôt que routes API** pour les mutations. Les routes `app/api/` sont
   réservées aux points d'entrée externes : santé, iCal, webhooks, envoi de fichiers.

8. **Validation Zod à toutes les frontières** — Server Actions, paramètres de recherche,
   webhooks, métadonnées récupérées depuis des URL externes.

## Conventions de code

- TypeScript strict : `strict`, `noUncheckedIndexedAccess`, pas de `any`, pas de
  `!` non-null sans commentaire justifiant.
- Fichiers en `kebab-case`, composants React en `PascalCase`, hooks en `useXxx`.
- Schéma Drizzle découpé par domaine dans `core/db/schema/`, réexporté par un `index.ts`.
- Colonnes en `snake_case`, propriétés TypeScript en `camelCase`.
- Migrations générées par `drizzle-kit`, jamais écrites à la main, jamais modifiées après
  application.
- Tailwind : utiliser les jetons du thème (`bg-surface`, `text-muted`, `border-subtle`),
  pas de valeur brute (`bg-[#1F3B2C]`) hors définition du thème.
- Mode sombre traité en même temps que le mode clair, jamais après coup.
- Composants serveur par défaut ; `'use client'` seulement là où c'est nécessaire, et le
  plus bas possible dans l'arbre.

## Tests

- **Vitest sur `domain/` et `core/date`** : c'est le seul endroit où la couverture doit
  être proche de l'exhaustif. Cas obligatoires pour la disponibilité — bornes inclusives,
  plages adjacentes, chevauchement d'un seul jour, jours tampon, durée maximale dépassée,
  objet indisponible, changement d'heure.
- **Un test d'intégration** prouvant que deux réservations concurrentes confirmées sur les
  mêmes dates échouent au niveau de la base.
- **Playwright** sur les parcours critiques seulement : invitation et connexion, création
  d'un objet, réservation puis validation par mail.
- Pas de test sur les composants d'affichage. Ça ne rapporte rien ici.

## Ce qu'il ne faut pas faire

- Ne pas introduire de multi-club ni de notion de locataire (ADR-008).
- Ne pas gérer d'argent : ni caution, ni paiement, ni remboursement.
- Ne pas ajouter de télémétrie, de traceur ou d'analytique.
- Ne pas ajouter de notation entre membres, ni de classement avec podium, ni de série
  (streak) — voir §6 du document produit.
- Ne pas construire l'image Docker sur le NAS : 2 Go de RAM, le build sera tué. C'est
  GitHub Actions qui construit.
- Ne pas mettre de secret dans le dépôt. Uniquement `.env.example`.
- Ne pas ajouter de dépendance sans nécessité claire. Cette application doit encore
  démarrer dans cinq ans sur un NAS.

## Commandes

```bash
pnpm dev                # développement local
pnpm test               # Vitest
pnpm test:e2e           # Playwright
pnpm lint && pnpm typecheck
pnpm db:generate        # générer une migration à partir du schéma
pnpm db:migrate         # appliquer les migrations
pnpm db:seed            # jeu de données de démonstration
pnpm db:studio          # Drizzle Studio
```

Un `docker compose` local fournit Postgres en développement.

## Données de démonstration

Le `seed` doit produire un club crédible, pas trois lignes vides : une dizaine de membres
avec des numéros et des avatars, une trentaine d'objets répartis sur les cinq sections avec
de vrais prix, et **des réservations passées, en cours et à venir, dont plusieurs
multi-jours et qui se chevauchent sur les demandes en attente**. Sans ça, impossible de
juger le calendrier pendant le développement — et le calendrier est le produit.
