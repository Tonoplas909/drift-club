import { describe, it, expect } from 'vitest';
import {
  MOTIFS, LIMITES_ATELIER, validerLivree, validerElement, nettoyerTexte, idAtelier, defAtelier, lireLivreeOfficielle, versLigneOfficielle, PREFIXE_ATELIER,
} from '../../src/core/atelier';
import { SKINS, ajouterLivreesAtelier, skinValide, skinDef } from '../../src/core/skins';
import { contenuCaisses, objetsDeRarete } from '../../src/core/caisses';

const base = { voiture: 'turbo', nom: 'Ma livrée', description: 'Rapide et jolie.', elements: [{ type: 'toit', teinte: 'contraste' }] };

describe('Atelier : validation des livrées proposées', () => {
  it('chaque motif par défaut est valide et ressort identique', () => {
    for (const m of MOTIFS) {
      const v = validerElement(m.defaut);
      expect(v.ok, m.type).toBe(true);
      expect(v.ok && v.element).toEqual(m.defaut);
    }
  });
  it('livrée complète : nettoyée (réglages inconnus retirés, nombres bornés et arrondis)', () => {
    const v = validerLivree({ ...base, couleurForcee: '#ABCDEF', elements: [
      { type: 'bandes', teinte: '#ff0000', largeur: 5, ecart: -1, pirate: '<script>' },
      { type: 'numero', chiffres: '42', fond: 'clair', encre: '#000000', pos: 0.512 },
    ] });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.livree.couleurForcee).toBe('#abcdef');
    expect(v.livree.elements[0]).toEqual({ type: 'bandes', teinte: '#ff0000', largeur: 0.3, ecart: 0 });
    expect(v.livree.elements[1]).toEqual({ type: 'numero', chiffres: '42', fond: 'clair', encre: '#000000', pos: 0.52 });
  });
  it('refus : voiture, motif, couleur, chiffres, nombre de motifs, textes', () => {
    const refus = (o: object) => expect(validerLivree({ ...base, ...o }).ok, JSON.stringify(o).slice(0, 60)).toBe(false);
    refus({ voiture: 'fusee' });
    refus({ elements: [] });
    refus({ elements: [{ type: 'logo', image: 'x' }] });
    refus({ elements: [{ type: 'toit', teinte: 'rouge' }] });
    refus({ elements: [{ type: 'numero', chiffres: '12a', fond: 'clair', encre: 'sombre' }] });
    refus({ elements: Array.from({ length: LIMITES_ATELIER.elementsMax + 1 }, () => ({ type: 'toit', teinte: 'sombre' })) });
    refus({ couleurForcee: 'red' });
    refus({ nom: '' });
    refus({ nom: 'x'.repeat(LIMITES_ATELIER.nomMax + 1) });
    refus({ description: '<img src=x onerror=alert(1)>' });
    refus({ nom: null });
  });
  it('textes : caractères de contrôle et invisibles retirés, espaces normalisés', () => {
    expect(nettoyerTexte('  Bleu​   nuit‮ ', 24)).toBe('Bleu nuit');
    expect(nettoyerTexte('Été 1999 — « Drift » !', 30)).toBe('Été 1999 — « Drift » !');
    expect(nettoyerTexte('a<b>', 30)).toBeNull();
    expect(nettoyerTexte('', 30)).toBeNull();
  });
});

describe('Atelier : livrées validées dans le catalogue', () => {
  const ligne = { id: '1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516', voiture: 'kei', nom: 'Néon', description: 'Pour la nuit.', rarete: 'epique', pseudo: 'Mati',
    donnees: { elements: [{ type: 'grille', teinte: '#28e6ff', pas: 0.13, epaisseur: 0.012 }] } };
  it('identifiant, créateur cité, ligne invalide ignorée', () => {
    expect(idAtelier(ligne.id)).toBe(`${PREFIXE_ATELIER}1b2c3d4e5f60`);
    const o = lireLivreeOfficielle(ligne)!;
    expect(defAtelier(o)).toMatchObject({ id: 'atelier-1b2c3d4e5f60', nom: 'Néon', rarete: 'epique', description: 'Pour la nuit. (création de Mati)' });
    expect(lireLivreeOfficielle({ ...ligne, rarete: 'mythique' })).toBeNull();
    expect(lireLivreeOfficielle({ ...ligne, donnees: { elements: [{ type: 'virus' }] } })).toBeNull();
  });
  it('ajoutées aux livrées de la voiture et aux caisses ; un nouvel appel remplace les précédentes', () => {
    const avant = SKINS.kei.length;
    const def = defAtelier(lireLivreeOfficielle(ligne)!);
    ajouterLivreesAtelier([{ voiture: 'kei', def }]);
    expect(SKINS.kei.length).toBe(avant + 1);
    expect(skinValide('kei', def.id)).toBe(true);
    expect(skinDef('kei', def.id).nom).toBe('Néon');
    expect(contenuCaisses().kei.some((s) => s.id === def.id && s.rarete === 'epique')).toBe(true);
    // le tirage local (joueur sans compte) et les roulettes la connaissent aussi
    expect(objetsDeRarete('epique').some((o) => o.car === 'kei' && o.skin === def.id)).toBe(true);
    ajouterLivreesAtelier([]);
    expect(objetsDeRarete('epique').some((o) => o.skin === def.id)).toBe(false);
    expect(SKINS.kei.length).toBe(avant);
    expect(skinValide('kei', def.id)).toBe(false);
  });
});

describe('Atelier : livrées gardées sur l\'appareil', () => {
  it('versLigneOfficielle puis lireLivreeOfficielle redonne la même livrée', () => {
    const ligne = { id: '1b2c3d4e-5f60-4718-9a0b-c1d2e3f40516', voiture: 'rotative', nom: 'Or', description: 'Brille.', rarete: 'legendaire', pseudo: 'Mati',
      donnees: { couleurForcee: '#d4af37', elements: [{ type: 'numero', chiffres: '7', fond: '#f4f1e8', encre: 'sombre', pos: 0.3 }] } };
    const o = lireLivreeOfficielle(ligne)!;
    expect(o).not.toBeNull();
    expect(lireLivreeOfficielle(versLigneOfficielle(o))).toEqual(o);
  });
});
