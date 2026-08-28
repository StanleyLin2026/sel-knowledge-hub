#!/usr/bin/env python3
"""Export SEL resources to an Obsidian-compatible folder.

The generated portion of each resource card is replaceable. Content beneath
"## 個人筆記" is preserved across syncs so users can annotate cards safely.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


SITE_URL = "https://stanleylin2026.github.io/sel-knowledge-hub/"
FIREBASE_PROJECT_ID = "seldatabase20260827"
FIREBASE_API_KEY = "AIzaSyCZnsJu3bC0slZ0_KLAeWx3j413dyHNU9U"
SYNC_MARKER = "<!-- SEL-SYNC:GENERATED -->"
PERSONAL_HEADING = "## 個人筆記"


def load_resources(source: Path) -> list[dict]:
    raw = source.read_text(encoding="utf-8").strip()
    raw = re.sub(r"^window\.SEL_RESOURCES\s*=\s*", "", raw)
    raw = re.sub(r";\s*$", "", raw)
    raw = re.sub(r'([\{,]\s*)([A-Za-z][A-Za-z0-9_]*)\s*:', r'\1"\2":', raw)
    return json.loads(raw)


def decode_firestore_value(value: dict):
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return value["doubleValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "timestampValue" in value:
        return value["timestampValue"]
    if "nullValue" in value:
        return None
    if "arrayValue" in value:
        return [decode_firestore_value(item) for item in value["arrayValue"].get("values", [])]
    if "mapValue" in value:
        return decode_firestore_fields(value["mapValue"].get("fields", {}))
    return None


def decode_firestore_fields(fields: dict) -> dict:
    return {key: decode_firestore_value(value) for key, value in fields.items()}


def load_firestore_resources(project_id: str, api_key: str) -> list[dict]:
    endpoint = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:runQuery?key={api_key}"
    query = {
        "structuredQuery": {
            "from": [{"collectionId": "resources"}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "status"},
                    "op": "EQUAL",
                    "value": {"stringValue": "published"},
                }
            },
        }
    }
    request = Request(endpoint, data=json.dumps(query).encode(), headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        rows = json.load(response)
    resources = [decode_firestore_fields(row["document"].get("fields", {})) for row in rows if "document" in row]
    return sorted(resources, key=lambda item: item.get("id", ""))


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def yaml_list(values: list[str]) -> str:
    return "[" + ", ".join(yaml_string(value) for value in values) + "]"


def safe_filename(value: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "-", value).strip().rstrip(".")


def resource_filename(item: dict) -> str:
    return f"{item['id']} {safe_filename(item['title'])}.md"


def personal_section(existing: str) -> str:
    if PERSONAL_HEADING not in existing:
        return f"{PERSONAL_HEADING}\n\n- "
    return PERSONAL_HEADING + existing.split(PERSONAL_HEADING, 1)[1]


def card_content(item: dict, existing: str = "") -> str:
    direct_url = f"{SITE_URL}?resource={quote(item['id'])}"
    frontmatter = "\n".join(
        [
            "---",
            f"id: {yaml_string(item['id'])}",
            f"title: {yaml_string(item['title'])}",
            f"type: {yaml_string(item['type'])}",
            f"stages: {yaml_list(item['stages'])}",
            f"sel_dimensions: {yaml_list(item['dimensions'])}",
            f"evidence: {yaml_string(item['evidence'])}",
            f"updated: {yaml_string(item['date'])}",
            f"rights: {yaml_string(item['rights'])}",
            f"source_url: {yaml_string(direct_url)}",
            f"tags: {yaml_list(['SEL資料庫', item['type'], *item['tags']])}",
            "sync_source: github/StanleyLin2026/sel-knowledge-hub",
            "---",
        ]
    )
    dimensions = "、".join(f"[[SEL-能力-{name}|{name}]]" for name in item["dimensions"])
    stages = "、".join(item["stages"])
    tags = " ".join(f"#{tag.replace(' ', '-') }" for tag in item["tags"])
    generated = f"""{frontmatter}

{SYNC_MARKER}

# {item['id']} {item['title']}

{item['summary']}

## 關聯

- 資料類型：[[SEL-資料類型-{item['type']}|{item['type']}]]
- SEL 能力：{dimensions}
- 適用階段：{stages}
- 證據／審查狀態：{item['evidence']}
- 標籤：{tags}

## 來源與版本

{item['source']}

- 權利狀態：{item['rights']}
- 最後更新：{item['date']}
- 線上資料：[{item['id']}]({direct_url})
- 資料庫入口：[[00-SEL資料庫入口]]

"""
    return generated + personal_section(existing).rstrip() + "\n"


def write_if_changed(path: Path, content: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def build_index(resources: list[dict]) -> str:
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in resources:
        groups[item["type"]].append(item)
    sections = []
    for resource_type in sorted(groups):
        links = "\n".join(
            f"- [[Resources/{resource_filename(item)[:-3]}|{item['id']} {item['title']}]]"
            for item in sorted(groups[resource_type], key=lambda x: x["id"])
        )
        sections.append(f"## {resource_type}\n\n{links}")
    return f"""---
