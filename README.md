# omomuki

日本の美意識に基づいて「趣（おもむき）」を見出すアプリ

## 開発

```bash
pnpm install
pnpm dev
open http://localhost:3000
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `API_KEY` | さくらのクラウド AI API キー |

## デプロイ

### Docker ビルド

```bash
docker build -t omomuki .
docker run --rm -p 3000:3000 -e API_KEY=your_key omomuki
```

### さくらのクラウドへのデプロイ

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集

terraform init
terraform plan
terraform apply
```

レジストリへのプッシュ:

```bash
docker tag omomuki <your-registry>.sakuracr.jp/app:latest
docker login <your-registry>.sakuracr.jp
docker push <your-registry>.sakuracr.jp/app:latest
```
