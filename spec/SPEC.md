# Motion Meta 0.1 仕様書（案）

VRMA（VRM Animation）1本に添えるメタデータの形式です。データセット・ツールのリポジトリ `open-vrma`（Hugging Face と GitHub の sanamiy/open-vrma）で使います。人型の動きだけを扱い、人型以外の生き物の動きは別のリポジトリで扱います。動きの「種類・ライセンス」「拍とループ点」「プロシージャルにどういじってよいか」「時間ごとの印」を、どのツールでも読めるJSONで持ちます。

- 状態：案（2026-10-28）。サナミさんの確認後に 0.1 として確定します。
- 機械向けの定義：[`motion-meta.schema.json`](motion-meta.schema.json)（JSON Schema 2020-12）
- 検証：`node validate.mjs <file>`（Schema に加えて、時刻の範囲・順序・区間の重なりを確かめる）
- 例：[`examples/salsa-basic.motion.json`](examples/salsa-basic.motion.json)（全部入り）、[`examples/minimal.motion.json`](examples/minimal.motion.json)（必須だけ）

この文書で「しなければならない」「してはならない」は必須、「するとよい」は推奨を表します。

---

## 1. ファイルの置き方

### 1.1 サイドカー（正本）

VRMA と同じフォルダに、拡張子だけ変えて置きます。

```
cmu/60_01.vrma
cmu/60_01.motion.json
```

- 文字コードは UTF-8、改行は LF。
- データセットではサイドカーが**正本**です。タグやタイミングの直しはサイドカーだけを書き換えます（VRMA を作り直さなくてよい）。

### 1.2 VRMA への埋め込み（持ち運び用の写し）

1ファイルで配りたいときは、同じ中身を VRMA（glTF）の該当アニメーションの `extras` に入れます。

```json
{ "animations": [ { "...": "...", "extras": { "motionMeta": { "specVersion": "0.1", "id": "cmu_60_01", "...": "..." } } } ] }
```

- 置き場所は `animations[i].extras.motionMeta`。`i` はメタデータの `animation`（省略時 0）と一致させます。
- glTF の拡張（`extensions` と `extensionsUsed`）は使いません。登録された拡張名を持たないまま `extensions` に入れるのは glTF の決まりに反するためです。使われるようになったら、`VRMC_` 系とは別の名前で拡張として提案する道を残します（§9）。
- **読む側の優先順位**：サイドカーがあればサイドカーを使い、埋め込みは無視します。サイドカーが無ければ埋め込みを使います。両方を混ぜてはなりません。

### 1.3 一覧（catalog）

データセットの `catalog.jsonl` / `catalog.csv` は、サイドカーから**生成するもの**です。手で直してはなりません。列は `id`, `file`, `duration`, `license.spdx`, `tags.*`, `tempo.bpm` のほか、計算で出す次の列を持ちます。

| 列 | 計算 |
|---|---|
| `loopable` | `loop` があれば true |
| `tempoBand` | `bpm` < 90 → slow、90〜120 → mid、> 120 → fast、null なら空 |
| `hasTiming` | `events` か `ranges` が1つ以上あれば true |
| `loopBeats` | `loop.beats` |
| `travel`, `turnDeg` | `root.netTravel`, `root.netTurnDeg` |
| `startPose`, `endPose` | `poses.start`, `poses.end` |

一覧は「どの動きを使うか」を選ぶための表なので、`tags` のすべてと、上の列を必ず入れます。

---

## 2. 共通の決まり

### 2.1 時刻と単位

- **時刻はすべて秒**（小数）で、そのアニメーションの**最初のキーフレームを 0** とします。
- フレーム番号は使いません（元データの fps が混ざると変換で狂うため）。拍の位置も保存しません（テンポから計算できるため、§4.1）。
- 時刻は `0 ≤ t ≤ duration` でなければなりません。
- 長さはメートル、角度は度。座標は VRM 1.0 と同じ（Y が上、キャラは +Z を向く）。`left` / `right` は**キャラ自身から見た**左右です。

