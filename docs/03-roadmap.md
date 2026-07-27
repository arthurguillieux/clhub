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
- [x] Envoi et stockage des avatars (`sharp`, vignettes pré-générées)
- [x] Design system : jetons de couleur, Bricolage Grotesque + Inter, mode sombre,
      composants de base
- [x] Coquille applicative : navigation, sélecteur de section, en-tête, navigation
      mobile
- [x] **La carte de membre** — la page profil, objet graphique signature
- [x] `core/notifications` : création, préférences, `action_token`, page de validation
      publique
- [x] `core/mail` : mise en page commune des courriers du club
- [x] `core/activity` : écriture et lecture du flux
- [x] Page d'accueil du club affichant le flux
- [x] Réglages du membre : nom, avatar, bio, téléphone, préférences de notification

**Condition de sortie** — deux membres invités peuvent se connecter par magic link,
personnaliser leur carte, et voir leurs actions apparaître dans le flux commun.

---

## Lot 2 — La Prêtothèque

C'est le gros morceau, dans un ordre volontairement contre-intuitif : **la logique de
disponibilité d'abord, l'interface ensuite.**

### 2a — Le domaine

- [x] `modules/pretotheque/domain/` : `overlaps`, `mergeRanges`, `busyRanges`,
      `applyBuffer`, `freeSlots`, `canBook`, `suggestAlternatives`
- [x] Tests exhaustifs : bornes inclusives, plages adjacentes, chevauchement d'un jour,
      jours tampon, durée maximale, objet indisponible
- [x] Schéma `item` et `booking`, contrainte d'exclusion `btree_gist`
- [x] Test d'intégration prouvant qu'une double réservation concurrente échoue en base

### 2b — Les objets

- [x] CRUD complet des objets, avec tous les champs de la fiche — à l'exception des
      **étiquettes libres** et de l'**année d'achat** mentionnées en §5.1 du document
      produit, jamais ajoutées au schéma `item`
- [x] Envoi de plusieurs photos, réordonnancement, photo principale (table `item_photo`,
      galerie avec photo principale)
- [x] Auto-remplissage depuis une URL (métadonnées Open Graph, côté serveur)
- [x] Catalogue : grille, recherche, filtres par section, par propriétaire, par
      disponibilité
- [x] Page de fiche objet

### 2c — Le calendrier

- [x] `core/ui/calendar/layout.ts` : `buildMonthGrid`, `sliceByWeek`, `packLanes` + tests
- [x] Vue mensuelle avec plages multi-jours, coins arrondis aux seules vraies extrémités
- [x] Deux états visuels : confirmé (plein) et en attente (hachuré)
- [x] Sélection de plage — fait en tap-tap (deux clics) partout ; le glisser-déposer sur
      ordinateur n'est pas implémenté pour la *sélection*, le tap-tap fonctionne aussi
      bien à la souris (le glisser existe en revanche pour déplacer/étirer une
      réservation existante, voir plus bas)
- [x] Vue agenda pour mobile
- [x] Navigation clavier et rôles ARIA

### 2d — Le cycle de prêt