title: SEL 資料庫入口
tags: [SEL資料庫, MOC]
updated: 2026-08-27
---

# SEL 資料庫入口

社會情緒學習（Social and Emotional Learning, SEL）資料庫係指以 SEL 能力架構為核心，整合課程、教學、評量、研究與政策資料的知識平臺。本資料夾以一卡一概念的方式保存資源，並透過共同欄位與雙向連結，進一步支持教學設計、教師增能及研究寫作。

> [!info] 線上入口
> - [開啟 SEL 知識樞紐]({SITE_URL})
> - [GitHub 原始碼](https://github.com/StanleyLin2026/sel-knowledge-hub)
> - [[01-SEL資料庫同步說明]]

## SEL 能力索引

""" + "\n".join(f"- [[SEL-能力-{name}|{name}]]" for name in sorted({d for r in resources for d in r["dimensions"]})) + "\n\n" + "\n\n".join(sections) + "\n"


def build_dimension(name: str, resources: list[dict]) -> str:
    links = "\n".join(
        f"- [[Resources/{resource_filename(item)[:-3]}|{item['id']} {item['title']}]]"
        for item in resources if name in item["dimensions"]
    )
    return f"""---
title: SEL 能力—{name}
tags: [SEL資料庫, SEL能力]
---

# SEL 能力—{name}

本頁彙整資料庫中與「{name}」相關的資源，以作為跨教案、評量、課綱與研究證據的共同索引。

{links}

返回：[[00-SEL資料庫入口]]
"""


def build_type_index(name: str, resources: list[dict]) -> str:
    links = "\n".join(
        f"- [[Resources/{resource_filename(item)[:-3]}|{item['id']} {item['title']}]]"
        for item in resources if name == item["type"]
    )
    return f"""---
title: SEL 資料類型—{name}
tags: [SEL資料庫, 資料類型]
---

# SEL 資料類型—{name}

{links}

返回：[[00-SEL資料庫入口]]
"""


def build_sync_guide(folder: str) -> str:
    return f"""---
title: SEL 資料庫同步說明
tags: [SEL資料庫, 使用說明]
---

# SEL 資料庫同步說明

本資料夾由 GitHub 的 SEL 知識樞紐產生。同步工具會更新資源卡的 YAML properties、摘要、關聯、來源與版本；每張卡片中 `## 個人筆記` 以下的內容會保留，可持續補充文獻摘記、研究問題與交叉參照。

## 同步方式

在 `sel-knowledge-hub` 專案目錄執行：

```bash
python3 tools/sync_to_obsidian.py --vault "/path/to/your/vault" --folder "{folder}" --firestore
```

## 使用原則

1. 正式資料由 Firebase 後台發布後，再以 `--firestore` 執行同步；只有離線開發時才改用 `data/resources.js`。
2. 個人的聯想、文獻補充或研究疑問，請寫在各卡的「個人筆記」區。
3. 正式引用前須回到原始文獻、課綱或工具來源完成查核。

返回：[[00-SEL資料庫入口]]
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True, type=Path, help="Obsidian vault root")
    parser.add_argument("--folder", default="SEL-Database", help="Target folder relative to vault")
    parser.add_argument("--source", type=Path, help="Path to resources.js")
    parser.add_argument("--firestore", action="store_true", help="Load published resources from Cloud Firestore")
    parser.add_argument("--project-id", default=FIREBASE_PROJECT_ID, help="Firebase project ID")
    parser.add_argument("--api-key", default=FIREBASE_API_KEY, help="Firebase Web API key")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    source = args.source or project_root / "data" / "resources.js"
    destination = (args.vault.expanduser().resolve() / args.folder).resolve()
    vault = args.vault.expanduser().resolve()
    if vault not in destination.parents:
        raise SystemExit("Target folder must be inside the selected vault")

    resources = load_firestore_resources(args.project_id, args.api_key) if args.firestore else load_resources(source)
    source_label = f"firestore://{args.project_id}/resources?status=published" if args.firestore else str(source)
    changed = 0
    for item in resources:
        path = destination / "Resources" / resource_filename(item)
        existing = path.read_text(encoding="utf-8") if path.exists() else ""
        changed += write_if_changed(path, card_content(item, existing))

    changed += write_if_changed(destination / "00-SEL資料庫入口.md", build_index(resources))
    changed += write_if_changed(destination / "01-SEL資料庫同步說明.md", build_sync_guide(args.folder))
    for dimension in sorted({d for item in resources for d in item["dimensions"]}):
        changed += write_if_changed(destination / f"SEL-能力-{dimension}.md", build_dimension(dimension, resources))
    for resource_type in sorted({item["type"] for item in resources}):
        changed += write_if_changed(destination / f"SEL-資料類型-{resource_type}.md", build_type_index(resource_type, resources))

    manifest = {
        "source": source_label,
        "destination": str(destination),
        "resource_count": len(resources),
        "generated_files": sorted(str(path.relative_to(destination)) for path in destination.rglob("*.md")),
    }
    changed += write_if_changed(destination / ".sel-sync-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"SEL Obsidian sync complete: {len(resources)} resources, {changed} files changed")


if __name__ == "__main__":
    main()
