# 📝 Quiz App

GitHubで問題データを管理し、S3+CloudFrontでPC・スマホどこでも使えるクイズアプリ。

## 構成

```
GitHub (コード・データ管理)
    ↓ mainにpushで自動デプロイ
GitHub Actions (ビルド・デプロイ)
    ↓
S3 + CloudFront (ホスティング)
    ↓
ブラウザURL → PC・スマホ対応
```

## 問題データの管理

`public/data/questions.json` を編集して追加・修正します。

```json
{
  "questions": [
    {
      "id": 1,
      "question": "問題文",
      "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correct_answer": "選択肢A",
      "explanation": "解説文"
    }
  ]
}
```

編集後に `git push` するだけで自動で反映されます。

## AWSセットアップ手順

### 1. S3バケットを作成
- バケット名を決める（例: my-quiz-app）
- パブリックアクセスをブロック（CloudFront経由でアクセスするため）

### 2. CloudFrontディストリビューションを作成
- オリジン: 上で作ったS3バケット
- デフォルトルートオブジェクト: index.html
- エラーページ設定: 404 → /index.html

### 3. IAMユーザーを作成
GitHub Actionsがデプロイに使うユーザー。以下のポリシーをアタッチ:
- s3:PutObject, s3:DeleteObject, s3:ListBucket（バケット対象）
- cloudfront:CreateInvalidation

### 4. GitHubにSecretsを登録
リポジトリの Settings → Secrets → Actions に以下を追加:

| シークレット名 | 値 |
|---|---|
| AWS_ACCESS_KEY_ID | IAMユーザーのアクセスキー |
| AWS_SECRET_ACCESS_KEY | IAMユーザーのシークレットキー |
| S3_BUCKET_NAME | S3バケット名 |
| CLOUDFRONT_DISTRIBUTION_ID | CloudFrontのディストリビューションID |

### 5. mainにpushして完了

GitHub Actionsが自動でビルド・デプロイします。

## ローカル開発

```bash
npm install
npm run dev
# → http://localhost:5173 で確認
```
