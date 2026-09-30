import { describe, it, expect } from 'vitest';
import { camDepuisUrl } from '../../src/debug/camLibre';

describe('camDepuisUrl', () => {
  it('lit ?cam=x,y,z,tx,ty,tz seulement sous ?debug', () => {
    expect(camDepuisUrl('?debug&cam=1,2,3,4,5,6')).toEqual({ pos: [1, 2, 3], cible: [4, 5, 6] });
    expect(camDepuisUrl('?cam=1,2,3,4,5,6')).toBeNull();
  });
  it('ignore les valeurs mal formées', () => {
    expect(camDepuisUrl('?debug')).toBeNull();
    expect(camDepuisUrl('?debug&cam=1,2,3')).toBeNull();
    expect(camDepuisUrl('?debug&cam=1,2,3,4,5,x')).toBeNull();
  });
});
