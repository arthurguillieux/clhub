# LE CLHUB

> Le club, en ligne. Une plateforme auto-hébergée pour une bande de potes — première section : la **Prêtothèque**.

Le CLHUB est un hub privé, sur invitation, qui héberge plusieurs petites applications
partagées entre amis. Chaque application est une « section » du club, et toutes se
branchent sur un socle commun : identité, notifications, flux d'activité, écussons.

La première section est une **prêtothèque** : le catalogue du matériel que chacun met à
disposition du groupe (bricolage, jardinage, ménage, festif), avec un calendrier de
réservation par objet et une validation par le propriétaire.

## Sections

| Section | État | Description |
|---|---|---|
| 📦 **Prêtothèque** | En construction | Catalogue de matériel partagé, calendrier de réservation, validation par le propriétaire |
| 💸 Caisse commune | Idée | Dépenses partagées, qui doit quoi à qui |
| 📅 Dispos de groupe | Idée | Trouver une date qui va à tout le monde |
| 🍽️ Menus du club | Idée | Sondages type Tally pour organiser un repas de groupe : qui vient, qui apporte quoi, allergies |
| 🍳 Recettes | Idée | Le carnet de recettes du club |

## Ce que fait la Prêtothèque

- **Fiche détaillée par objet** — marque, modèle, prix, lien vers le produit, photos
  réelles, accessoires fournis, consommables à prévoir, consignes de sécurité
- **Calendrier de réservation** — vue mensuelle avec plages multi-jours, vue planning
  (tous les objets d'un coup), vue agenda sur mobile
- **Validation par le propriétaire** — un mail avec deux boutons, sans avoir à se
  connecter ; ou réservation directe pour les objets peu sensibles
- **Chantiers** — réserver plusieurs objets d'un coup pour un même projet
- **Rappels automatiques** — récupération, retour, et relance en cas d'oubli
- **Vie du club** — carte de membre, écussons, jauge prêteur / emprunteur, économies
  réalisées, recherche d'objet et achat groupé

## Stack

Next.js 15 · TypeScript · Tailwind v4 · PostgreSQL 16 · Drizzle ORM · Better Auth
(magic link) · Resend · Docker

Auto-hébergé sur un **Synology DS720+** via Container Manager, derrière le reverse proxy
de DSM. Les images sont construites par GitHub Actions et publiées sur GHCR ; le NAS ne
fait que les récupérer.

## Documentation

- [Vision produit](docs/01-produit.md) — le concept, l'identité, les fonctionnalités
- [Architecture](docs/02-architecture.md) — stack, modèle de données, déploiement, décisions techniques
- [Feuille de route](docs/03-roadmap.md) — le découpage en lots
- [Exploitation](docs/04-exploitation.md) — déploiement, sauvegardes, restauration, sécurité

## Licence

MIT
