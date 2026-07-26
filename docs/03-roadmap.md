# LE CLHUB — Feuille de route

Le club a choisi de construire les lots 0 à 3 avant d'ouvrir l'accès aux membres. Cette
feuille de route est donc un **ordre de construction**, pas un plan de livraisons
successives.

Chaque lot se termine par une **condition de sortie vérifiable**. On ne passe pas au
suivant tant qu'elle n'est pas remplie.

---

## Lot 0 — Le tuyau

L'objectif n'est pas de coder des fonctionnalités, c'est de prouver que la chaîne complète
fonctionne sur le matériel réel. Découvrir un blocage d'infrastructure après trois mois de
développement serait le pire scénario possible.

**Avant d'écrire une ligne de code**

- [ ] Vérifier le CGNAT : comparer l'IP WAN affichée par DSM et l'IP publique réelle. Si
      elles diffèrent, basculer sur Cloudflare Tunnel avant de continuer.
- [ ] Vérifier la RAM du DS720+ et ce qui tourne déjà dans Container Manager.
- [ ] Container Manager installé, dossier partagé `/volume1/docker/clhub` créé.
- [ ] Ports 80 et 443 redirigés vers le NAS. **Jamais 5000 ni 5001.**
- [ ] Durcissement DSM : pare-feu actif, administration restreinte au LAN, blocage
      automatique, protection de compte, 2FA sur tous les comptes, compte `admin` par
      défaut désactivé.
- [ ] `CNAME clhub.<domaine>` → `<ddns>.synology.me`, certificat Let's Encrypt émis par DSM.
- [ ] Compte Resend, domaine vérifié, SPF et DKIM publiés.

**Développement**

- [ ] Squelette Next.js 15 + TypeScript strict + Tailwind v4 + shadcn/ui
- [ ] Drizzle branché sur Postgres, première migration, script de seed
- [ ] `Dockerfile` multi-étapes, `compose.yaml`, workflow GitHub Actions → GHCR
- [ ] Route `/api/health` qui vérifie la base
- [ ] Une page qui envoie un mail de test via Resend

**Condition de sortie** — `https://clhub.<domaine>` répond en HTTPS valide depuis un
téléphone en 4G, hors du réseau local, et un mail de test arrive dans la boîte de
réception (pas dans les indésirables).

---

## Lot 1 — Le socle du club

- [x] Module `core/date` (`CalendarDate`) et sa suite de tests
- [x] Better Auth avec magic link, sur invitation exclusivement
- [x] `member`, numéro de membre attribué à la première connexion, parrainage enregistré
- [x] Parcours d'invitation : un admin invite par mail, le filleul clique et entre
- [ ] Envoi et stockage des avatars (`sharp`, vignettes pré-générées)
- [ ] Design system : jetons de couleur, Bricolage Grotesque + Inter, mode sombre,
      composants de base
- [ ] Coquille applicative : navigation, sélecteur de section, en-tête, navigation
      mobile
- [ ] **La carte de membre** — la page profil, objet graphique signature
- [ ] `core/notifications` : création, préférences, `action_token`, page de validation
      publique
- [ ] `core/mail` : mise en page commune des courriers du club
- [ ] `core/activity` : écriture et lecture du flux
- [ ] Page d'accueil du club affichant le flux
- [ ] Réglages du membre : nom, avatar, bio, téléphone, préférences de notification

**Condition de sortie** — deux membres invités peuvent se connecter par magic link,
personnaliser leur carte, et voir leurs actions apparaître dans le flux commun.

---

## Lot 2 — La Prêtothèque

C'est le gros morceau, dans un ordre volontairement contre-intuitif : **la logique de
disponibilité d'abord, l'interface ensuite.**

### 2a — Le domaine

- [ ] `modules/pretotheque/domain/` : `overlaps`, `mergeRanges`, `busyRanges`,
      `applyBuffer`, `freeSlots`, `canBook`, `suggestAlternatives`
- [ ] Tests exhaustifs : bornes inclusives, plages adjacentes, chevauchement d'un jour,
      jours tampon, durée maximale, objet indisponible
- [ ] Schéma `item` et `booking`, contrainte d'exclusion `btree_gist`
- [ ] Test d'intégration prouvant qu'une double réservation concurrente échoue en base

