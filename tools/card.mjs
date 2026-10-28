// dataset-card.md の {{SUMMARY_ROWS}} を一覧の集計で埋めて、データセットの README.md を書く
// node card.mjs <dataset-card.md> <datasetDir>
import fs from 'node:fs';
import path from 'node:path';

const [,, cardPath, DIR] = process.argv;
const rows = fs.readFileSync(path.join(DIR, 'catalog.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const GROUPS = [
  ['CMU Graphics Lab Motion Capture Database（`cmu/`）', r => r.file.startsWith('cmu/'), '`LicenseRef-CMU-Mocap`（再配布可・販売不可・謝辞）'],
  ['Quaternius Universal Animation Library（`quaternius/ual1/`）', r => r.file.startsWith('quaternius/ual1/'), '`CC0-1.0`'],
  ['Quaternius Universal Animation Library 2（`quaternius/ual2/`）', r => r.file.startsWith('quaternius/ual2/'), '`CC0-1.0`'],
];
const hours = rs => { const sec = rs.reduce((s, r) => s + r.duration, 0); return sec >= 3600 ? (sec / 3600).toFixed(1) + ' 時間' : Math.round(sec / 60) + ' 分'; };
const lines = GROUPS.map(([name, f, lic]) => { const rs = rows.filter(f); return `| ${name} | ${rs.length.toLocaleString('en')} | ${hours(rs)} | ${lic} |`; });
lines.push(`| **合計** | **${rows.length.toLocaleString('en')}** | **${hours(rows)}** | |`);
fs.writeFileSync(path.join(DIR, 'README.md'), fs.readFileSync(cardPath, 'utf8').replace('{{SUMMARY_ROWS}}', lines.join('\n')));
console.log('README.md', rows.length, 'motions');
