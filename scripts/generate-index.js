// ビルド時に public/data/ のJSONファイル一覧を自動生成するスクリプト
import { readdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../public/data");

// public/data/ 以下の .json ファイルを取得（index.json自身は除く）
const files = readdirSync(dataDir)
  .filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "questions.json")
  .map((f) => f.replace(".json", ""))
  .sort();

const indexPath = join(dataDir, "index.json");
writeFileSync(indexPath, JSON.stringify(files, null, 2));

console.log(`生成完了: ${files.length}件`);
console.log(files);
