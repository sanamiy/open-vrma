---
license: other
license_name: cc0-1.0-and-cmu-mocap
license_link: LICENSE.md
pretty_name: open-vrma
language:
- en
- ja
tags:
- vrm
- vrma
- motion-capture
- animation
- dance
- 3d
size_categories:
- 1K<n<10K
configs:
- config_name: default
  data_files: catalog.parquet
---

# open-vrma

再配布できるモーションキャプチャ／アニメーション素材を、**どの VRM モデルにもそのまま当てられる VRM Animation（.vrma）** に変換し、検索用のタグを付けたデータセットです。ログインなしで `huggingface_hub` や `git clone` から取得でき、作品への組み込みは商用でも可能です（各素材の条件は下記）。

Freely redistributable motion data (CMU Graphics Lab Motion Capture Database and Quaternius Universal Animation Library), converted to **VRM Animation (.vrma)** so it plays on any VRM avatar, with machine-readable tags for searching.

| | 本数 | 合計時間 | ライセンス |
|---|---:|---:|---|
{{SUMMARY_ROWS}}

## 中身

```
cmu/<subject>_<trial>.vrma          CMU mocap（例 cmu/60_01.vrma = サルサ）
cmu/<subject>_<trial>.motion.json   そのモーションのメタデータ（ライセンス・タグ・拍・接地など）
quaternius/ual1/<name>.vrma         Quaternius Universal Animation Library（+ .motion.json）
quaternius/ual2/<name>.vrma         Quaternius Universal Animation Library 2（+ .motion.json）
catalog.parquet / .jsonl / .csv     1行1モーションの一覧（.motion.json から生成）
LICENSE.md                          素材ごとのライセンスとクレジット
```

