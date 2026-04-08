function nowIso() {
  return new Date().toISOString();
}

function toIsoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function jsonValue(value) {
  return JSON.stringify(value);
}

function mergeWithUpdatedAt(current, patch) {
  return {
    ...current,
    ...patch,
    updatedAt: nowIso()
  };
}

function mapBaseRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    createdAt: toIsoOrNull(row.created_at),
    updatedAt: toIsoOrNull(row.updated_at)
  };
}

module.exports = {
  jsonValue,
  mapBaseRow,
  mergeWithUpdatedAt,
  nowIso,
  toIsoOrNull
};