### 2.2 名前

- `id`・`genre` などの識別子は小文字英数字と `_ . -`（正規表現 `^[a-z0-9][a-z0-9_.-]*$`）。
- フィールド名は lowerCamelCase。

### 2.3 拡張とバージョン

- `specVersion` は `"0.1"` の形（`"0.1.2"` のような修正番号も可）。
- **知らないフィールドは無視しなければなりません。** 知らない `type` の event・range も無視します。これにより、新しい項目を足しても古いツールが壊れません。
- ツール独自の種類は `x-` で始めます（例：`"type": "x-mvmaker-flash"`）。ツール独自のまとまった情報は `x` の下に、ツール名をキーにして置きます（例：`"x": { "mvMaker": { ... } }`）。
- 版の上げ方：
  - **修正番号**（0.1.0 → 0.1.1）：説明の明確化、Schema のバグ修正。
  - **小番号**（0.1 → 0.2）：任意のフィールドや列挙値の追加。0.1 の読み手は 0.2 のファイルを（知らない部分を無視して）読めなければならない。
  - **大番号**（0.x → 1.0）：意味の変更や削除。1.0 を出すときに 0.x からの変換スクリプトを用意する。

### 2.4 自動推定と人の確認

各まとまりが自動推定か人が確かめたかを `provenance` に書きます。

```json
"provenance": { "tags": "auto", "tempo": "auto", "events": "auto", "ranges": "human" }
```

値は `auto`（計算で出した）、`model`（AIが動画や静止画を見て判断した）、`human`（人が確かめた）のどれか。書かれていないまとまりは `auto` とみなします。サイトでは「確認済み」バッジや絞り込みに使います。

---

## 3. 基本情報・ライセンス・タグ

### 3.1 基本情報

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `specVersion` | string | ○ | `"0.1"` |
| `id` | slug | ○ | データセットの中で一意。例 `cmu_60_01` |
| `duration` | 秒 | ○ | アニメーションの長さ |
| `animation` | int | | VRMA 内の何番目のアニメーションか。省略時 0 |
| `name` | string | | 表示名 |
| `description` | string | | 説明 |
| `sourceFps` | number | | 元データのfps（参考） |

### 3.2 ライセンス `license`（必須）

| フィールド | 型 | 必須 | 意味 |
|---|---|---|---|
| `spdx` | string | ○ | `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC-BY-NC-4.0`, または `LicenseRef-…`（例 `LicenseRef-CMU-Mocap`） |
| `attribution` | string | ○ | そのまま貼れるクレジット文。CC0 でも書く（礼儀として表示するため） |
| `url` | uri | | ライセンス本文や条件のページ |
| `authors` | `[{name, url?}]` | | 作者 |
| `source.kind` | enum | | 元の動きの作り方：`keyframe`（手付け）/ `mocap`（モーションキャプチャ）/ `video-estimate`（動画からのAI推定）/ `generated`（生成）/ `mixed`。他の形式から変換したかどうかは `originalFormat` と `converter` で表す（CMU は `mocap` + `bvh`、Quaternius は `keyframe` + `glb`） |
| `source.url`, `originalId`, `originalFormat`, `converter` | | | 元素材の場所・元のID・元の形式・変換に使ったツールと版 |
| `performerConsent` | bool | | モーキャプの演者の同意があるか（投稿受付を始めたら `mocap` で必須にする） |

サイトの初期公開で受け付けるのは `CC0-1.0`, `CC-BY-4.0` と、再配布が認められた `LicenseRef-*`（CMU）だけです。`SA` と `NC` は形式としては書けますが、当面は掲載しません。

### 3.3 タグ `tags`

CMU・Quaternius の一覧（open-vrma）と、mv-maker の Mixamo カタログ（`assets/mixamo/catalog.schema.json`）の両方の語彙をまとめたものです。MV を作るときに「どの動きを使うか」を選ぶための情報はここに集めます。