- [x] Demande de réservation avec message
- [x] Validation automatique par objet
- [x] Mail au propriétaire avec les deux boutons signés, fonctionnant sans connexion
- [x] Page de confirmation de validation ou de refus
- [x] Transitions d'état, annulation par l'emprunteur (`booking_event` dédié non créé —
      l'historique passe par `core/activity`)
- [x] Récupération et retour, avec état constaté
- [x] Tableaux de bord : « mes objets », « mes emprunts », « à valider »

**Condition de sortie** — un membre réserve un objet appartenant à un autre, le
propriétaire valide depuis son téléphone en cliquant dans le mail sans se connecter, et le
prêt se déroule jusqu'au retour. ✅ Vérifié de bout en bout dans le navigateur le
2026-07-26.

---

## Lot 3 — Ergonomie et confiance

- [x] **Vue planning** : lignes = objets, colonnes = jours
- [x] Suggestion de créneaux libres en cas de conflit
- [x] Liste d'attente (« préviens-moi si ça se libère »)
- [x] Déplacer et étirer sa réservation directement sur la grille
- [x] Conteneur `worker` + tâches planifiées : rappels, relances, expiration —
      en `POST /api/cron` déclenché par le Planificateur DSM plutôt qu'un vrai conteneur
      `worker` (voir docs/04-exploitation.md §7). Relances en cas de dépassement faites :
      emprunteur à J+1, propriétaire à J+3 (docs/01-produit.md §5.3), chacune une seule
      fois (vérifié : relancer le job le même jour n'envoie rien de plus), notification
      in-app systématique + mail optionnel selon les préférences de chacun. Le résumé
      périodique reste à faire
- [x] Préférences de notification par membre (member.notifPrefs, en base depuis le
      Lot 1 mais jamais honoré jusqu'ici) — gate l'envoi du mail, jamais la notification
      in-app elle-même
- [x] **Chantiers** : réserver plusieurs objets pour un même projet — un mail par
      *réservation* est envoyé, pas encore consolidé par propriétaire quand il possède
      plusieurs objets du même chantier
- [x] Commentaires et astuces sur les fiches
- [x] Signalements et journal d'entretien
- [x] Flux iCal par membre
- [x] Recherche d'objet + déclenchement d'achat groupé — la **copropriété** sur l'objet
      créé (§5.5 du document produit) n'est en revanche pas modélisée : un achat groupé se
      termine par une notification aux intéressés, pas par un objet à plusieurs
      propriétaires en base. Nécessite une décision produit (répartition, qui gère l'objet)
      avant d'être construite
- [ ] Lots (« kit soirée »)
- [x] `item_unit` : la disponibilité par exemplaire (ADR-004)
- [x] PWA installable, manifeste, icônes, lecture hors ligne de ses emprunts
- [x] QR codes par objet + planche d'étiquettes imprimable
- [x] Sauvegardes automatiques (`docker/backup.sh`) + **procédure de restauration
      testée** (`docker/restore.sh`) — dry-run réel en local le 26/07/2026 (voir
      docs/04-exploitation.md §7) ; reste un vrai passage sur le NAS une fois `db`
      déployé, seule chose qu'un test local ne peut pas couvrir (chemins `/volume1/...`,
      permissions DSM)

**Condition de sortie** — les rappels tombent tout seuls, un chantier de trois objets chez
deux propriétaires se réserve d'un geste, et une restauration de sauvegarde a été
effectuée pour de vrai au moins une fois.

---

## Lot 4 — La vie du club

- [x] Moteur d'écussons : règles en code (core/achievements/catalog.ts), catalogue en base
      (table `achievement`), évaluation par recalcul complet (cron nocturne + à la
      consultation de la fiche membre) plutôt que par événement fin — largement suffisant
      à l'échelle du club, et bien plus simple à maintenir
- [x] Le catalogue d'écussons du lancement (8 publics + 3 secrets : Oiseau de nuit,
      Increvable, Vide-grenier)
- [x] Écussons affichés comme des patches sur la carte de membre
- [x] Jauge prêteur / emprunteur en jours-objets
- [ ] Page statistiques : économies réalisées, valeur du club, objet le plus convoité — la
      version "rétrospective annuelle" existe (`/wrapped`, voir plus bas) ; une page dédiée
      aux statistiques courantes (indépendante de l'année) reste à faire
- [ ] Arbre du club (parrainages)
- [ ] Webhook vers la conversation de groupe
- [ ] Playwright sur les parcours critiques
- [ ] Pages d'administration : membres, invitations, modération

**Condition de sortie** — on ouvre l'accès à la bande.

---

## Après

- [x] **CLHUB Wrapped** — la rétrospective annuelle (`/wrapped`, sélecteur d'année) : objet
      le plus convoité, mois le plus chargé, duo prêteur/emprunteur, jours-objets partagés
      et économies réalisées. Construite maintenant plutôt qu'en décembre — reste
      pertinente consultée en cours d'année, pas seulement en rétrospective de fin d'année
- [x] **Deuxième section : les menus du club** (`/menus`) — première version : proposer un
      repas pour une date donnée, chaque membre répond présent/absent, ce qu'il apporte,
      ses allergies. Notification au propriétaire du repas quand quelqu'un vient. Pas de
      tirage au sort de qui cuisine pour l'instant (mentionné comme optionnel dans le
      document produit). Exactement aussi léger que prévu : aucun moteur de calendrier,
      juste le socle (membres, notifications, flux)
- [x] **Troisième section : l'agenda en commun** (`/agenda`) — chaque membre colle dans ses
      réglages l'adresse secrète iCal de son agenda perso (Google/Outlook/Apple) ; l'app
      lit uniquement les plages occupées (jamais le titre, le lieu ni le contenu — ces
      champs ne sont même pas extraits du fichier) et affiche une vue mensuelle commune
      mettant en avant les jours où tout le monde est libre. Parsing RFC 5545 maison
      (`core/ical/parse.ts`, unfolding des lignes, `VALUE=DATE`, `TZID`, temps flottants)
      avec expansion de récurrence (`RRULE`/`EXDATE`) via la bibliothèque `rrule` — seule
      dépendance ajoutée pour cette fonctionnalité, la logique de récurrence étant risquée
      à réécrire à la main. Fetch protégé contre le SSRF comme l'auto-remplissage Open
      Graph (`core/net/urlSafety.ts`, mutualisé entre les deux). Aucune synchronisation ni
      cache : lecture à la volée à chaque consultation, au plus simple comme demandé
- [x] **Quatrième section : la caisse commune** (`/caisse`) — première version : un
      journal de mouvements (contribution ou dépense, montant, description), le solde
      couramment affiché n'étant jamais qu'une somme recalculée depuis ce journal. Pas de
      répartition ni de remboursement entre membres (ce n'est pas un Splitwise) — le strict
      nécessaire pour savoir combien reste dans le pot
- [x] **Cinquième section : nos recettes** (`/recettes`) — première version : un membre
      ajoute une recette (titre, ingrédients, préparation), le carnet est commun et lu par
      tous. Pas de notation ni de commentaires pour l'instant
- **Prêt de livres et de jeux** — le même moteur, une catégorie de plus

---

## Ordre de construction, en une phrase

Prouver le tuyau, poser le socle, écrire la logique de disponibilité avant toute
interface, construire le calendrier à la main, boucler le cycle de prêt, puis seulement
enrichir.
