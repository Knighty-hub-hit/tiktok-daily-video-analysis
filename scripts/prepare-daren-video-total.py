#!/usr/bin/env python3
import csv
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def usage():
    raise SystemExit(
        "Usage: python3 scripts/prepare-daren-video-total.py <input.xlsx> "
        "[output.csv] [state.json] [--write-state]"
    )


def clean_cell(value):
    return re.sub(r"[\t\r\n]+", " ", str(value or "")).strip()


def excel_col_index(cell_ref):
    match = re.match(r"([A-Z]+)", cell_ref or "")
    if not match:
        return None

    index = 0
    for char in match.group(1):
        index = index * 26 + ord(char) - ord("A") + 1
    return index - 1


def excel_serial_to_date(value):
    try:
        serial = float(value)
    except (TypeError, ValueError):
        return ""

    # Excel's 1900-date-system serials map cleanly with this origin for xlsx exports.
    return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()


def normalize_date(value):
    text = clean_cell(value)
    if not text:
        return ""

    if re.fullmatch(r"\d+(\.\d+)?", text):
        return excel_serial_to_date(text)

    match = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

    short_match = re.search(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})", text)
    if short_match:
        year = 2000 + int(short_match.group(3))
        return f"{year}-{int(short_match.group(1)):02d}-{int(short_match.group(2)):02d}"

    return ""


def read_xml(zf, path):
    return ET.fromstring(zf.read(path))


def read_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []

    root = read_xml(zf, "xl/sharedStrings.xml")
    strings = []
    for item in root.findall("main:si", NS):
        text = "".join(node.text or "" for node in item.findall(".//main:t", NS))
        strings.append(text)
    return strings


def first_sheet_path(zf):
    workbook = read_xml(zf, "xl/workbook.xml")
    first_sheet = workbook.find("main:sheets/main:sheet", NS)
    if first_sheet is None:
        raise ValueError("Workbook has no worksheets.")

    rel_id = first_sheet.attrib.get(f"{{{NS['rel']}}}id")
    rels = read_xml(zf, "xl/_rels/workbook.xml.rels")

    for rel in rels.findall("pkgrel:Relationship", NS):
        if rel.attrib.get("Id") == rel_id:
            target = rel.attrib["Target"]
            return target[1:] if target.startswith("/") else f"xl/{target}"

    raise ValueError("Cannot resolve the first worksheet path.")


def read_cell(cell, shared_strings):
    cell_type = cell.attrib.get("t")

    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS))

    value_node = cell.find("main:v", NS)
    if value_node is None or value_node.text is None:
        return ""

    value = value_node.text
    if cell_type == "s":
        try:
            return shared_strings[int(value)]
        except (IndexError, ValueError):
            return ""

    return value


def read_xlsx_rows(path):
    with zipfile.ZipFile(path) as zf:
        shared_strings = read_shared_strings(zf)
        sheet = read_xml(zf, first_sheet_path(zf))
        rows = []

        for row_node in sheet.findall(".//main:sheetData/main:row", NS):
            row = []
            for cell in row_node.findall("main:c", NS):
                index = excel_col_index(cell.attrib.get("r"))
                if index is None:
                    continue
                while len(row) <= index:
                    row.append("")
                row[index] = read_cell(cell, shared_strings)
            rows.append(row)

        return rows


def read_state(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def main():
    if len(sys.argv) < 2:
        usage()

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) >= 3 and not sys.argv[2].startswith("--") else "data/daren-video-total-latest.csv"
    state_path = sys.argv[3] if len(sys.argv) >= 4 and not sys.argv[3].startswith("--") else "data/daren-video-total-state.json"
    write_state = "--write-state" in sys.argv or os.environ.get("DAREN_WRITE_STATE") == "true"
    fixed_product = os.environ.get("DAREN_PRODUCT", "梳子")

    state = read_state(state_path)
    previous_date = state.get("last_imported_video_date") or os.environ.get("DAREN_LAST_IMPORTED_DATE", "2026-07-08")

    raw_rows = read_xlsx_rows(input_path)
    if not raw_rows:
        raise ValueError("TikTok export is empty.")

    headers = [clean_cell(value) for value in raw_rows[0]]
    required = ["视频发布日期", "视频链接", "达人用户名"]
    missing = [column for column in required if column not in headers]
    if missing:
        raise ValueError(f"TikTok export is missing required columns: {', '.join(missing)}")

    date_index = headers.index("视频发布日期")
    link_index = headers.index("视频链接")
    creator_index = headers.index("达人用户名")

    prepared_rows = []
    for row in raw_rows[1:]:
        video_date = normalize_date(row[date_index] if date_index < len(row) else "")
        link = clean_cell(row[link_index] if link_index < len(row) else "")
        creator = clean_cell(row[creator_index] if creator_index < len(row) else "")

        if not video_date or video_date <= previous_date or "tiktok.com/" not in link:
            continue

        prepared_rows.append(
            {
                "视频发布日期": video_date,
                "达人ID": creator,
                "产品": fixed_product,
                "视频链接": link,
            }
        )

    output_headers = ["视频发布日期", "达人ID", "产品", "视频链接"]
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=output_headers)
        writer.writeheader()
        writer.writerows(prepared_rows)

    latest_date = max((row["视频发布日期"] for row in prepared_rows), default=None)
    today_beijing = datetime.now(timezone(timedelta(hours=8))).date().isoformat()
    next_state = {
        **state,
        "last_imported_video_date": latest_date or previous_date,
        "last_prepared_run_date": today_beijing,
        "last_prepared_count": len(prepared_rows),
        "target": "feishu_daren_video_total",
    }

    meta_path = output_file.with_suffix(".meta.json")
    meta_path.write_text(
        json.dumps(
            {
                "inputPath": input_path,
                "outputPath": output_path,
                "statePath": state_path,
                "previousDate": previous_date,
                "latestDate": latest_date,
                "rows": len(prepared_rows),
                "product": fixed_product,
                "nextState": next_state,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    if write_state and prepared_rows:
        Path(state_path).write_text(json.dumps(next_state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "outputPath": output_path,
                "previousDate": previous_date,
                "latestDate": latest_date,
                "rows": len(prepared_rows),
                "product": fixed_product,
                "wroteState": write_state and bool(prepared_rows),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