| フィールド | 値 | 意味 |
|---|---|---|
| `kind` | `dance` `idle` `walk` `run` `jump` `sit` `gesture` `acrobatics` `sports` `action` `other` | 種類（1つ） |
| `genre` | slug の配列 | ダンスのジャンルなど。推奨値：`hiphop` `house` `pop` `disco` `retro` `latin` `salsa` `charleston` `ballroom` `social` `jazz` `modern` `belly` `breaking` `indian` `novelty` `casual` |
| `energy` | 1〜5 | 動きの大きさ（1 ほぼ静止 〜 5 全身で激しい） |
| `bodyParts` | `head` `torso` `arms` `hands` `hips` `legs` `full` の配列 | 主に動く部位 |
| `locomotion` | `in-place` `stepping` `traveling` `spinning` | その場か、移動するか |
| `facing` | `front` `side` `back` `turning` | 主にどちらを向いているか |
| `mood` | `cool` `cute` `funny` `sexy` `elegant` `energetic` `chill` `festive` `dramatic` `retro` `triumphant` `sad` `calm` の配列 | 雰囲気 |
| `sections` | `intro` `verse` `pre-chorus` `chorus` `interlude` `bridge` `outro` の配列 | MV のどの区間に向くか |
| `songTempo` | `slow` `mid` `fast` の配列 | 合う曲のテンポ帯（倍速・半速も含めて人が判断したもの。動き自体のテンポは `tempo.bpm`） |
| `floorWork` / `airborne` | bool | 床に近い動きがあるか / 両足が浮く時間があるか |
| `fingers` / `expressions` / `lookAt` | bool | 指・表情・視線のデータを含むか |
| `rootMotion` | bool | 腰の水平移動がデータに入っているか（Mixamo の In Place を外した状態なら true） |
| `keywords` | string の配列 | 自由な検索語（日本語可） |

BPM はタグではなく `tempo.bpm` に書きます。

---

## 4. タイミング

### 4.1 テンポ `tempo`

| フィールド | 型 | 既定 | 意味 |
|---|---|---|---|
| `bpm` | number / null | （必須） | 作ったときのテンポ。拍に乗らない動きは `null` |
| `basis` | `authored` `music` `steps` `motion` | | `bpm` の根拠。`authored`：作者が指定 / `music`：元の曲から / `steps`：足の接地の間隔から（CMU など曲の無いデータ） / `motion`：動き全体の強弱の周期から |
| `alternatives` | number の配列 | | 倍・半分など、同じくらいもっともらしいテンポの候補。読む側は `bpm` と同じ扱いで曲に合わせてよい |
| `beatsPerBar` | int | 4 | 1小節の拍数 |
| `firstBeat` | 秒 | 0 | 最初の拍の時刻 |
| `firstBarBeat` | int | 1 | `firstBeat` が小節の何拍目か（弱起の動き用） |
| `beats` | 秒の配列 | | テンポが揺れる動きだけ、拍の時刻をすべて書く。あれば `bpm` より優先 |
| `confidence` | 0〜1 | | 自動推定の確からしさ |

拍の位置（何拍目か。小数）は次で計算します。

- `beats` があるとき：`beats` を区間ごとに直線でつないだときの位置（`beats[k]` が `k`）。範囲外は両端の間隔で延長。
- ないとき：`beat(t) = (t − firstBeat) × bpm ÷ 60`
- 小節頭：`beat + (firstBarBeat − 1)` が `beatsPerBar` の倍数になる拍。

### 4.2 ループ `loop`

| フィールド | 型 | 既定 | 意味 |
|---|---|---|---|
| `in`, `out` | 秒 | （必須） | ループする区間。`in < out` |
| `beats` | int | | 1ループが何拍か。拍に合わせて伸び縮みするときの基準になる。`bpm` があれば `(out − in) × bpm ÷ 60` と 0.25 拍以内で一致しなければならない |
| `mode` | `cycle` / `pingpong` | `cycle` | 繰り返し方 |
| `blend` | 秒 | 0 | つなぎ目で混ぜる長さ。ループ長の半分以下 |
| `poseDiffDeg` | 度 | | `in` と `out` の姿勢の差（骨の平均）。小さいほどつなぎ目が目立たない |

