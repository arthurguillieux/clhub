/** « de Paul », but « d'Arthur » and « d'Émilie ». */
export const de = (name: string) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`);
