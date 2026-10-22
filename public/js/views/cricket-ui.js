// Cricket-Tabelle (Marks/Scores) als Panel.

import { CRICKET_NUMBERS } from '/js/core/cricket.js';
import { el } from '/js/util.js';

const label = n => n === 25 ? 'Bull' : String(n);

export function cricketMarksTable(st) {
  const rows = CRICKET_NUMBERS.map(n => {
    const cells = st.players.map((p, i) => {
      const m = st.marks[i][n];
      const sym = m >= 3 ? 'X' : m === 2 ? 'X' : m === 1 ? '/' : '';
      const closedAll = st.players.every((_, j) => st.marks[j][n] >= 3);
      const mine = st.marks[i][n] >= 3;
      return el('td', {
        style: `text-align:center;font-weight:800;color:${closedAll ? '#5b6a61' : mine ? '#46c47a' : '#eaf0ea'}`
      }, sym || '·');
    });
    return el('tr', {},
      el('td', { style: 'font-weight:800;color:#e8dfc8' }, label(n)),
      ...cells
    );
  });
  const head = el('tr', {},
    el('th', {}, 'Zahl'),
    ...st.players.map(p => el('th', { style: 'text-align:center' }, p.name))
  );
  const scoreRow = el('tr', {},
    el('td', { style: 'font-weight:800;color:#e8dfc8' }, 'Punkte'),
    ...st.players.map((p, i) => el('td', {
      class: 'num',
      style: `text-align:center;font-weight:800;font-size:19px;${st.current === i ? 'color:#46c47a' : ''}`
    }, String(st.points[i])))
  );
  return el('div', { class: 'panel' },
    el('h2', {}, 'Board', el('span', { class: 'sub' }, 'am Zug: ' + st.players[st.current].name)),
    el('table', { class: 'rank-table' }, el('thead', {}, head), el('tbody', {}, ...rows, scoreRow))
  );
}