`loop` が無い動きは、ループさせてはなりません（1回だけ再生）。

### 4.6 移動と向き `root`（自動で計算）

| フィールド | 単位 | 意味 |
|---|---|---|
| `netTravel` | 腰の高さ倍 | 最初から最後までの水平移動。体格によらない比で持つ |
| `maxTravel` | 腰の高さ倍 | 最初の位置から最も離れたときの距離 |
| `netTurnDeg` | 度 | 最初から最後までの向きの変化。大きいとループのたびに向きが飛ぶ |
| `turnRangeDeg` | 度 | 向きの振れ幅 |
| `hipsBounce` | 腰の高さ倍 | 腰の上下の振れ幅 |

### 4.7 始まりと終わりの姿勢 `poses`

前後の動きとつなげるときに、似た姿勢どうしを選ぶための情報です。

| フィールド | 値 | 意味 |
|---|---|---|
| `start` / `end` | `stand` `crouch` `kneel` `sit` `lie` `floor` `air` | 最初と最後の姿勢 |
| `startSupport` / `endSupport` | `both` `left` `right` `none` | どちらの足で立っているか |
| `startArms` / `endArms` | `down` `front` `up` `wide` `hips` `other` | 腕の位置 |

### 4.8 当てはめの情報 `retarget`

| フィールド | 値 | 意味 |
|---|---|---|
| `restPose` | `T` `A` `other` | 元データの基準姿勢 |
| `sourceHipHeight` | m | 元データの腰の高さ（参考） |
| `floorAligned` | bool | 変換時に足の最低点を床（高さ 0）に合わせたか。合わせていなければ読む側で合わせる |
| `checkedOn` | string の配列 | 崩れないことを目で確かめたVRM（例 `vrm1-sample` `maru` `oomofu`）。頭が大きい・脚が短いキャラで使えるかの目安 |

### 4.3 イベント `events`（瞬間の印）

`t` の昇順に並べなければなりません。

| `type` | 必須の追加フィールド | 意味 | 似た既存の仕組み |
|---|---|---|---|
| `contact` | `side` | 足（`limb` で手・膝も）が床に着いた瞬間 | UE Sync Marker |
| `lift` | `side` | 床から離れた瞬間 | UE Sync Marker |
| `hit` | | 決め・アクセント。曲の強拍に寄せる点。`hold` 秒だけ止まる | UE AnimNotify |
| `apex` | | ジャンプの頂点など、動きの山 | |
| `cue` | `name` | 自由な名前の印（`clap` `stomp` `wink` など） | Unity AnimationEvent、Live2D UserData |

共通の任意フィールド：`name`（表示名）、`strength`（0〜1、強さ）、`limb`（`foot` 既定 / `hand` / `knee`）。

### 4.4 区間 `ranges`（時間の幅がある印）

| `type` | 必須の追加フィールド | 意味 | 似た既存の仕組み |
|---|---|---|---|
| `footLock` | `side` | この間は足をIKで固定（`target` 既定 `floor`）。伸び縮みや体格差で足がすべらない | UE のIKカーブ、Unity Foot IK |
| `handIK` | `side`, `target` | 手を体の部位（`hips` `chest` `head` `otherHand`）や `world` に合わせる | UE Anim Curves |
| `noStretch` | | この間は伸び縮みさせない（決めの静止、ジャンプの滞空） | |
| `interruptible` | | この間なら別の動きに切り替えてよい。区間が1つも無ければ、どこでも切り替えてよい | UE Pose Search の区間指定、Montage の分岐点 |
| `phrase` | `name` | 振りのまとまり（A・B など）。切り出して並べ替える単位。任意で `energy`（1〜5）を書くと、静かな区間と盛り上がる区間で使い分けられる | |

