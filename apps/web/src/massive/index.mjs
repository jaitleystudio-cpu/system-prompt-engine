/** Large Paste / million-word intake. Stops at MassiveSourceIR. Not mounted in the UI. */

export { PROTOCOL, WORD_CAP, TARGET_CHARS, HARD_CHARS, MAX_RESIDENT_CHARS } from "./constants.mjs";
export { MassiveError } from "./errors.mjs";
export { isSemanticPass } from "./ir.mjs";
export { createMemoryCustody } from "./memoryStore.mjs";
export { createHandleCustody, openBrowserRoot } from "./opfsStore.mjs";
export { createIdbIndex, createMockDb, openMassiveDb } from "./idbIndex.mjs";
export { MassiveSession, openSession, resumeSession } from "./session.mjs";
export { createMemoryHost, handleIngestMessage } from "./protocol.mjs";
export { scanExplicitEvidence } from "./evidence.mjs";
export { nextChunkEnd } from "./chunking.mjs";
export { countWordStarts } from "./whitespace.mjs";
export { sha256Text, chainUpdate } from "./hashing.mjs";
