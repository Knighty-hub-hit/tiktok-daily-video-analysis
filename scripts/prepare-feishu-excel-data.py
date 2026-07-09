#!/usr/bin/env python3
import csv
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

EXPECTED_HEADERS = [
    "视频名称",
    "视频链接",
    "视频发布日期",
    "达人用户名",
    "GMV",
    "联盟成交件数",
    "联盟带货视频 GMV",
    "带货视频平均订单金额",
    "预计佣金",
    "预计固定费用",
    "联盟订单量",
    "带货视频曝光次数",
    "联盟点击率",
    "带货视频千次曝光成交金额",
    "已退款的联盟商品数",
    "联盟已退款的 GMV",
    "带货视频评论数",
    "带货视频点赞数",
]

REQUIRED_HEADERS = {"视频发布日期", "视频链接", "达人用户名"}

NUMERIC_HEADERS = {
    "GMV",
    "联盟成交件数",
    "联盟带货视频 GMV",
    "带货视频平均订单金额",
    "预计佣金",
    "预计固定费用",
    "联盟订单量",
    "带货视频曝光次数",
    "联盟点击率",
    "带货视频千次曝光成交金额",
    "已退款的联盟商品数",
    "联盟已退款的 GMV",
    "带货视频评论数",
    "带货视频点赞数",
}


def usage():
    raise SystemExit(
        "Usage: python3 scripts/prepare-feishu-excel-data.py <input.xlsx> <output.csv|output.json>"
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

    return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()


def valid_date(year, month, day):
    try:
        return datetime(int(year), int(month), int(day)).date().isoformat()
    except ValueError:
        return ""


def normalize_date(value):
    text = clean_cell(value)
    if not text:
        return ""

    if re.fullmatch(r"\d+(\.\d+)?", text):
        return excel_serial_to_date(text)

    match = re.search(r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if match:
        return valid_date(match.group(1), match.group(2), match.group(3))

    short_match = re.search(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})", text)
    if short_match:
        year = 2000 + int(short_match.group(3))
        return valid_date(year, short_match.group(1), short_match.group(2))

    return ""


def is_tiktok_video_link(value):
    return bool(re.match(r"^https?://(?:www\.)?tiktok\.com/@[^/]+/video/\d+", clean_cell(value)))


def parse_number(value):
    text = clean_cell(value)
    if not text:
        return ""

    match = re.search(r"-?\d+(?:\.\d+)?", re.sub(r"[$,，%\s]|MX\$", "", text, flags=re.I))
    if not match:
        return text

    number = float(match.group(0))
    return int(number) if number.is_integer() else number


def read_xml(zf, file_path):
    return ET.fromstring(zf.read(file_path))


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


def read_xlsx_rows(file_path):
    with zipfile.ZipFile(file_path) as zf:
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


def select_output_headers(headers):
    if all(header in headers for header in EXPECTED_HEADERS):
        return EXPECTED_HEADERS

    missing_required = sorted(REQUIRED_HEADERS - set(headers))
    if missing_required:
        raise ValueError(f"TikTok export is missing required columns: {', '.join(missing_required)}")

    if len(headers) != 18:
        raise ValueError(
            "TikTok export should contain the 18 standard columns. "
            f"Received {len(headers)} columns: {' | '.join(headers)}"
        )

    return headers


def write_csv(file_path, headers, rows):
    output_file = Path(file_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(row["values"] for row in rows)


def write_json(file_path, input_path, headers, rows, start_date):
    output_file = Path(file_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(
        json.dumps(
            {
                "inputPath": input_path,
                "headers": headers,
                "rows": rows,
                "startDate": start_date,
                "importMode": os.environ.get("TIKTOK_IMPORT_MODE", "latest-date"),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main():
    if len(sys.argv) < 3:
        usage()

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    start_date = os.environ.get("SITE_DATA_START_DATE", "2026-07-01")
    import_mode = os.environ.get("TIKTOK_IMPORT_MODE", "latest-date").strip().lower()

    raw_rows = read_xlsx_rows(input_path)
    if not raw_rows:
        raise ValueError("TikTok export is empty.")

    source_headers = [clean_cell(value) for value in raw_rows[0]]
    output_headers = select_output_headers(source_headers)
    source_indexes = {header: source_headers.index(header) for header in output_headers}
    date_index = source_headers.index("视频发布日期")
    link_index = source_headers.index("视频链接")

    rows_by_key = {}
    for source_index, source_row in enumerate(raw_rows[1:], start=2):
        video_date = normalize_date(source_row[date_index] if date_index < len(source_row) else "")
        link = clean_cell(source_row[link_index] if link_index < len(source_row) else "")

        if not video_date or video_date < start_date or not is_tiktok_video_link(link):
            continue

        values = []
        for header in output_headers:
            index = source_indexes[header]
            value = source_row[index] if index < len(source_row) else ""

            if header == "视频发布日期":
                values.append(video_date)
            elif header in NUMERIC_HEADERS:
                values.append(parse_number(value))
            else:
                values.append(clean_cell(value))

        row_key = link if "tiktok.com/" in link else f"source-row:{source_index}"
        rows_by_key[row_key] = {
            "sourceRow": source_index,
            "date": video_date,
            "link": link,
            "values": values,
        }

    rows = list(rows_by_key.values())
    if not rows:
        raise ValueError(f"No TikTok rows found on or after {start_date}.")

    if import_mode in {"latest", "latest-date", "daily", "incremental"}:
        latest_date = max(row["date"] for row in rows)
        rows = [row for row in rows if row["date"] == latest_date]
    elif import_mode in {"all", "all-since-start", "backfill"}:
        latest_date = max(row["date"] for row in rows)
    else:
        raise ValueError(
            "TIKTOK_IMPORT_MODE must be latest-date or all-since-start. "
            f"Received: {import_mode}"
        )

    if Path(output_path).suffix.lower() == ".json":
        write_json(output_path, input_path, output_headers, rows, start_date)
    else:
        write_csv(output_path, output_headers, rows)

    dates = sorted(row["date"] for row in rows)
    print(
        json.dumps(
            {
                "outputPath": output_path,
                "columns": len(output_headers),
                "rows": len(rows),
                "startDate": dates[0],
                "endDate": dates[-1],
                "latestDateInReport": latest_date,
                "importMode": import_mode,
                "format": "json" if Path(output_path).suffix.lower() == ".json" else "csv",
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