- `from < to`。
- 同じ `type`（と `side`）の区間は重なってはなりません。`phrase` は重なってもよい。

### 4.5 カーブ `curves`（任意）

区間の効き具合を 0〜1 で滑らかに変えたいときだけ使います。キーは `footLock.left` `footLock.right` `handIK.left` `handIK.right` `noStretch` `interruptible` か `x-…`。値は `[時刻, 強さ]` の配列で、時刻の昇順、間は直線補間、範囲外は端の値。カーブがある種類はカーブが区間より優先し、無ければ区間の内側が 1、外側が 0 です。

---

## 5. 操作の許可 `allow`

クリップ全体について、プロシージャルにどこまでいじってよいかを書きます。書いていない項目は既定値です。

| フィールド | 値 | 既定 | 意味 |
|---|---|---|---|
| `stretch.mode` | `none` / `uniform` / `beats` | `uniform` | `none`：速さを変えない。`uniform`：全体を一定の倍率で。`beats`：拍ごとに曲の拍へ合わせる（`tempo` 必須） |
| `stretch.minRate`, `maxRate` | number | 0.8 / 1.25 | 再生速度の許容範囲。`minRate ≤ 1 ≤ maxRate` |
| `stretch.allowHalfDouble` | bool | true | 範囲を超えるとき、倍速・半速に切り替えてよいか |
| `mirror` | bool | true | 左右反転してよいか。文字を書く・利き手に意味がある動きは false |
| `lookAt` | `keep` / `blend` / `override` | `override` | 視線をカメラ目線などで上書きしてよいか |
| `expression` | 同上 | `override` | 表情を上書きしてよいか |
| `additive` | bool | false | 他の動きに足し合わせで重ねてよいか（うなずき、息づかいなど） |
| `retimeRoot` | bool | true | 伸び縮みに合わせて移動量も変えてよいか（false なら移動距離を保つ） |
| `parts` | 部位 → `keep` / `replaceable` | すべて `replaceable` | その部位を別の動きで差し替えてよいか |

### 5.1 部位

部位は VRM 1.0 の人型の骨で決めます。

| 部位 | 骨 |
|---|---|
| `head` | neck, head, leftEye, rightEye, jaw |
| `torso` | spine, chest, upperChest |
| `leftArm` / `rightArm` | shoulder, upperArm, lowerArm, hand |
| `leftFingers` / `rightFingers` | 各指の骨 |
| `leftLeg` / `rightLeg` | upperLeg, lowerLeg, foot, toes |
| `upperBody` | head + torso + 両腕 + 両手の指 |
| `lowerBody` | hips + 両脚 |

`upperBody` と個別の部位が両方書かれているときは、個別の部位が優先します。`hips` は `lowerBody` にだけ含まれます。

---

## 6. 読む側（mv-maker など）の振る舞い

1. サイドカー → 埋め込みの順に探し、`specVersion` の大番号が知っているものか確かめる。知らない大番号なら読まずに警告する。
2. `stretch.mode` が `beats` なら、クリップの拍 `k` を曲の拍時刻へ対応させる区分線形の時間写像を作る。`noStretch` の区間は元の速さのまま置き、前後の区間で吸収する。速度が `minRate〜maxRate` を外れるなら、`allowHalfDouble` に従って倍・半に切り替えるか、配置を諦めて警告する。
3. `hit` は最も近い小節頭（なければ強いオンセット）へ寄せる。
4. `footLock` の間は足の位置を固定するIKを、`curves` があればその強さでかける。
5. 他の動きとの切り替えは `interruptible` の中で、`loop.blend` か既定 0.2 秒で混ぜる。
6. `parts` が `replaceable` の部位だけ、別のクリップや組み込みの動きで上書きする。

---

### 6.1 動きを選ぶ

MV の区間ごとに動きを選ぶときは、一覧を次の順に絞ります。

