# open-vrma

再配布できる人型のモーション素材を、どの VRM にもそのまま当てられる VRM Animation（.vrma）に変換し、1本ごとのメタデータ（`.motion.json`）と検索用の一覧を作るツールです。

できあがったデータセットは Hugging Face で配布します。このリポジトリには、ツールとデータセットカードの元だけを置きます。データ本体は置きません。人型ではない生き物のモーションは、別のリポジトリで扱います。

## 元にする素材

| 素材 | 本数 | ライセンス |
|---|---:|---|
| [CMU Graphics Lab Motion Capture Database](http://mocap.cs.cmu.edu/)（cgspeed 2010 年版 BVH の [GitHub ミラー](https://github.com/Shriinivas/cmubvh)） | 2,503 | 複製・改変・再配布可、データ単体の販売は不可、謝辞の記載を依頼（[FAQ](http://mocap.cs.cmu.edu/faqs.php)） |
| [Quaternius Universal Animation Library 1・2](https://quaternius.com/packs/universalanimationlibrary.html)（Standard 版） | 87 | CC0 1.0 |

## 使い方

```bash
npm install
bash tools/build.sh work 4        # 作業フォルダ, 並列数
# MOTION_META_VALIDATOR=path/to/validate.mjs を付けると、Motion Meta の検証に通らないものを除外する
```

`work/dataset/` に `cmu/` と `quaternius/` ができます。中身は `.vrma` と `.motion.json` のペアです。ほかに `catalog.jsonl` と `catalog.csv` もできます。Hugging Face に上げるときは、`dataset-card.md` を `README.md` に、`LICENSE.dataset.md` を `LICENSE.md` にして一緒に置きます。

| ファイル | 役割 |
|---|---|
| `tools/build.sh` | 元データの取得、変換、メタデータと一覧づくり、16bit 化までをまとめて行う |
| `tools/cmu2vrma.mjs` | CMU の BVH 1本を VRMA と解析値にする |
| `tools/quaternius2vrma.mjs` | Quaternius の GLB（全モーション入り）を、モーションごとの VRMA と解析値にする |
| `tools/vrma.mjs` | VRM 正規化ボーンの回転列を VRMA（glTF + `VRMC_vrm_animation`）に書き出す |
| `tools/analyze.mjs` | 移動・向き・部位ごとの動き・拍・接地・始まりと終わりの姿勢などの解析値を出す |
| `tools/metadata.mjs` | 解析値と元素材の情報から、`.motion.json`（Motion Meta 0.1）と一覧を作る |
| `tools/quantize.mjs` | 回転を 16bit 整数にして容量を約半分にする（見た目はほぼ変わらない） |

## 変換のしかた

VRMA のレストポーズは、VRM 1.0 の正規化 Tポーズ（全ボーン回転なし、+Z 向き）です。元データの Tポーズからの差分を、各ボーンの回転として書き出しています。元データの Tポーズは、CMU が cgspeed 版の1コマ目、Quaternius が `A_TPose` です。30fps に間引いています。three-vrm-animation の `createVRMAnimationClip` で、そのまま再生できます。

## ライセンス

ツールのコードは [MIT License](LICENSE) です。データセットのライセンスは [LICENSE.dataset.md](LICENSE.dataset.md) にあり、モーションごとの条件は各 `.motion.json` の `license` に書いてあります。
