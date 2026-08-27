#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const projectId = process.env.FIREBASE_PROJECT_ID || "seldatabase20260827";
const source = fs.readFileSync(new URL("../data/resources.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "data/resources.js" });
const resources = sandbox.window.SEL_RESOURCES;

if (!Array.isArray(resources) || !resources.length) throw new Error("No resources found in data/resources.js");

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encodeValue(value)]));
}

const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const now = new Date().toISOString();

async function upsert(path, data) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: encodeFields(data) })
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
}

for (const resource of resources) {
  await upsert(`resources/${encodeURIComponent(resource.id)}`, {
    ...resource,
    status: "published",
    schemaVersion: 1,
    updatedAt: now
  });
  console.log(`Seeded ${resource.id}`);
}

await upsert("metadata/catalog", {
  resourceCount: resources.length,
  schemaVersion: 1,
  updatedAt: now,
  source: "StanleyLin2026/sel-knowledge-hub"
});

console.log(`Seed complete: ${resources.length} resources in ${projectId}`);
