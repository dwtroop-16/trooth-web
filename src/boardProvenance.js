// Node-only loader for Scorer board files. The browser bundle must not import this.
// Reads the three board JSON files, checks rubric 1.3.10 / min_resolved 3, and
// returns sha256 provenance. Does not write scorer outputs and does not fall
// back to a min-10 snapshot.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RANKING_RUBRIC,
  RANKING_MIN_RESOLVED,
  boardFileContractError,
  buildBoardProvenance,
} from "./rankingContract.js";

export const BOARD_INPUTS = [
  ["people_board", "people_board.json"],
  ["pick_record", "pick_record.json"],
  ["models_board", "models_board.json"],
];

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function loadScorerBoardFiles(dir, sourceDir = dir, builtAt = new Date().toISOString()) {
  const files = [];
  for (const [key, name] of BOARD_INPUTS) {
    const path = join(dir, name);
    const bytes = readFileSync(path);
    let board;
    try {
      board = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new Error(`${sourceDir}/${name}: invalid JSON`);
    }
    const err = boardFileContractError(board, `${sourceDir}/${name}`);
    if (err) {
      throw new Error(
        `${err}. Refusing to snapshot this file. Site board build does not write scorer outputs and does not fall back to a min-10 snapshot.`,
      );
    }
    files.push({
      key,
      name,
      sha256: sha256Hex(bytes),
      bytes: bytes.length,
      rubric: board.rubric,
      min_resolved: board.min_resolved,
      board,
    });
  }
  const provenance = buildBoardProvenance({ sourceDir, inputs: files, builtAt });
  return {
    rubric: RANKING_RUBRIC,
    min_resolved: RANKING_MIN_RESOLVED,
    provenance,
    files,
  };
}
