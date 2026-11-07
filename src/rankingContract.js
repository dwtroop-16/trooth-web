// Ranking minimum (Architect decision 22 / rubric v1.3.10).
// A person is ranked on one existing board after 3 resolved forecasts on that board.
// Resolved = Hit + Miss only. Pending, In review (score status "void"), and Unscorable
// are excluded. Counts are not pooled across boards. Models are never ranked.
// Rubric v1.3.11 models architecture is not a runtime change and is out of scope here.
// Scorer may mark a model eligible:true once it has 3 resolved (rank stays null).
// eligible:true is not permission to rank kind "model".

export const RANKING_RUBRIC = "1.3.10";
export const RANKING_MIN_RESOLVED = 3;

// Score-status strings. "void" is the stored status whose public grade is "In review".
export const RESOLVED_STATUSES = ["hit", "miss"];
export const EXCLUDED_FROM_RESOLVED = ["pending", "void", "unscorable"];

export function countsAsResolved(status) {
  return status === "hit" || status === "miss";
}

export function unresolvedLabel(nResolved, min = RANKING_MIN_RESOLVED) {
  return `${nResolved} of ${min} resolved`;
}

export function isModelKind(kind) {
  return kind === "model";
}

/**
 * Model if the board row says so OR the speaker registry says so.
 * A scorer row mislabeled kind "person" still must not be ranked when the registry says model.
 */
export function rowIsModel(row, registryKind) {
  if (!row && registryKind == null) return false;
  if (row?.kind === "model") return true;
  if (registryKind === "model") return true;
  return false;
}

/**
 * People boards may show Scorer's rank only for a non-model row that has both eligible and a rank.
 * eligible:true by itself is not a rank. Models are never ranked, even with eligible:true and rank set.
 * The models board (people:false) assigns no ranks.
 */
export function boardRowIsRanked(row, { model = false, people = true } = {}) {
  if (!people || model || row?.kind === "model") return false;
  return !!row?.eligible && row?.rank != null;
}

/** Profile pick-record ranking. Models stay unranked at any resolved count. */
export function pickRecordIsRanked(speaker, nResolved, min) {
  if (isModelKind(speaker?.kind)) return false;
  return Number(nResolved) >= min;
}

/** Rank number safe to print. Null for models, even if a caller left rank and ranked set. */
export function visibleBoardRank(row) {
  if (!row) return null;
  if (row.model || row.kind === "model" || row.kindLabel === "Model") return null;
  if (row.ranked === false) return null;
  if (row.rank == null) return null;
  return row.rank;
}

export function boardFileContractError(board, filename) {
  if (!board || typeof board !== "object" || Array.isArray(board)) {
    return `${filename}: expected an object`;
  }
  if (board.rubric !== RANKING_RUBRIC) {
    return `${filename}: rubric ${JSON.stringify(board.rubric)} !== ${RANKING_RUBRIC}`;
  }
  if (board.min_resolved !== RANKING_MIN_RESOLVED) {
    return `${filename}: min_resolved ${JSON.stringify(board.min_resolved)} !== ${RANKING_MIN_RESOLVED}`;
  }
  return null;
}

export function assertBoardContract(board, filename) {
  const err = boardFileContractError(board, filename);
  if (err) throw new Error(err);
}

/**
 * Provenance stored on the site snapshot. Hashes are of the scorer input bytes.
 * Rubric and min_resolved are the contract, so a later rebuild cannot quietly
 * accept a min-10 file. This object does not copy grades or forecasts.
 */
export function buildBoardProvenance({ sourceDir, inputs, builtAt }) {
  if (!Array.isArray(inputs) || inputs.length !== 3) {
    throw new Error("provenance requires people_board, pick_record, and models_board");
  }
  const names = inputs.map((i) => i.name).sort().join(",");
  if (names !== "models_board.json,people_board.json,pick_record.json") {
    throw new Error(`provenance inputs must be the three board files, got ${names}`);
  }
  for (const input of inputs) {
    if (!/^[a-f0-9]{64}$/.test(input.sha256 || "")) throw new Error(`${input.name}: sha256 missing`);
    if (!Number.isInteger(input.bytes) || input.bytes < 0) throw new Error(`${input.name}: bytes missing`);
    if (input.rubric !== RANKING_RUBRIC || input.min_resolved !== RANKING_MIN_RESOLVED) {
      throw new Error(`${input.name}: provenance refused rubric ${input.rubric} min_resolved ${input.min_resolved}`);
    }
  }
  return {
    rubric: RANKING_RUBRIC,
    min_resolved: RANKING_MIN_RESOLVED,
    resolved_statuses: [...RESOLVED_STATUSES],
    excluded_statuses: [...EXCLUDED_FROM_RESOLVED],
    pooling: "none",
    per: "person_per_board",
    models_ranked: false,
    source_dir: sourceDir,
    inputs: inputs
      .map(({ name, sha256, bytes }) => ({ name, sha256, bytes }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    built_at: builtAt,
  };
}

/**
 * Committed src/generated/boards.json is still the min-10 scorer copy until
 * scorer/out (or the named preview dir) is snapshotted by build:live-data.
 * Do not relabel that file as rubric 1.3.10.
 */
export function shippedBoardSnapshotStatus(boards) {
  const rubric = boards?.rubric ?? null;
  const min = boards?.min_resolved ?? null;
  const provenance = boards?.provenance;
  const provenanceOk =
    provenance &&
    provenance.rubric === RANKING_RUBRIC &&
    provenance.min_resolved === RANKING_MIN_RESOLVED &&
    provenance.models_ranked === false &&
    Array.isArray(provenance.inputs) &&
    provenance.inputs.length === 3 &&
    provenance.inputs.every((i) => typeof i.sha256 === "string" && /^[a-f0-9]{64}$/.test(i.sha256));
  if (rubric === RANKING_RUBRIC && min === RANKING_MIN_RESOLVED && provenanceOk) {
    return { ok: true, blocker: null, rubric, min_resolved: min };
  }
  return {
    ok: false,
    blocker: "scorer-min3-output-not-in-repo",
    rubric,
    min_resolved: min,
    required_rubric: RANKING_RUBRIC,
    required_min_resolved: RANKING_MIN_RESOLVED,
    required_inputs: [
      "scorer/out/people_board.json",
      "scorer/out/pick_record.json",
      "scorer/out/models_board.json",
      "scorer/preview-2026-11-06-min3/people_board.json",
      "scorer/preview-2026-11-06-min3/pick_record.json",
      "scorer/preview-2026-11-06-min3/models_board.json",
    ],
  };
}

/** Minimum printed for a snapshot. A matching 1.3.10 file uses 3. A stale file keeps its own minimum. Missing data uses 3, not 10. */
export function displayRankingMin(boards) {
  if (boards?.rubric === RANKING_RUBRIC && boards?.min_resolved === RANKING_MIN_RESOLVED) {
    return RANKING_MIN_RESOLVED;
  }
  if (Number.isInteger(boards?.min_resolved) && boards.min_resolved > 0) return boards.min_resolved;
  return RANKING_MIN_RESOLVED;
}
