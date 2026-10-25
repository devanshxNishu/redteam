import test from "node:test";
import assert from "node:assert/strict";
import { link, mkdtemp, open, readFile, readdir, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { publishExclusive } from "../src/publication.ts";
import type { PublicationIO } from "../src/publication.ts";

async function temporary(work: (directory: string, destination: string) => Promise<void>) {
  const directory = await mkdtemp(resolve(tmpdir(), "redteam-publication-"));
  try { await work(directory, resolve(directory, "report.json")); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
const ioFailure = () => Object.assign(new Error("Injected storage failure"), { code: "EIO" });

test("publication flushes a private complete file before its exclusive final entry", async () => temporary(async (directory, destination) => {
  const events: string[] = [], bytes = Buffer.from(JSON.stringify({ outcome: "fixture", text: "x".repeat(100000) }));
  const filesystem: PublicationIO = {
    open: async (path, flags, mode) => {
      const file = await open(path, flags, mode), sync = file.sync.bind(file), close = file.close.bind(file);
      file.sync = async () => { events.push(flags === "wx" ? "file_sync" : "directory_sync"); await sync(); };
      file.close = async () => { events.push(flags === "wx" ? "file_close" : "directory_close"); await close(); };
      return file;
    },
    link: async (pending, final) => {
      events.push("publish"); assert.deepEqual(await readFile(pending), bytes);
      assert.equal((await stat(pending)).mode & 0o777, 0o600); await assert.rejects(stat(final), /ENOENT/);
      await link(pending, final);
    },
    unlink: async path => { events.push("remove_staging"); await unlink(path); },
  };
  await publishExclusive(destination, bytes, filesystem);
  assert.deepEqual(await readFile(destination), bytes); assert.deepEqual(await readdir(directory), ["report.json"]);
  assert.equal((await stat(destination)).mode & 0o777, 0o600); assert.equal((await stat(destination)).nlink, 1);
  assert.deepEqual(events, ["file_sync", "file_close", "publish", "remove_staging", "directory_sync", "directory_close"]);
}));

for (const phase of ["write", "file_sync"] as const) test(`a ${phase} failure exposes no final record and cleans its owned staging file`, async () => temporary(async (directory, destination) => {
  let dispatched = false;
  const filesystem: PublicationIO = { open: async (path, flags, mode) => {
    const file = await open(path, flags, mode);
    if (phase === "write") { const write = file.writeFile.bind(file); file.writeFile = async () => { await write("{partial"); throw ioFailure(); }; }
    else file.sync = async () => { throw ioFailure(); };
    return file;
  }, link: async () => { dispatched = true; }, unlink };
  await assert.rejects(publishExclusive(destination, Buffer.from("complete"), filesystem), { code: "EIO" });
  assert.equal(dispatched, false); await assert.rejects(stat(destination), /ENOENT/); assert.deepEqual(await readdir(directory), []);
}));

test("directory sync failure preserves the already complete publication and prevents replacement", async () => temporary(async (directory, destination) => {
  const bytes = Buffer.from('{"complete":true}');
  const filesystem: PublicationIO = { open: async (path, flags, mode) => {
    const file = await open(path, flags, mode); if (flags === "r") file.sync = async () => { throw ioFailure(); }; return file;
  }, link, unlink };
  await assert.rejects(publishExclusive(destination, bytes, filesystem), { code: "EIO" });
  assert.deepEqual(await readFile(destination), bytes); assert.deepEqual(await readdir(directory), ["report.json"]);
  await assert.rejects(publishExclusive(destination, Buffer.from("replacement")), { code: "EEXIST" });
  assert.deepEqual(await readFile(destination), bytes);
}));

test("unsupported hard links fail closed without a replacement or copy fallback", async () => temporary(async (directory, destination) => {
  const filesystem: PublicationIO = { open, link: async () => { throw Object.assign(new Error("Injected unsupported filesystem"), { code: "EXDEV" }); }, unlink };
  await assert.rejects(publishExclusive(destination, Buffer.from("complete"), filesystem), { code: "EXDEV" });
  await assert.rejects(stat(destination), /ENOENT/); assert.deepEqual(await readdir(directory), []);
}));

test("six independent publishers produce exactly one complete immutable record", { timeout: 15000 }, async () => temporary(async (directory, destination) => {
  const moduleUrl = new URL("../src/publication.ts", import.meta.url).href;
  const program = `import { publishExclusive } from ${JSON.stringify(moduleUrl)}; process.send({ready:true}); process.once("message", async () => { try { await publishExclusive(process.argv[1], Buffer.from(JSON.stringify({writer:process.argv[2],text:process.argv[2].repeat(200000)}))); process.send({ok:true}); } catch(error) { process.send({ok:false,code:error.code}); } finally { process.disconnect(); } });`;
  const children = Array.from({ length: 6 }, (_, index) => spawn(process.execPath, ["--input-type=module", "-e", program, destination, String(index)], { stdio: ["ignore", "ignore", "pipe", "ipc"] }));
  try {
    await Promise.all(children.map(child => once(child, "message")));
    const results = children.map(child => once(child, "message")), exits = children.map(child => once(child, "exit"));
    children.forEach(child => child.send("go"));
    const messages = (await Promise.all(results)).map(([value]) => value as { ok: boolean; code?: string });
    await Promise.all(exits);
    assert.equal(messages.filter(value => value.ok).length, 1); assert(messages.filter(value => !value.ok).every(value => value.code === "EEXIST"));
    const record = JSON.parse(await readFile(destination, "utf8")); assert.equal(record.text, record.writer.repeat(200000));
    assert.deepEqual(await readdir(directory), ["report.json"]);
  } finally { for (const child of children) if (child.exitCode === null && child.signalCode === null) { const stopped = once(child, "exit"); child.kill("SIGKILL"); await stopped; } }
}));

for (const phase of ["writing", "flushed", "published"] as const) test(`killing a real writer while ${phase} never exposes partial final bytes`, { timeout: 15000 }, async () => temporary(async (directory, destination) => {
  const moduleUrl = new URL("../src/publication.ts", import.meta.url).href;
  // The injected IO pauses real filesystem operations at a deterministic boundary.
  // It does not change the publisher's write, flush, link, or cleanup implementation.
  const program = `import { open,link,unlink } from "node:fs/promises"; import { publishExclusive } from ${JSON.stringify(moduleUrl)};
    const phase=process.argv[2], keepalive=setInterval(()=>{},1000), pause=async()=>{process.send({paused:true});await new Promise(()=>{});};
    const filesystem={open:async(path,flags,mode)=>{const file=await open(path,flags,mode);if(flags==="wx"&&phase==="writing"){const write=file.writeFile.bind(file);file.writeFile=async()=>{await write('{"partial":');await pause();};}return file;},
      link:async(pending,final)=>{if(phase==="flushed")await pause();await link(pending,final);if(phase==="published")await pause();},unlink};
    try{await publishExclusive(process.argv[1],Buffer.from(JSON.stringify({complete:true,text:"x".repeat(100000)})),filesystem);}catch(error){process.send({error:error.message});}finally{clearInterval(keepalive);}`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", program, destination, phase], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  try {
    const [message] = await once(child, "message"); assert.deepEqual(message, { paused: true });
    if (phase === "published") assert.equal(JSON.parse(await readFile(destination, "utf8")).complete, true);
    else await assert.rejects(readFile(destination), /ENOENT/);
    const stopped = once(child, "exit"); child.kill("SIGKILL"); await stopped;
    const pending = (await readdir(directory)).filter(name => name.endsWith(".pending")); assert.equal(pending.length, 1);
    if (phase === "published") {
      const before = await readFile(destination); assert.equal(JSON.parse(before.toString()).text.length, 100000);
      await assert.rejects(publishExclusive(destination, Buffer.from("replacement")), { code: "EEXIST" }); assert.deepEqual(await readFile(destination), before);
    } else {
      await assert.rejects(readFile(destination), /ENOENT/);
      await publishExclusive(destination, Buffer.from('{"restart":true}')); assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), { restart: true });
    }
    // Recovery does not promote or remove a staging file whose writer may be active.
    assert((await readdir(directory)).includes(pending[0]!));
  } finally { if (child.exitCode === null && child.signalCode === null) { const stopped = once(child, "exit"); child.kill("SIGKILL"); await stopped; } }
}));
