# Tests Playwright

Parcours critiques bout en bout, contre une vraie instance de l'appli (pas de mock).

## Lancer les tests

```
pnpm test:e2e
```

Ça fait tout tout seul : réinitialise la base `clhub_e2e` (créée une fois via `createdb clhub_e2e`
+ `CREATE EXTENSION btree_gist` si elle n'existe pas encore), démarre un `next dev` dédié sur le
port 3100, joue les tests, puis coupe le serveur.

Aucun risque pour la base de développement habituelle (`clhub`) — tout tourne sur une base et un
port séparés, voir `global-setup.ts`.

## Comment ça authentifie sans mot de passe

L'appli n'a que la connexion par lien magique. `RESEND_API_KEY` est forcé à vide pour le serveur
de test (`global-setup.ts`), donc chaque lien qui aurait dû partir par mail atterrit simplement
dans le journal du serveur (`[dev mail] ...` — voir `core/mail/send.ts`). `helpers/log.ts` lit ce
journal pour récupérer le lien exact qu'un vrai mail aurait contenu.

`auth.setup.ts` se connecte une fois (premier membre du club, aucune invitation nécessaire) et
sauvegarde la session — les autres tests repartent de cette session déjà connectée plutôt que de
rejouer la connexion à chaque fois. `auth.spec.ts` teste quand même le circuit complet
(invitation → lien magique → connexion) pour un second membre.

## Ajouter un test

- Un parcours qui a besoin d'être connecté : utilise la session déjà sauvegardée (comportement par
  défaut du projet `chromium`).
- Un second membre : `helpers/db.ts::createTestMember()` insère directement en base plutôt que de
  repasser par tout le circuit d'invitation — utile si le test porte sur autre chose que
  l'authentification elle-même.
- Un lien envoyé par mail : `helpers/log.ts::waitForLoggedUrl()`.