各 VRMA の隣の `.motion.json` が正本のメタデータです（形式は Motion Meta 0.1。仕様は [sanamiy/open-vrma の spec/](https://github.com/sanamiy/open-vrma/tree/main/spec)）。ライセンス（SPDX の識別子・そのまま貼れるクレジット文・作者・出典）は1本ごとにここに書いてあります。

### 使い方（three-vrm）

```js
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
loader.register(parser => new VRMAnimationLoaderPlugin(parser));
const gltf = await loader.loadAsync('cmu/60_01.vrma');
const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrm);
new THREE.AnimationMixer(vrm.scene).clipAction(clip).play();
```

### 取得

```bash
hf download Sanami/open-vrma --repo-type dataset --include "catalog.parquet" # 一覧だけ
hf download Sanami/open-vrma --repo-type dataset --include "cmu/60_*.vrma"   # 必要な分だけ
```

## メタデータ（.motion.json）と一覧の列

| 項目 | 意味 |
|---|---|
| `license` | `spdx`（`CC0-1.0` / `LicenseRef-CMU-Mocap`）、`attribution`（クレジット文）、`authors`、`source`（元の素材と ID） |
| `tags.kind` | dance / idle / walk / run / jump / gesture / sit / sports / acrobatics / action / other。**元の説明文・名前のキーワードから決めた目安**（CMU の説明が "clean" "unknown" などのものは other） |
| `tags.genre` | ダンスのジャンル（salsa / charleston / modern / indian / breakdance / lambada / pop / chicken-dance / casual） |
| `tags.energy` | 1 ほぼ静止 ～ 5 全身で激しい（手足と頭の平均の速さから） |
| `tags.bodyParts` | 主に動く部位の配列（head / torso / arms / hands / hips / legs / full） |
| `tags.facing` | front / side / back / turning（主にどちらを向いているか） |
| `tags.locomotion` | in-place / stepping / traveling / spinning |
| `tags.floorWork`, `tags.airborne` | 腰を低く落とす時間が長い／両足が浮く時間が長い |
| `tags.fingers` | 指の動きを含む（Quaternius のみ） |
| `tags.rootMotion` | 腰の移動を含む（CMU は全部、Quaternius は `_RM` 付きのもの） |
| `tempo` | 動きの拍（`bpm`・`firstBeat`・`confidence`）。`basis: "steps"` は足の接地の間隔から測った歩数のテンポ、`basis: "motion"` は体の動きの周期から推定した値。`alternatives` に倍・半分の候補。曲のテンポではないので、合わせるときは候補から近いものを選ぶ。はっきりしなければ `bpm: null` |
| `loop` | 最初と最後のポーズが近いものだけ（`poseDiffDeg`、拍が分かれば `beats`）。無いものはループさせない |
| `root` | 腰の移動と向き（`netTravel` `maxTravel` は腰の高さ倍、`netTurnDeg` `turnRangeDeg`、`hipsBounce`） |
| `poses` | 最初と最後の姿勢・軸足・腕の位置（前後の動きをつなぐときに使う） |
| `retarget` | 元データの基準姿勢（T）、床合わせ済みか、目で確かめた VRM（`checkedOn`） |
| `events` / `ranges` | 足の接地・離地（`contact` / `lift`）と、足を固定してよい区間（`footLock`） |
| `x.openVrma` | タグの元になった解析値 |

一覧（catalog）の列は `id, file, name, description, duration, license, attribution` と `tags` の全項目、`bpm, tempoBasis, tempoAlternatives, tempoBand, loopable, loopBeats, hasTiming, travel, turnDeg, startPose, endPose` です。

### 精度について

タグ・拍・接地はすべて自動で付けたもので（`provenance` が `auto`）、間違いを含みます。今後、人や画像を見るモデルの確認で直していき、直した項目は `provenance` を `human` / `model` にします。

- **測った値**（接地・姿勢・移動量・向き・拍）: 54本を抜き出して VRM に当てた絵で確かめ、判定を直しました。最初と最後の姿勢は約95%が見た目どおりです。苦手なのは、つま先立ち（バレエ）、速い走りの短い着地、ボールや台など物の上に乗る動き、椅子に座った姿勢（crouch になる）です。
- **意味のタグ**（`kind` `genre`）: 元の説明文のキーワードから決めた目安です。説明の無い CMU のクリップ（約300本）は `other` です。
- `mood` `sections` `songTempo` はまだ入っていません。

## 変換について

- VRMA のレストポーズは VRM 1.0 の正規化 Tポーズ（全ボーン回転なし、+Z 向き）です。元データの Tポーズ（CMU は cgspeed 版の1コマ目、Quaternius は `A_TPose`）からの差分として各ボーンの回転を書き出しています。
- 30fps に間引いています。表情・視線のトラックはありません。
- CMU は 120fps の光学式モーキャプ（2000年代）で、手指はありません。ノイズや床の貫通が残るクリップがあります。
- 変換ツール: [sanamiy/open-vrma](https://github.com/sanamiy/open-vrma)

## ライセンスとクレジット

詳しくは [LICENSE.md](LICENSE.md) を見てください。1本ごとの条件とクレジット文は各 `.motion.json` の `license` にあります。

**Quaternius Universal Animation Library 1・2（`quaternius/`）** — CC0 1.0 Universal。クレジット不要です。Animations by Quaternius (https://quaternius.com/)。

**CMU Graphics Lab Motion Capture Database（`cmu/`）** — CMU の FAQ によると、このデータは許可なく複製・改変・再配布でき、商用製品に含めることもできます。データそのものを（変換した形でも）販売することはできません。また全件をクロールしないよう求められているので、CMU のサイトではなくこのデータセットか GitHub のミラーから取得してください。作品には次の謝辞を入れてください。

> The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

BVH 変換は Bruce Hahne による cgspeed の Motionbuilder-friendly 版（2010）で、変換者は追加の制限を設けていません。取得元は GitHub のミラー [Shriinivas/cmubvh](https://github.com/Shriinivas/cmubvh) です。

このデータセットの変換・タグ付けの部分は CC0 として提供します。
