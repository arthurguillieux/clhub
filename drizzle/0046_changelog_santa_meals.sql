-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry for the meals of the Secret Santa (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-11-13', 'Secret Santa : « 🍽️ Qu''est-ce qu''on mange ? ». Quand vous êtes réunis plusieurs jours, l''organisation active les repas dans les réglages, même après le tirage. Chacun dit quand il est là, ses régimes et allergies, ce qu''il apporte à chaque repas et à boire, et tout le monde voit ce qui manque.');
