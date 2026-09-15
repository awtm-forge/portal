import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * INTAKE-SPEC section 4. Files live outside the web root under UPLOAD_DIR,
 * in a per-project directory, with random names. Nothing here is ever served
 * by a public URL; the authenticated route reads through absolutePath().
 */
export function uploadRoot(): string {
  const dir = process.env.UPLOAD_DIR;
  if (!dir) throw new Error("UPLOAD_DIR is not set");
  return path.resolve(dir);
}

export function randomFileName(ext: string): string {
  return `${randomBytes(16).toString("hex")}.${ext}`;
}

/** Resolve a stored relative path and refuse anything that escapes the root. */
export function absolutePath(storedPath: string): string {
  const root = uploadRoot();
  const abs = path.resolve(root, storedPath);
  if (!abs.startsWith(root + path.sep)) throw new Error("path escapes the upload root");
  return abs;
}

async function write(relDir: string, ext: string, data: Buffer): Promise<string> {
  const rel = path.posix.join(relDir, randomFileName(ext));
  const abs = absolutePath(rel);
  await mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
  await writeFile(abs, data, { mode: 0o600 });
  return rel;
}

export function writeClientFile(clientId: string, ext: string, data: Buffer): Promise<string> {
  if (!/^[A-Za-z0-9_-]+$/.test(clientId)) throw new Error("bad client id");
  return write(path.posix.join("clients", clientId), ext, data);
}

export function writeLibraryFile(ext: string, data: Buffer): Promise<string> {
  return write("library", ext, data);
}

export function readStored(storedPath: string): Promise<Buffer> {
  return readFile(absolutePath(storedPath));
}

export async function removeStored(storedPath: string): Promise<void> {
  await unlink(absolutePath(storedPath)).catch(() => undefined);
}

/**
 * Every client upload at once, for the clean start before launch (ADR 0023).
 * The image library sits beside it under library/ and is not touched.
 */
export async function removeClientUploads(): Promise<void> {
  await rm(path.join(uploadRoot(), "clients"), { recursive: true, force: true });
}
