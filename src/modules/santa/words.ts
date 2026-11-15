const elides = (word: string) => /^[aeiouyhàâäéèêëîïôöùûü]/i.test(word);

/** « de Paul », but « d'Arthur » and « d'Émilie ». */
export const de = (name: string) => (elides(name) ? `d'${name}` : `de ${name}`);

/** « que Paul », but « qu'Arthur ». */
export const que = (name: string) => (elides(name) ? `qu'${name}` : `que ${name}`);
