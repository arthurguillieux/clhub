-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry for the Secret Santa (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-11-05', 'Nouveau dans Jeux : le Secret Santa. Invite des membres du club ou n''importe qui par mail, ajoute tes règles (« ces deux-là ne se tirent pas »), et le CLHUB fait le tirage. Chacun reçoit un lien perso pour ouvrir son cadeau, écrire sa lettre au Père Noël et poser des questions anonymes. Personne ne voit le résultat, et l''année suivante se relance en un clic, sans refaire le même tirage.');
