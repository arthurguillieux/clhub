-- Custom SQL migration file, put your code below! --
-- "Nouveautés" entry for « Ma lettre au Père Noël » (see 0029 for why entries go through migrations).
INSERT INTO "changelog_entry" ("entry_date", "summary") VALUES
('2026-11-15', 'Jeux : « 💌 Ma lettre au Père Noël ». La liste de Noël d''un enfant pour toute la famille : sa photo et quelques lignes écrites avec lui, puis ses cadeaux, avec une photo, un lien d''exemple et un prix indicatif, que tu peux remplir en collant le lien d''un magasin. Un seul lien à envoyer : la famille ouvre l''enveloppe, réserve ce qu''elle offre ou participe à une cagnotte pour un gros cadeau, et tu reçois une notification à chaque fois. Après Noël, le merci de l''enfant ; l''année suivante, « Dupliquer » reprend les cadeaux que personne n''a offerts.');