1. `license.spdx`（作る動画の使い道に合うもの）
2. `tags.sections` に区間名を含む、`tags.energy` が区間の盛り上がりに近い
3. 曲の BPM が `tempo.bpm` × {0.5, 1, 2} × `allow.stretch` の範囲に入る（`tags.songTempo` は人の判断として補助に使う）
4. `tags.genre`・`tags.mood` が曲の雰囲気に合う
5. カメラが正面なら `tags.facing` が `front`、ステージが狭いなら `locomotion` が `in-place` か `root.maxTravel` が小さい
6. 何小節も続けるなら `loop` があり `loop.poseDiffDeg` と `root.netTurnDeg` が小さい
7. 前の動きの `poses.end` と次の動きの `poses.start` が同じ

### 6.2 Mixamo カタログからの移し替え

mv-maker の `assets/mixamo/catalog.json` の各項目は、次のように Motion Meta にそのまま移せます。

| Mixamo カタログ | Motion Meta |
|---|---|
| `tags.genre` `energy` `locomotion` `facing` `sections` `mood` `bodyParts` | `tags.*`（同じ名前） |
| `tags.tempoBand`（合う曲のテンポ） | `tags.songTempo` |
| `tags.loopable` | `loop` の有無 |
| `tagSource`: `guess` / `reviewed` | `provenance.tags`: `auto` / `human` |
| `analysis.bpm` `beatClarity` | `tempo.bpm` `tempo.confidence` |
| `analysis.phase` `barPhase` | `tempo.firstBeat` と `firstBarBeat` |
| `analysis.beats` | `loop.beats` |
| `analysis.loopDeg` | `loop.poseDiffDeg` |
| `analysis.travel` `yawNet` `yawRange` `hipsBounce` | `root.*`（腰の高さ倍に直す） |
| `download.inPlace` | `tags.rootMotion: false` |

Mixamo の動きは再配布できないので、公開するデータセットには入れません。手元のカタログを同じ形式で持つためだけに使います。

## 7. 書く側（変換ツール・投稿画面）の振る舞い

- 変換時に `tags`、`tempo`（自動推定と `confidence`）、`loop`（最初と最後のポーズ差から。`beats` と `poseDiffDeg` も）、`root`、`poses`、`retarget`、`contact` / `lift` と `footLock`（つま先・かかとの高さと速さから）を下書きし、`provenance` を `auto` にする。
- 人が投稿画面で直したまとまりは `human` にする。
- 出力前に `validate.mjs` を通し、通らないものはデータセットに入れない。

---

## 8. 既存の仕組みとの対応

| この仕様 | Unreal | Unity | その他 |
|---|---|---|---|
| `events` (`contact`/`lift`) | Sync Marker | — | — |
| `events` (`hit`/`cue`) | AnimNotify | AnimationEvent | Live2D motion3.json の UserData、Spine の Event |
| `ranges` | AnimNotifyState | — | — |
| `curves` | Anim Curves | アニメーションのカーブ | — |
| `allow.parts` | Layered blend per bone、Montage Slot | Avatar Mask | — |
| `allow.mirror` | Mirror Data Table | 取り込み設定の Mirror | — |
| `loop` | ループ設定 | Loop Time / Loop Pose | — |
| `tags.rootMotion` | Root Motion | Root Transform の設定 | Mixamo の In Place |
| `interruptible` | Pose Search の区間指定 | — | Motion Matching のタグ |

Unity・Unreal に書き出すツールを作るときは、この表で変換します。

---

## 9. 今回決めなかったこと

- glTF 拡張として正式に名前を取るか（使われ始めてから）。
- 表情・視線だけのイベント（まばたき・目線の切り替え）を細かく持つか。今は `cue` で代用する。
- 2人以上の動き（ペアダンス）の同期。
- 小道具（マイク・扇子など）を持つ動きの扱い。
- 投稿受付時の `performerConsent` 必須化と、AI学習への利用可否の欄。
