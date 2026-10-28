# catalog.jsonl から catalog.parquet を作る（Hugging Face の表示と検索用）。pyarrow が要る
# python3 catalog_parquet.py <catalog.jsonl> <catalog.parquet>
import json, sys
import pyarrow as pa, pyarrow.parquet as pq

rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
cols = list(dict.fromkeys(k for r in rows for k in r))
LISTS = {k for k in cols if any(isinstance(r.get(k), list) for r in rows)}
def typ(k):
    vals = [r[k] for r in rows if r.get(k) is not None]
    if k in LISTS:
        inner = [x for v in vals for x in v]
        return pa.list_(pa.float64() if inner and all(isinstance(x, (int, float)) for x in inner) else pa.string())
    if vals and all(isinstance(v, bool) for v in vals): return pa.bool_()
    if vals and all(isinstance(v, int) and not isinstance(v, bool) for v in vals): return pa.int64()
    if vals and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vals): return pa.float64()
    return pa.string()
schema = pa.schema([(k, typ(k)) for k in cols])
table = pa.Table.from_pylist([{k: r.get(k, [] if k in LISTS else None) for k in cols} for r in rows], schema=schema)
pq.write_table(table, sys.argv[2], compression='zstd')
print(f'{sys.argv[2]}: {table.num_rows} 行 {table.num_columns} 列')
