# LE CLHUB — Vision produit

## 1. Le problème

Une bande de potes possède collectivement une quantité déraisonnable de matériel :
perceuses, ponceuses, tondeuses, nettoyeurs haute pression, machines à fumée, jeux de
lumières. Chaque objet dort 360 jours par an chez son propriétaire, et personne ne sait
qui a quoi. Le résultat habituel : on rachète ce que le voisin possède déjà, ou on
demande dans la conversation de groupe et le message se perd.

Le CLHUB rend ce patrimoine visible, réservable, et sans friction sociale.

## 2. Le concept

**Le CLHUB est un club.** Ce n'est pas une métaphore décorative, c'est le principe
structurant du produit :

- On y entre **par parrainage** — un membre t'invite, et c'est enregistré.
- On y a un **numéro de membre**, attribué dans l'ordre d'arrivée. Définitif.
- On y gagne des **écussons**, comme dans un club de bowling ou chez les scouts.
- Il est composé de **sections**. La Prêtothèque est la première.

Ce cadre résout élégamment trois problèmes : il justifie l'accès sur invitation, il donne
un vocabulaire durable pour un hub multi-applications, et il fournit une direction
artistique cohérente qui évite à la fois le kitsch bois-et-clous et le SaaS générique.

## 3. Le socle et les sections

Le socle du CLHUB est partagé par toutes les sections, présentes et futures :

| Brique | Rôle |
|---|---|
| **Identité** | Membres, cartes de membre, avatars, invitations, parrainage, rôles |
| **Notifications** | Envoi de mails, centre de notifications, préférences par membre |
| **Flux d'activité** | Un fil commun alimenté par toutes les sections |
| **Écussons** | Moteur de gamification générique, indépendant de la section |
| **Design system** | Composants, thème, mode sombre, calendrier |

Point d'architecture important : **les écussons et le flux d'activité vivent dans le
socle, pas dans la Prêtothèque.** Ton profil accumule donc des écussons venant de toutes
les sections, et la page d'accueil mélange « Paul a mis une ponceuse au prêt » et « Léa a
ajouté une dépense ». C'est exactement ce qui distingue une plateforme de trois sites
collés ensemble.

Corollaire agréable : le moteur de prêt (objet + calendrier + validation) se généralise
tel quel aux **livres, jeux de société, jeux vidéo, matériel photo**. C'est une section
supplémentaire, pas une application à réécrire.

Une autre section candidate, notée pour plus tard : **les menus du club**, un sondage type
Tally pour organiser un repas de groupe — qui vient, qui apporte quoi, allergies et
régimes, éventuellement un tirage au sort de qui cuisine. Elle réutilise directement le
socle (membres, notifications, flux) sans avoir besoin du moteur de calendrier de la
Prêtothèque, ce qui en ferait une deuxième section légère et rapide à construire.

## 4. Identité visuelle

**Registre** : club privé rencontre atelier. Chaleureux, un peu artisanal, jamais kitsch.

- **Neutres chauds** en base (pas de gris bleutés froids)
- **Primaire** vert bouteille profond — le côté club
- **Accent** orange chantier — les actions, les points d'attention
- **Couleurs de section** qui pilotent le code couleur du calendrier :
  bricolage (orange), jardinage (vert), ménage (cyan), festif (magenta), autre (ardoise)
- **Typographie** : titres en **Bricolage Grotesque** (oui, cette police existe
  réellement, et son nom seul en fait le choix évident ici), interface en Inter
- **Mode sombre** de premier ordre, pas une réflexion après coup
- **Textures** : une trame de papier millimétré très discrète en fond de certaines
  surfaces, jamais du bois ni du métal brossé
- **Mobile d'abord** : l'app s'utilise debout dans un garage, sur un téléphone, avec deux
  barres de réseau

### La carte de membre

L'objet graphique signature du CLHUB. Elle porte l'avatar, le numéro de membre, la date
d'entrée, le parrain, la jauge prêteur / emprunteur, et les écussons décrochés affichés
comme des patches brodés. C'est la page profil, mais c'est aussi un objet qu'on a envie de
montrer.

## 5. La Prêtothèque en détail

### 5.1 La fiche objet

Le but de la fiche est de répondre à une seule question : **« est-ce que cet objet
correspond à mon besoin ? »**, sans avoir à envoyer un message.