### 2b — Les objets

- [ ] CRUD complet des objets, avec tous les champs de la fiche
- [ ] Envoi de plusieurs photos, réordonnancement, photo principale
- [ ] Auto-remplissage depuis une URL (métadonnées Open Graph, côté serveur)
- [ ] Catalogue : grille, recherche, filtres par section, par propriétaire, par
      disponibilité
- [ ] Page de fiche objet

### 2c — Le calendrier

- [ ] `core/ui/calendar/layout.ts` : `buildMonthGrid`, `sliceByWeek`, `packLanes` + tests
- [ ] Vue mensuelle avec plages multi-jours, coins arrondis aux seules vraies extrémités
- [ ] Deux états visuels : confirmé (plein) et en attente (hachuré)
- [ ] Sélection de plage : glisser sur ordinateur, tap-tap sur mobile
- [ ] Vue agenda pour mobile
- [ ] Navigation clavier et rôles ARIA

### 2d — Le cycle de prêt

- [ ] Demande de réservation avec message
- [ ] Validation automatique par objet
- [ ] Mail au propriétaire avec les deux boutons signés, fonctionnant sans connexion
- [ ] Page de confirmation de validation ou de refus
- [ ] Transitions d'état, `booking_event`, annulation par l'emprunteur
- [ ] Récupération et retour, avec état constaté
- [ ] Tableaux de bord : « mes objets », « mes emprunts », « à valider »

**Condition de sortie** — un membre réserve un objet appartenant à un autre, le
propriétaire valide depuis son téléphone en cliquant dans le mail sans se connecter, et le
prêt se déroule jusqu'au retour.

---

## Lot 3 — Ergonomie et confiance

- [ ] **Vue planning** : lignes = objets, colonnes = jours
- [ ] Suggestion de créneaux libres en cas de conflit
- [ ] Liste d'attente (« préviens-moi si ça se libère »)
- [ ] Déplacer et étirer sa réservation directement sur la grille
- [ ] Conteneur `worker` + tâches planifiées : rappels, relances, expiration, résumé
- [ ] **Chantiers** : réserver plusieurs objets pour un même projet
- [ ] Commentaires et astuces sur les fiches
- [ ] Signalements et journal d'entretien
- [ ] Flux iCal par membre
- [ ] Recherche d'objet + achat groupé + copropriété
- [ ] Lots (« kit soirée »)
- [ ] `item_unit` : la disponibilité par exemplaire (ADR-004)
- [ ] PWA installable, manifeste, icônes, lecture hors ligne de ses emprunts
- [ ] QR codes par objet + planche d'étiquettes imprimable
- [ ] Sauvegardes automatiques + **procédure de restauration testée**

**Condition de sortie** — les rappels tombent tout seuls, un chantier de trois objets chez
deux propriétaires se réserve d'un geste, et une restauration de sauvegarde a été
effectuée pour de vrai au moins une fois.

---

## Lot 4 — La vie du club

- [ ] Moteur d'écussons : règles, catalogue, évaluation par événement et nocturne
- [ ] Le catalogue d'écussons du lancement, dont deux ou trois secrets
- [ ] Écussons affichés comme des patches sur la carte de membre
- [ ] Jauge prêteur / emprunteur en jours-objets
- [ ] Page statistiques : économies réalisées, valeur du club, objet le plus convoité
- [ ] Arbre du club (parrainages)
- [ ] Webhook vers la conversation de groupe
- [ ] Playwright sur les parcours critiques
- [ ] Pages d'administration : membres, invitations, modération

**Condition de sortie** — on ouvre l'accès à la bande.

---

## Après

- **CLHUB Wrapped** — la rétrospective annuelle, à sortir en décembre
- **Deuxième section** — candidates : caisse commune, dispos de groupe, ou **menus du
  club** (sondage type Tally pour un repas de groupe — qui vient, qui apporte quoi,
  allergies). Cette dernière est la plus légère à construire : elle ne dépend que du
  socle, pas du moteur de calendrier
- **Prêt de livres et de jeux** — le même moteur, une catégorie de plus

---

## Ordre de construction, en une phrase

Prouver le tuyau, poser le socle, écrire la logique de disponibilité avant toute
interface, construire le calendrier à la main, boucler le cycle de prêt, puis seulement
enrichir.
