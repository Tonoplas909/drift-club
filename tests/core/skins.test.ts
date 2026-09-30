import { describe, it, expect } from 'vitest';
import { SKINS, SKIN_DEFAUT, skinChoisie, skinDef, choisirSkin, validerSkins, resoudreTeinte, accentSkin, couleurEffective } from '../../src/core/skins';
import { RARETES, RARETE_IDS } from '../../src/core/raretes';
import { CAR_IDS } from '../../src/core/physics/cars';

describe('données des livrées', () => {
  it('au moins 28 livrées par voiture, « unie » en premier, ids uniques, noms et descriptions non vides', () => {
    for (const car of CAR_IDS) {
      const l = SKINS[car];
      expect(l.length).toBeGreaterThanOrEqual(28);
      expect(l[0].id).toBe('unie');
      expect(l[0].elements).toEqual([]);
      expect(new Set(l.map((s) => s.id)).size).toBe(l.length);
      for (const s of l) {
        expect(s.nom.trim().length).toBeGreaterThan(0);
        expect(s.description.trim().length).toBeGreaterThan(10);
      }
    }
  });
  it('les nouvelles voitures ont chacune une trentaine de livrées, de la commune à la légendaire, et 1 à 2 exotiques', () => {
    for (const car of ['kei', 'muscle', 'rotative', 'break'] as const) {
      expect(SKINS[car].length).toBeGreaterThanOrEqual(31);
      const n = (r: string) => SKINS[car].filter((s) => s.id !== 'unie' && s.rarete === r).length;
      expect(n('legendaire')).toBeGreaterThanOrEqual(3);
      expect(n('exotique')).toBeGreaterThanOrEqual(1);
      expect(n('exotique')).toBeLessThanOrEqual(2);
    }
  });
  it('pyramide des raretés : au moins 8 communes (hors unie), au plus 3 exotiques, plus de communes que de rares', () => {
    for (const car of CAR_IDS) {
      const n = (r: string) => SKINS[car].filter((s) => s.id !== 'unie' && s.rarete === r).length;
      expect(n('commune')).toBeGreaterThanOrEqual(8);
      expect(n('exotique')).toBeLessThanOrEqual(3);
      expect(n('exotique')).toBeGreaterThanOrEqual(1);
      expect(n('commune')).toBeGreaterThan(n('rare'));
      expect(n('rare')).toBeGreaterThan(n('epique'));
    }
  });
  it('hommages exotiques : couleurs imposées, sans marque ni titre écrit', () => {
    const ids = ['dixsec', 'bleunitro', 'maitredrift', 'famille'];
    for (const id of ids) {
      const trouve = CAR_IDS.flatMap((c) => SKINS[c]).filter((s) => s.id === id);
      expect(trouve.length).toBeGreaterThan(0);
      for (const s of trouve) { expect(s.rarete).toBe('exotique'); expect(s.couleurForcee).toBeDefined(); }
    }
    const interdits = /toyota|nissan|mazda|ford|dodge|fast|furious|skyline|supra|rx-?7|charger|brian|dominic|toretto/i;
    for (const s of CAR_IDS.flatMap((c) => SKINS[c])) expect(`${s.nom} ${s.description}`).not.toMatch(interdits);
  });
  it('les livrées non forcées à pastille : accent défini pour tous les types d\'éléments', () => {
    for (const car of CAR_IDS) for (const s of SKINS[car]) expect(accentSkin(s, '#3a6ff0')).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('chaque livrée non unie a au moins un élément', () => {
    for (const car of CAR_IDS) for (const s of SKINS[car].slice(1)) expect(s.elements.length).toBeGreaterThan(0);
  });
});

describe('raretés des livrées', () => {
  it('chaque livrée a une rareté connue ; « unie » est commune', () => {
    for (const car of CAR_IDS) {
      for (const s of SKINS[car]) expect(RARETE_IDS).toContain(s.rarete);
      expect(SKINS[car][0].rarete).toBe('commune');
    }
  });
  it('chaque rareté a au moins une livrée (hors « unie ») et les livrées sont rangées par rareté croissante', () => {
    for (const r of RARETE_IDS) expect(CAR_IDS.flatMap((c) => SKINS[c]).filter((s) => s.id !== SKIN_DEFAUT && s.rarete === r).length).toBeGreaterThan(0);
    for (const car of CAR_IDS) {
      const rangs = SKINS[car].map((s) => RARETE_IDS.indexOf(s.rarete));
      expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
    }
  });
  it('couleur forcée : #rrggbb valide, jamais sur « unie » ; la couleur effective l\'emporte sur la couleur choisie', () => {
    for (const car of CAR_IDS) for (const s of SKINS[car]) if (s.couleurForcee) {
      expect(s.couleurForcee).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.id).not.toBe(SKIN_DEFAUT);
      expect(couleurEffective(s, '#3a6ff0')).toBe(s.couleurForcee);
    }
    expect(couleurEffective(SKINS.turbo[0], '#3a6ff0')).toBe('#3a6ff0');
    expect(SKINS.equilibree.find((s) => s.id === 'or')!.couleurForcee).toBeDefined();
  });
  it('les teintes dérivées et la pastille d\'une livrée forcée partent de la couleur imposée', () => {
    const noiror = SKINS.equilibree.find((s) => s.id === 'noiror')!;
    expect(accentSkin(noiror, '#ffffff')).toBe('#d9a21b');
    const or = SKINS.equilibree.find((s) => s.id === 'or')!;
    expect(accentSkin(or, '#000000')).toBe(resoudreTeinte('clair', or.couleurForcee!));
  });
  it('palette de raretés : couleurs distinctes', () => {
    expect(new Set(RARETE_IDS.map((r) => RARETES[r].couleur)).size).toBe(RARETE_IDS.length);
  });
});

describe('teintes', () => {
  it('contraste : clair sur fond sombre, sombre sur fond clair', () => {
    expect(resoudreTeinte('contraste', '#3a6ff0')).toBe('#f4f1e8');
    expect(resoudreTeinte('contraste', '#f2f2ee')).toBe('#1d1d24');
  });
  it('principale, sombre, clair, fixe', () => {
    expect(resoudreTeinte('principale', '#e63b2e')).toBe('#e63b2e');
    expect(resoudreTeinte('#123456', '#e63b2e')).toBe('#123456');
    expect(resoudreTeinte('sombre', '#ffffff')).toBe('#595959');
    expect(resoudreTeinte('clair', '#000000')).toBe('#999999');
  });
  it('accent : couleur principale pour « unie »', () => {
    expect(accentSkin(SKINS.turbo[0], '#3a6ff0')).toBe('#3a6ff0');
    expect(accentSkin(SKINS.turbo[1], '#3a6ff0')).toBe('#f4f1e8');
  });
});

describe('choix par voiture', () => {
  it('skinChoisie : défaut, valide, inconnu', () => {
    expect(skinChoisie(undefined, 'turbo')).toBe(SKIN_DEFAUT);
    expect(skinChoisie({}, 'turbo')).toBe(SKIN_DEFAUT);
    expect(skinChoisie({ turbo: 'rayures' }, 'turbo')).toBe('rayures');
    expect(skinChoisie({ turbo: 'inconnue' }, 'turbo')).toBe(SKIN_DEFAUT);
    expect(skinChoisie({ turbo: 'bande' }, 'turbo')).toBe(SKIN_DEFAUT); // « bande » n'existe que pour la Légère
  });
  it('choisirSkin : mémorisé par voiture, sans toucher aux autres', () => {
    let s = choisirSkin({}, 'legere', 'bande');
    s = choisirSkin(s, 'turbo', 'carbone');
    expect(s).toEqual({ legere: 'bande', turbo: 'carbone' });
    expect(skinChoisie(s, 'equilibree')).toBe('unie');
    expect(choisirSkin(s, 'legere', 'nimporte')).toEqual({ legere: 'unie', turbo: 'carbone' });
  });
  it('skinDef retombe sur « unie »', () => {
    expect(skinDef('legere', 'bande').id).toBe('bande');
    expect(skinDef('legere', 'zzz').id).toBe('unie');
    expect(skinDef('legere', undefined).id).toBe('unie');
  });
  it('validerSkins : nettoie une valeur du stockage', () => {
    expect(validerSkins(undefined)).toEqual({});
    expect(validerSkins([1])).toEqual({});
    expect(validerSkins({ turbo: 'carbone', legere: 'nope', velo: 'x' })).toEqual({ turbo: 'carbone', legere: 'unie' });
  });
});
