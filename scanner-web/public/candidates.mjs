// Shared by the scanner and the local diagnostic page; no automatic selection.
export function renderCandidates(container, ranking, { visual = false, ambiguous = false, onSelect } = {}) {
  const rows = ranking.map(({ reference }, index) => {
    const row = document.createElement('article'); row.className = 'candidate';
    const image = document.createElement('img'); image.src = reference.url; image.alt = reference.card.name;
    const details = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = `${index + 1}. ${reference.card.name}`;
    const identity = document.createElement('p'); identity.textContent = `${reference.card.setCode} · N° ${reference.card.number} · ${reference.card.language}`;
    const verify = document.createElement('button'); verify.type = 'button'; verify.className = 'secondary';
    verify.textContent = 'C’est ma carte';
    verify.addEventListener('click', () => onSelect?.(reference.card.id));
    details.append(title, identity, verify); row.append(image, details); return row;
  });
  if (visual && rows.length) {
    rows[0].className += ' candidate-primary';
    const alternatives = document.createElement('details'); alternatives.className = 'candidate-alternatives';
    const summary = document.createElement('summary'); summary.textContent = `Autres correspondances (${rows.length - 1})`;
    alternatives.open = Boolean(ambiguous);
    alternatives.append(summary, ...rows.slice(1));
    container.replaceChildren(rows[0], ...(rows.length > 1 ? [alternatives] : []));
  } else container.replaceChildren(...rows);
}