- Nom, description, section, étiquettes libres
- **Marque, modèle, lien vers le produit, prix, année d'achat**
- **Photos réelles** prises au téléphone, plus éventuellement l'image du catalogue
- État déclaré : neuf / bon / usagé / fragile
- **Accessoires fournis** (« livré avec 3 mèches »)
- **Consommables à prévoir** (« apporte ton propre disque à tronçonner », « fournir l'essence »)
- **Consignes de sécurité** (« lunettes obligatoires »)
- Lieu et modalités de récupération
- Valeur de remplacement, à titre purement indicatif
- Réglages du propriétaire : validation automatique, durée de prêt maximale, jours tampon
- Commentaires et astuces des autres membres (« attention, le mandrin se desserre »)
- Journal d'entretien et signalements

**Auto-remplissage depuis un lien** : on colle une URL Leroy Merlin, Amazon ou autre, et
l'app récupère le titre, l'image et le prix via les métadonnées Open Graph. Le meilleur
moyen d'obtenir des fiches bien remplies, c'est qu'il n'y ait presque rien à remplir.

### 5.2 Le calendrier

C'est le cœur du produit, et l'endroit où ce genre d'application est le plus souvent
raté. Trois vues :

| Vue | Usage |
|---|---|
| **Mois** | Vue par défaut sur un objet : qui l'a réservé quand, plages continues sur plusieurs jours |
| **Planning** | Lignes = objets, colonnes = jours. La vue « tout le club d'un coup » : on voit instantanément ce qui est libre ce week-end |
| **Agenda** | Liste chronologique, la seule lisible sur un écran de téléphone |

**Décisions d'ergonomie :**

- **Granularité : la journée entière.** Un prêt d'outil ne se compte pas en heures, et
  travailler en dates pures élimine toute la classe de bugs liés aux fuseaux horaires. Un
  champ optionnel *matin / après-midi / soir* couvre le rendez-vous de récupération et de
  retour.
- **Glisser pour sélectionner** une plage sur ordinateur, tap-tap (début puis fin) sur
  mobile. On peut déplacer ou étirer sa propre réservation directement sur la grille.
- **Deux états visuels nettement distincts** : confirmé (plein, couleur de section) et en
  attente (hachuré, translucide).
- **Une demande en attente ne bloque pas le créneau.** Plusieurs membres peuvent demander
  les mêmes dates, et c'est le propriétaire qui arbitre. C'est plus juste qu'un « premier
  arrivé, premier servi » et ça évite les réservations défensives.
- **Suggestion de créneaux** : si c'est pris, l'app propose directement « libre du 15 au
  18 » au lieu de laisser deviner.
- **Liste d'attente** : « préviens-moi si ça se libère ».
- **Jours tampon** configurables entre deux prêts, pour que le propriétaire récupère et
  nettoie.
- **Flux iCal** : chaque membre a une URL d'abonnement, et ses emprunts apparaissent dans
  son agenda personnel.
- **Accessibilité** : navigation clavier complète sur la grille, rôles ARIA corrects. Ce
  n'est pas une case à cocher, c'est ce qui distingue un calendrier soigné d'un tableau de
  divs.

### 5.3 Le parcours de réservation

```
Catalogue → fiche objet → sélection de la plage sur le calendrier
   → message optionnel (« pour refaire ma terrasse »)
   → [validation auto ?] ─ oui ─→ CONFIRMÉ
                          └ non ─→ EN ATTENTE
                                     → mail au propriétaire
                                     → ✅ J'accepte / ❌ Je refuse (un clic, sans connexion)
   → rappel la veille de la récupération
   → « je l'ai récupéré »  → EN COURS
   → rappel le jour du retour
   → « je l'ai rendu » + état → RENDU
   → si dépassement : relance à l'emprunteur, puis au propriétaire
```

**Le mail de validation est la pièce maîtresse.** La mauvaise version dit « connecte-toi
pour valider » : personne ne clique. La bonne version présente la photo de l'objet, les
dates, le message de l'emprunteur, et **deux gros boutons qui fonctionnent sans
connexion**, via un lien signé à usage unique et expirable. Un clic, une page de
confirmation, terminé. C'est la différence entre une application utilisée et une
application abandonnée.

**Validation automatique, activable par objet.** Pour l'escabeau et l'arrosoir, le rituel
demande → mail → validation est une corvée. Le propriétaire coche « réservation directe »
et l'app devient fluide, sans rien enlever au contrôle sur le matériel qui compte.

### 5.4 Les chantiers

Réserver plusieurs objets d'un coup pour un même projet. « Je refais ma terrasse le
week-end du 12 » → visseuse + ponceuse + tréteaux, une seule demande, un mail par
propriétaire, un suivi groupé.

Personne ne demande cette fonctionnalité au départ ; tout le monde en a besoin dès la
deuxième semaine. C'est ce qui transforme un catalogue en outil de vie de groupe.

### 5.5 Recherche d'objet et achat groupé

Un membre poste « cherche décolleuse à papier peint pour le 20 ». Deux issues :

- Quelqu'un possède l'objet et le propose → la demande est satisfaite.
- Personne ne l'a, mais trois membres se déclarent intéressés → **« on est 3, on l'achète
  ensemble ? »**, avec une notion de copropriété sur l'objet créé.

Pour un groupe d'amis, c'est peut-être la fonctionnalité la plus utile de tout le produit.

### 5.6 Signalements et entretien

Quand on casse le matériel d'un ami, il faut un chemin propre et sans humiliation pour le
dire : signalement avec photo et message, journal d'entretien sur la fiche, statut de
l'objet mis à jour. C'est du lubrifiant social, et ça évite précisément le genre de
non-dit qui tue ce type de projet.

## 6. Gamification

### Ce qu'on garde

**La jauge prêteur / emprunteur**, calculée en **jours-objets** et non en nombre de prêts
— sinon prêter une visseuse pour deux heures pèse autant que prêter un motoculteur pendant
deux semaines. Échelle de « Emprunteur en série 🫴 » à « Mécène du club 🛠️ », affichée sur
la carte de membre.

**Les écussons**, via un moteur générique : une règle est du code, l'écusson est une ligne
en base, on en ajoute sans toucher à la logique. Quelques exemples :

| Écusson | Condition |
|---|---|
| *Membre fondateur* | Numéro de membre ≤ 5 |
| *Quincaillier* | 10 objets mis à disposition |
| *Toujours à l'heure* | 10 retours consécutifs sans retard |
| *Tête en l'air* | 3 retards cumulés |
| *Sauveur* | Une demande acceptée en moins d'une heure |
| *Le Mécène* | Plus de 1 000 € de matériel partagé |
| *Chantier collectif* | 5 membres empruntant le même week-end |
| *Parrain* | 3 membres parrainés |

Les écussons auto-moqueurs (*Tête en l'air*) sont les plus drôles et donc les plus
efficaces. Deux ou trois écussons secrets, non listés, pour le plaisir de la découverte.

**Les économies réalisées.** « Grâce au club, tu as évité 1 240 € d'achats », et au niveau
collectif « valeur totale du club : 8 400 € ». Entièrement calculable depuis le prix déjà
présent sur chaque fiche. C'est le chiffre le plus motivant et le plus partageable de tout
le produit.

**Le CLHUB Wrapped.** Une rétrospective annuelle : l'objet le plus convoité, le mois le
plus chargé, le duo prêteur / emprunteur de l'année. Valeur d'usage nulle, valeur
d'attachement énorme.

**L'arbre du club.** La visualisation des parrainages, depuis le membre #001.

### Ce qu'on rejette explicitement

- **Les séries (streaks)** — elles poussent à emprunter sans raison pour ne pas casser un
  compteur.
- **Tout score de confiance punitif.** Entre amis, un écusson est positif ou drôle, jamais
  accusateur.
- **Les notes entre membres.** Noter ses potes sur cinq étoiles est le meilleur moyen de
  créer un malaise. Un simple « tout s'est bien passé ✅ » à la clôture suffit.
- **Un classement avec podium.** Des statistiques amusantes, oui ; une hiérarchie, non.

## 7. Non-objectifs

Décisions de périmètre assumées, à ne pas remettre en cause sans raison forte :

- **Pas de multi-groupe ni de SaaS public.** Un seul club, sur invitation. Si un second
  cercle apparaît un jour, on redéploie une instance — dix minutes de travail, contre des
  semaines à porter un système de permissions multi-locataires qui ne servira jamais.
- **Pas de gestion d'argent.** Ni caution, ni paiement, ni remboursement. On affiche une
  valeur de remplacement indicative, et c'est tout.
- **Pas d'internationalisation.** Français en dur.
- **Pas de télémétrie ni de traceurs.** Aucun.
- **Pas de grosse bibliothèque de calendrier.** Voir la justification dans
  [l'architecture](02-architecture.md).
