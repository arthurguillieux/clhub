-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entries: the Killer opens to every member (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-10-25', 'Nouveau jeu dans Jeux : le Killer. Tu prépares la liste des agents et la mission de chacun, l''arène s''affiche sur la TV, chacun rejoint en scannant le QR code et prend sa photo, et tu valides les éliminations depuis ton téléphone — compte à rebours, coup de canon et classement final compris.'),
('2026-10-25', 'Killer : un mot de passe de co-organisation permet à d''autres membres d''organiser la partie avec toi ; une fois terminée, archive-la pour garder le vainqueur, le classement et toutes les éliminations, et télécharge toutes les photos des joueurs d''un coup pour les leur envoyer.');
