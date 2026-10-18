-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entries for the first UX pass (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-10-18', 'Sur téléphone, les liens et boutons sont plus faciles à toucher : menu du haut, filtres, « Modifier » et « Supprimer ».'),
('2026-10-18', 'Plus clair partout : chaque suppression demande confirmation avec des boutons qui disent ce qu''ils font (« Supprimer la recette » / « Garder la recette »), et les dates deviennent « il y a 5 min » ou « hier à 22:00 ».'),
('2026-10-18', 'Sur l''accueil, tes notifications non lues passent en premier avec un bouton « Tout marquer comme lu », et l''activité du club se replie après les 3 dernières nouvelles.');
