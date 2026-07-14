import mongoose from "mongoose";

const CAPABILITY_KEY = Symbol.for("tenador.mongoTransactionCapability");
const capability = globalThis[CAPABILITY_KEY] || {
  supported: undefined,
  pending: null,
};

globalThis[CAPABILITY_KEY] = capability;

export function mongoTransactionMode(value = process.env.MONGODB_TRANSACTIONS) {
  const mode = String(value || "auto").trim().toLowerCase();
  if (["0", "false", "off", "disabled"].includes(mode)) return "disabled";
  if (["1", "true", "on", "enabled"].includes(mode)) return "enabled";
  return "auto";
}

export function topologySupportsTransactions(hello) {
  if (!hello || typeof hello !== "object") return null;
  if (hello.logicalSessionTimeoutMinutes == null) return false;
  if (Number.isFinite(hello.maxWireVersion) && hello.maxWireVersion < 7) {
    return false;
  }
  return Boolean(
    hello.setName ||
    hello.msg === "isdbgrid" ||
    hello.serviceId,
  );
}

export function isTransactionUnsupportedError(error) {
  const message = String(error?.message || "");
  if (error?.code === 20) return true;
  if (/Transaction numbers are only allowed/i.test(message)) return true;

  const activeTransactionUnsupported =
    /Only servers in a sharded cluster can start a new transaction at the active transaction number/i.test(message);

  return activeTransactionUnsupported && (
    error?.code === 117 ||
    error?.codeName === "ConflictingOperationInProgress"
  );
}

async function deploymentSupportsTransactions() {
  const mode = mongoTransactionMode();
  if (mode === "disabled") return false;
  if (mode === "enabled") return true;
  if (capability.supported !== undefined) return capability.supported;
  if (capability.pending) return capability.pending;

  capability.pending = (async () => {
    try {
      const database = mongoose.connection?.db;
      if (!database) return true;
      const hello = await database.admin().command({ hello: 1 });
      const supported = topologySupportsTransactions(hello);
      capability.supported = supported ?? true;
      return capability.supported;
    } catch {
      // A restricted database user may not be allowed to run hello. Preserve
      // the previous behavior and let the transaction attempt decide.
      return true;
    } finally {
      capability.pending = null;
    }
  })();

  return capability.pending;
}

async function endSession(session) {
  if (!session) return;
  try {
    await session.endSession();
  } catch {
    // Session cleanup must not prevent the safe non-transactional fallback.
  }
}

export async function runWithOptionalTransaction(work) {
  if (typeof work !== "function") {
    throw new TypeError("Transaction work must be a function");
  }

  if (!(await deploymentSupportsTransactions())) {
    return work(null);
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (!isTransactionUnsupportedError(error)) throw error;
    if (mongoTransactionMode() === "auto") capability.supported = false;
    await endSession(session);
    session = null;
    return work(null);
  } finally {
    await endSession(session);
  }
}
