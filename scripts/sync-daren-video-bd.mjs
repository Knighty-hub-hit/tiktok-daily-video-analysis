import { spawnSync } from "node:child_process";

const DEFAULT_BASE_TOKEN = "IRaAbxh8uakzXHsJ6z3cOrWVnN6";
const DEFAULT_VIDEO_TABLE_ID = "tbltCfy5ZsMAkNw0";
const DEFAULT_MAPPING_TABLE_ID = "tblEOq9By9RxVHns";
const PAGE_LIMIT = 200;

function beijingToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseArgs(argv) {
  const options = {
    all: false,
    date: process.env.DAREN_BD_SYNC_DATE || "",
    dryRun: process.env.DAREN_BD_SYNC_DRY_RUN === "1",
    readAs: process.env.DAREN_BD_SYNC_READ_AS || "bot",
    updateAs: process.env.DAREN_BD_SYNC_UPDATE_AS || "user",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--date") {
      options.date = argv[++index] || "";
    } else if (arg === "--read-as") {
      options.readAs = argv[++index] || options.readAs;
    } else if (arg === "--update-as") {
      options.updateAs = argv[++index] || options.updateAs;
    } else if (!arg.startsWith("--") && !options.date) {
      options.date = arg;
    }
  }

  if (!options.all && !options.date) {
    options.date = beijingToday();
  }

  if (!options.all && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error(`Invalid date: ${options.date}. Expected YYYY-MM-DD or --all.`);
  }

  return options;
}

function runLark(args) {
  const result = spawnSync("lark-cli", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
    },
  });

  if (result.status !== 0) {
    throw new Error(`${args.join(" ")}\n${result.stderr || result.stdout}`);
  }

  return result.stdout ? JSON.parse(result.stdout) : {};
}

function normalizeTalentId(value) {
  return String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function personKey(value) {
  const people = Array.isArray(value) ? value : [];
  return people.map((person) => person?.id || "").filter(Boolean).join("|");
}

function normalizePeople(value) {
  const people = Array.isArray(value) ? value : [];
  return people.map((person) => (person?.id ? { id: person.id } : null)).filter(Boolean);
}

async function listRecords({ baseToken, tableId, fields, as, filterJson }) {
  const records = [];

  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const args = [
      "base",
      "+record-list",
      "--base-token",
      baseToken,
      "--table-id",
      tableId,
      "--limit",
      String(PAGE_LIMIT),
      "--offset",
      String(offset),
      "--as",
      as,
      "--format",
      "json",
    ];

    for (const field of fields) {
      args.push("--field-id", field);
    }

    if (filterJson) {
      args.push("--filter-json", JSON.stringify(filterJson));
    }

    const data = runLark(args).data;
    const rows = data.data ?? [];
    const recordIds = data.record_id_list ?? [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const fieldValues = {};
      fields.forEach((field, fieldIndex) => {
        fieldValues[field] = rows[rowIndex]?.[fieldIndex];
      });
      records.push({ recordId: recordIds[rowIndex], fields: fieldValues });
    }

    if (!data.has_more || rows.length === 0) {
      break;
    }
  }

  return records;
}

function buildBdMapping(mappingRecords) {
  const mapping = new Map();
  const seenByTalent = new Map();

  for (const record of mappingRecords) {
    const talentId = normalizeTalentId(record.fields["达人ID"]);
    const bd = record.fields["现BD"];

    if (!talentId || !personKey(bd)) {
      continue;
    }

    const serial = Number(record.fields["自动编号"]) || 0;
    const entry = { serial, bd, recordId: record.recordId };
    const previous = mapping.get(talentId);

    if (!seenByTalent.has(talentId)) {
      seenByTalent.set(talentId, []);
    }
    seenByTalent.get(talentId).push(entry);

    if (!previous || serial >= previous.serial) {
      mapping.set(talentId, entry);
    }
  }

  const conflicts = Array.from(seenByTalent.entries())
    .filter(([, rows]) => rows.length > 1 && new Set(rows.map((row) => personKey(row.bd))).size > 1)
    .map(([talentId, rows]) => ({
      talentId,
      count: rows.length,
      bds: Array.from(new Set(rows.map((row) => row.bd?.[0]?.name || personKey(row.bd)))),
    }));

  if (conflicts.length) {
    throw new Error(`BD达人对应表存在同一达人不同现BD，已停止写入：${JSON.stringify(conflicts.slice(0, 20))}`);
  }

  return mapping;
}

