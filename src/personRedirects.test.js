import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';


const toml = readFileSync(fileURLToPath(new URL('../netlify.toml', import.meta.url)), 'utf8');
const bundle = JSON.parse(readFileSync(fileURLToPath(new URL('./generated/liveBundle.json', import.meta.url)), 'utf8'));
const re = /\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "([^"]+)"\s*status = (\d+)/g;
const all = [...toml.matchAll(re)].map(([, from, to, status]) => ({ from, to, status: Number(status) }));
const person = all.filter((r) => r.from.startsWith('/person/'));
const ids = new Set(bundle.SPEAKERS.map((s) => s.id));

describe('legacy /person redirects', () => {
  it('has the 11 CBS + 18 finance redirects, all 301', () => {
    assert.equal(person.length, 29);
    for (const r of person) assert.equal(r.status, 301);
  });
  it('every target is a speaker in the bundle', () => {
    for (const r of person) assert.ok(ids.has(r.to.replace('/person/', '')), r.to);
  });
  it('no source collides with a current speaker id, and sources are unique', () => {
    const src = person.map((r) => r.from.replace('/person/', ''));
    for (const s of src) assert.ok(!ids.has(s), s);
    assert.equal(new Set(src).size, src.length);
  });
  it('person redirects sit above the SPA fallback', () => {
    const fb = all.findIndex((r) => r.from === '/*');
    assert.equal(fb, all.length - 1);
  });
});

describe('published speaker ids never disappear without a redirect', () => {
  const known = JSON.parse(readFileSync(fileURLToPath(new URL('./knownSpeakerIds.json', import.meta.url)), 'utf8')).ids;
  const sources = new Set(person.map((r) => r.from.replace('/person/', '')));
  it('every known id is a current speaker or a redirect source', () => {
    const missing = known.filter((id) => !ids.has(id) && !sources.has(id));
    assert.deepEqual(missing, []);
  });
  it('every current speaker id is in the committed known list', () => {
    const k = new Set(known);
    assert.deepEqual([...ids].filter((id) => !k.has(id)), []);
  });
});
