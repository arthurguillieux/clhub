-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry for the Buzzer. Entries reach production only through a
-- migration like this one: the prod database isn't reachable from a dev
-- machine, so `pnpm changelog:add` only ever fills the local database.
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-10-18', 'Nouveau jeu : le Buzzer ! Lance une partie, tout le monde scanne le QR code (même sans compte CLHUB) et son téléphone devient un buzzer pour vos quizz et blindtests.');