function computeUpdates(videoRecords, mapping) {
  const updates = [];
  const unmatched = new Set();

  for (const record of videoRecords) {
    const talentId = normalizeTalentId(record.fields["达人ID"]);

    if (!talentId) {
      continue;
    }

    const expected = mapping.get(talentId);

    if (!expected) {
      unmatched.add(talentId);
      continue;
    }

    const currentKey = personKey(record.fields.BD);
    const expectedKey = personKey(expected.bd);

    if (currentKey !== expectedKey) {
      updates.push({
        recordId: record.recordId,
        talentId,
        from: record.fields.BD?.[0]?.name || currentKey || "(空)",
        to: expected.bd?.[0]?.name || expectedKey,
        value: normalizePeople(expected.bd),
      });
    }
  }

  return { updates, unmatched };
}

function groupUpdatesByBd(updates) {
  const groups = new Map();

  for (const update of updates) {
    const key = personKey(update.value);

    if (!groups.has(key)) {
      groups.set(key, { bd: update.to, value: update.value, recordIds: [] });
    }

    groups.get(key).recordIds.push(update.recordId);
  }

  return Array.from(groups.values());
}

function syncGroup({ baseToken, tableId, group, updateAs }) {
  runLark([
    "base",
    "+record-batch-update",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--json",
    JSON.stringify({
      record_id_list: group.recordIds,
      patch: { BD: group.value },
    }),
    "--as",
    updateAs,
    "--format",
    "json",
  ]);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseToken = process.env.DAREN_BASE_TOKEN || DEFAULT_BASE_TOKEN;
  const videoTableId = process.env.DAREN_VIDEO_TABLE_ID || DEFAULT_VIDEO_TABLE_ID;
  const mappingTableId = process.env.DAREN_BD_MAPPING_TABLE_ID || DEFAULT_MAPPING_TABLE_ID;
  const dateFilter = options.all
    ? null
    : { logic: "and", conditions: [["回收日期", "==", `ExactDate(${options.date})`]] };

  const mappingRecords = await listRecords({
    baseToken,
    tableId: mappingTableId,
    fields: ["达人ID", "现BD", "自动编号"],
    as: options.readAs,
  });
  const mapping = buildBdMapping(mappingRecords);
  const videoRecords = await listRecords({
    baseToken,
    tableId: videoTableId,
    fields: ["达人ID", "BD", "回收日期", "自动编号"],
    as: options.readAs,
    filterJson: dateFilter,
  });
  const before = computeUpdates(videoRecords, mapping);
  const groups = groupUpdatesByBd(before.updates);

  if (!options.dryRun) {
    for (const group of groups) {
      syncGroup({ baseToken, tableId: videoTableId, group, updateAs: options.updateAs });
    }
  }

  const afterRecords = options.dryRun
    ? videoRecords
    : await listRecords({
        baseToken,
        tableId: videoTableId,
        fields: ["达人ID", "BD", "回收日期", "自动编号"],
        as: options.readAs,
        filterJson: dateFilter,
      });
  const after = computeUpdates(afterRecords, mapping);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun,
        scope: options.all ? "all" : options.date,
        checkedRecords: videoRecords.length,
        mappingRecords: mappingRecords.length,
        usableMappings: mapping.size,
        updated: before.updates.length,
        updateGroups: groups.map((group) => ({ bd: group.bd, count: group.recordIds.length })),
        remainingMismatches: after.updates.length,
        unmatchedTalentIds: after.unmatched.size,
        updatedSamples: before.updates.slice(0, 30).map(({ talentId, from, to }) => ({ talentId, from, to })),
        unmatchedSamples: Array.from(after.unmatched).slice(0, 30),
      },
      null,
      2,
    ),
  );
}

await main();
