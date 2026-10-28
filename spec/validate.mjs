// motion-meta の検証: JSON Schema と、Schema では書けない時刻の決まりを確かめる
// node validate.mjs file.motion.json [...]   （0件なら終了コード0）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(here, 'motion-meta.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const EPS = 1e-6;
export function check(m) {
  const errs = [];
  if (!validateSchema(m)) for (const e of validateSchema.errors) errs.push(`${e.instancePath || '/'} ${e.message}`);
  if (errs.length) return errs;
  const D = m.duration;
  const inClip = (t, where) => { if (t > D + EPS) errs.push(`${where}: ${t} が duration ${D} を超えている`); };
  const { tempo, loop, allow, events = [], ranges = [], curves = {} } = m;
  if (tempo) {
    if (tempo.firstBeat != null) inClip(tempo.firstBeat, '/tempo/firstBeat');
    if (tempo.beats) tempo.beats.forEach((t, i) => { inClip(t, `/tempo/beats/${i}`); if (i && t <= tempo.beats[i - 1]) errs.push(`/tempo/beats/${i}: 時刻が増えていない`); });
    if (tempo.bpm == null && tempo.beats == null && allow?.stretch?.mode === 'beats') errs.push('/allow/stretch: bpm も beats も無いのに mode が beats');
    if ((tempo.firstBarBeat ?? 1) > (tempo.beatsPerBar ?? 4)) errs.push('/tempo/firstBarBeat が beatsPerBar を超えている');
  } else if (allow?.stretch?.mode === 'beats') errs.push('/allow/stretch: tempo が無いのに mode が beats');
  if (loop && loop.beats != null && tempo?.bpm) { const b = (loop.out - loop.in) * tempo.bpm / 60; if (Math.abs(b - loop.beats) > 0.25) errs.push(`/loop/beats: ${loop.beats} 拍と書かれているが、bpm から計算すると ${b.toFixed(2)} 拍`); }
  if (loop) { inClip(loop.out, '/loop/out'); if (loop.out <= loop.in) errs.push('/loop: out が in 以下'); if ((loop.blend ?? 0) > (loop.out - loop.in) / 2) errs.push('/loop/blend がループ長の半分を超えている'); }
  const s = allow?.stretch; if (s && s.minRate > s.maxRate) errs.push('/allow/stretch: minRate > maxRate');
  if (s && s.mode !== 'none' && (s.minRate ?? 0.8) > 1) errs.push('/allow/stretch: minRate は 1 以下にする');
  if (s && s.mode !== 'none' && (s.maxRate ?? 1.25) < 1) errs.push('/allow/stretch: maxRate は 1 以上にする');
  events.forEach((e, i) => { inClip(e.t + (e.hold ?? 0), `/events/${i}`); if (i && e.t < events[i - 1].t) errs.push(`/events/${i}: t の昇順になっていない`); });
  ranges.forEach((r, i) => { inClip(r.to, `/ranges/${i}/to`); if (r.to <= r.from) errs.push(`/ranges/${i}: to が from 以下`); });
  const byKey = {};
  for (const r of ranges) { const k = r.type + (r.side ? '.' + r.side : ''); (byKey[k] ??= []).push(r); }
  for (const [k, list] of Object.entries(byKey)) { if (k === 'phrase' || k.startsWith('x-')) continue; list.sort((a, b) => a.from - b.from); for (let i = 1; i < list.length; i++) if (list[i].from < list[i - 1].to - EPS) errs.push(`/ranges: ${k} の区間が重なっている（${list[i - 1].from}-${list[i - 1].to} と ${list[i].from}-${list[i].to}）`); }
  for (const [k, pts] of Object.entries(curves)) pts.forEach(([t], i) => { inClip(t, `/curves/${k}/${i}`); if (i && t <= pts[i - 1][0]) errs.push(`/curves/${k}/${i}: 時刻が増えていない`); });
  return errs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = 0;
  for (const f of process.argv.slice(2)) {
    const errs = check(JSON.parse(fs.readFileSync(f, 'utf8')));
    console.log(errs.length ? `NG ${f}\n  ${errs.join('\n  ')}` : `OK ${f}`);
    if (errs.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
