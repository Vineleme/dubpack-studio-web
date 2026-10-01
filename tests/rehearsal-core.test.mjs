import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript, compareSpeech, textLinesFromItems } from '../rehearsal-core.mjs';

test('imports scenes across pages, excluding cast credits and stage directions', () => {
  const scenes = parseScript([
    'PERSONAGENS\nHarry Potter: Vinicius\nCENA 1 — A SELEÇÃO\n(Um foco se acende.)\nCHAPÉU: Onde colocar você?\nHARRY: (baixo, para si) Sonserina, não.\nSonserina, não.\n3',
    '(Harry olha para\nRony e Hermione.)\nHARRY: Prefiro outro caminho.\nCENA 2 — A AULA\nMcGONAGALL: Hoje vamos praticar.\nTODOS: Sim!'
  ]);
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].lines.length, 3);
  assert.equal(scenes[0].lines[1].text, 'Sonserina, não. Sonserina, não.');
  assert.equal(scenes[0].lines[1].directions, 'baixo, para si');
  assert.equal(scenes[0].lines[2].directions, 'Harry olha para Rony e Hermione.');
  assert.equal(scenes[1].lines[0].character, 'MCGONAGALL');
});

test('partial phrase or silence never concludes an actor turn', () => {
  assert.equal(compareSpeech('Então precisamos avisar alguém antes que seja tarde.', '').complete, false);
  assert.equal(compareSpeech('Então precisamos avisar alguém antes que seja tarde.', 'então precisamos avisar alguém').complete, false);
  assert.equal(compareSpeech('Sonserina, não. Sonserina, não.', 'sonserina não').complete, false);
});

test('completion needs ordered coverage and the closing words', () => {
  assert.equal(compareSpeech('Então precisamos avisar alguém antes que seja tarde.', 'Então precisamos avisar alguém antes que seja tarde').complete, true);
  assert.equal(compareSpeech('Então precisamos avisar alguém antes que seja tarde.', 'tarde seja que antes alguém avisar precisamos então').complete, false);
  assert.equal(compareSpeech('Ele não vai ficar com a Pedra.', 'ele vai ficar com a pedra').complete, false);
  assert.equal(compareSpeech('Não.', 'sim').complete, false);
  assert.equal(compareSpeech('Não.', 'não').complete, true);
  assert.equal(compareSpeech('Eu não vou entregar esta pedra para você porque meus amigos precisam de mim.', 'eu vou entregar esta pedra para você porque meus amigos precisam de mim').complete, false);
});

test('ignores accents and punctuation and highlights ordered words', () => {
  const result = compareSpeech('É você quem está tentando roubar a Pedra.', 'e voce quem esta tentando roubar a pedra');
  assert.equal(result.complete, true);
  assert.equal(result.matched.length, 8);
});

test('reconstructs PDF rows by position instead of joining every item as a paragraph', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  assert.equal(textLinesFromItems([item('HARRY:', 20, 100), item('Não.', 85, 100), item('RONY: Sim.', 20, 80)]), 'HARRY: Não.\nRONY: Sim.');
});
