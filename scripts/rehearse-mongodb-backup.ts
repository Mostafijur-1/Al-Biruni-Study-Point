import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { MongoClient, BSON, type Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

const value = (name: string) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const environment = value("environment");
const databaseName = value("database");
const uri = process.env.MONGODB_URI?.trim();
if (!uri) throw new Error("MONGODB_URI is not configured.");
if (!environment || !["staging", "production", "test"].includes(environment)) throw new Error("Use an explicit --environment target.");
if (!databaseName || !/^[a-z0-9_-]{3,64}$/i.test(databaseName)) throw new Error("Use an explicit --database target.");

const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outputDirectory = path.resolve(process.cwd(), value("output") ?? `.backups/${databaseName}-${timestamp}`);
const relativeOutput = path.relative(process.cwd(), outputDirectory);
if (relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) throw new Error("Backup output must stay inside the workspace.");

type CollectionBackup = { name: string; documents: Document[]; hash: string };
type LogicalBackup = { schemaVersion: 1; database: string; createdAt: string; collections: CollectionBackup[] };
const canonical = (documents: Document[]) => BSON.EJSON.stringify([...documents].sort((a, b) => String(a._id).localeCompare(String(b._id))), { relaxed: false });
const digest = (documents: Document[]) => createHash("sha256").update(canonical(documents)).digest("hex");

const sourceClient = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
await sourceClient.connect();
console.error("Connected to the source database; enumerating collections.");
let replicaSet: MongoMemoryReplSet | undefined;
try {
  const source = sourceClient.db(databaseName);
  const names = (await source.listCollections({}, { nameOnly: true }).toArray())
    .map((row) => row.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
  const collections: CollectionBackup[] = [];
  let totalDocuments = 0;
  for (const name of names) {
    console.error(`Reading ${name}.`);
    const documents = await source.collection(name).find({}, { maxTimeMS: 30_000 }).sort({ _id: 1 }).limit(100_001).toArray();
    if (documents.length > 100_000) throw new Error(`Collection ${name} exceeds the reviewed 100,000-document rehearsal bound.`);
    totalDocuments += documents.length;
    collections.push({ name, documents, hash: digest(documents) });
  }
  const backup: LogicalBackup = { schemaVersion: 1, database: databaseName, createdAt: new Date().toISOString(), collections };
  const plaintext = Buffer.from(BSON.EJSON.stringify(backup, { relaxed: false }), "utf8");
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const encrypted = Buffer.concat([Buffer.from("ABSPBACKUP1"), iv, cipher.getAuthTag(), ciphertext]);
  const backupPath = path.join(outputDirectory, "backup.ejson.aes256gcm");
  const keyPath = path.join(outputDirectory, "backup.key");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([writeFile(backupPath, encrypted), writeFile(keyPath, key.toString("hex"), "utf8")]);
  await Promise.all([chmod(backupPath, 0o600), chmod(keyPath, 0o600)]);

  const stored = await readFile(backupPath);
  const storedKey = Buffer.from((await readFile(keyPath, "utf8")).trim(), "hex");
  if (!stored.subarray(0, 11).equals(Buffer.from("ABSPBACKUP1"))) throw new Error("Backup header is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", storedKey, stored.subarray(11, 23));
  decipher.setAuthTag(stored.subarray(23, 39));
  const restoredPayload = Buffer.concat([decipher.update(stored.subarray(39)), decipher.final()]);
  const parsed = BSON.EJSON.parse(restoredPayload.toString("utf8")) as LogicalBackup;

  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, dbName: "absp_restore_rehearsal", storageEngine: "wiredTiger" } });
  const restoreClient = new MongoClient(replicaSet.getUri());
  await restoreClient.connect();
  try {
    const restore = restoreClient.db("absp_restore_rehearsal");
    for (const collection of parsed.collections) {
      if (collection.documents.length) await restore.collection(collection.name).insertMany(collection.documents, { ordered: true });
    }
    for (const expected of collections) {
      const actual = await restore.collection(expected.name).find({}).sort({ _id: 1 }).toArray();
      if (actual.length !== expected.documents.length || digest(actual) !== expected.hash) throw new Error(`Restore integrity check failed for ${expected.name}.`);
    }
  } finally {
    await restoreClient.close();
  }
  const snapshotReferenceHash = createHash("sha256").update(encrypted).digest("hex");
  console.log(JSON.stringify({ environment, database: databaseName, backupPath: relativeOutput.replaceAll("\\", "/") + "/backup.ejson.aes256gcm", keyPath: relativeOutput.replaceAll("\\", "/") + "/backup.key", collections: collections.length, documents: totalDocuments, encryptedBytes: encrypted.length, snapshotReferenceHash, restoreTarget: "isolated-non-production", integrityChecksPassed: true }, null, 2));
} finally {
  await sourceClient.close();
  if (replicaSet) await replicaSet.stop({ doCleanup: true, force: true });
}
