import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCandidates } from '../public/candidates.mjs';

test('visual alternatives stay selectable; ambiguous matches are expanded and manual results stay visible', () => {
  const previous = globalThis.document;
  const element = () => ({ children: [], className: '', append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; }, addEventListener(_, handler) { this.click = handler; } });
  globalThis.document = { createElement: element };
  try {
    const ranking = ['a', 'b', 'c'].map(id => ({ reference: { url: `/${id}`, card: { id, name: id, language: 'FR', number: id, setCode: 'test' } } }));
    const container = element(); let selected;
    for (const ambiguous of [false, true]) {
      renderCandidates(container, ranking, { visual: true, ambiguous, onSelect: id => { selected = id; } });
      assert.equal(container.children.length, 2);
      assert.equal(container.children[1].open, ambiguous);
      assert.equal(container.children[1].children.length, 3, 'summary plus both alternatives, none discarded');
      container.children[1].children[2].children[1].children[2].click();
      assert.equal(selected, 'c');
    }
    renderCandidates(container, ranking);
    assert.equal(container.children.length, 3, 'legacy manual presentation is unchanged');
    renderCandidates(container, ranking.slice(0, 1), { visual: true });
    assert.equal(container.children.length, 1, 'no empty alternatives control');
  } finally { globalThis.document = previous; }
});
