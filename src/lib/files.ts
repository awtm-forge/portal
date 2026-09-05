import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { DOMParser, XMLSerializer, type Element as XElement } from "@xmldom/xmldom";

/**
 * INTAKE-SPEC section 4 and 13.6. Type by magic bytes, never by extension.
 * Images re-encoded with EXIF gone. SVG sanitised. PDF kept as it is. HEIC
 * refused with a message, per section 16, because the prebuilt sharp on
 * Hostinger cannot decode it.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type ProcessedFile =
  | { kind: "image"; mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp"; data: Buffer; thumb: Buffer }
  | { kind: "svg"; mime: "image/svg+xml"; ext: "svg"; data: Buffer; thumb: Buffer | null }
  | { kind: "pdf"; mime: "application/pdf"; ext: "pdf"; data: Buffer; thumb: null };

export type ProcessResult = { ok: true; file: ProcessedFile } | { ok: false; reason: "too_large" | "type" | "heic" | "bad_image" | "bad_svg" };

export const REASON_TEXT: Record<Exclude<ProcessResult, { ok: true }>["reason"], string> = {
  too_large: "That file is over 10 MB.",
  type: "Only photos (jpg, png, webp), SVG and PDF.",
  heic: "That is a HEIC photo, which we cannot read here. Send it as a JPG. On an iPhone, Settings, Camera, Formats, Most Compatible.",
  bad_image: "That image could not be read.",
  bad_svg: "That SVG could not be read.",
};

export async function processUpload(input: Buffer): Promise<ProcessResult> {
  if (input.length > MAX_FILE_BYTES) return { ok: false, reason: "too_large" };
  if (input.length === 0) return { ok: false, reason: "type" };

  const detected = await fileTypeFromBuffer(input);
  if (detected) {
    const m = detected.mime;
    if (m === "image/heic" || m === "image/heif" || m === "image/heic-sequence" || m === "image/heif-sequence") {
      return { ok: false, reason: "heic" };
    }
    if (m === "image/jpeg" || m === "image/png" || m === "image/webp") return reencode(input, m);
    if (m === "application/pdf") return { ok: true, file: { kind: "pdf", mime: "application/pdf", ext: "pdf", data: input, thumb: null } };
    return { ok: false, reason: "type" };
  }
  if (looksLikeSvg(input)) return sanitiseSvg(input);
  return { ok: false, reason: "type" };
}

async function reencode(input: Buffer, mime: "image/jpeg" | "image/png" | "image/webp"): Promise<ProcessResult> {
  try {
    // .rotate() applies EXIF orientation, then no withMetadata() means every
    // EXIF, ICC and XMP block is dropped from the output.
    const base = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
    let data: Buffer;
    let ext: "jpg" | "png" | "webp";
    if (mime === "image/jpeg") { data = await base.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer(); ext = "jpg"; }
    else if (mime === "image/png") { data = await base.clone().png({ compressionLevel: 8 }).toBuffer(); ext = "png"; }
    else { data = await base.clone().webp({ quality: 88 }).toBuffer(); ext = "webp"; }
    const thumb = await base.clone().resize(320, 320, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
    return { ok: true, file: { kind: "image", mime, ext, data, thumb } };
  } catch {
    return { ok: false, reason: "bad_image" };
  }
}

function looksLikeSvg(input: Buffer): boolean {
  const head = input.subarray(0, 512).toString("utf8").replace(/^﻿/, "").trimStart();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && /<svg[\s>]/.test(input.subarray(0, 4096).toString("utf8")));
}

const BANNED_ELEMENTS = new Set(["script", "foreignobject", "iframe", "embed", "object", "audio", "video", "handler", "listener", "set"]);

function safeHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.startsWith("#") || v.startsWith("data:image/png") || v.startsWith("data:image/jpeg") || v.startsWith("data:image/webp");
}

/** Removes scripts, event handlers and every external reference. */
export function sanitiseSvg(input: Buffer): ProcessResult {
  let doc;
  try {
    const parser = new DOMParser({ onError: () => { throw new Error("bad svg"); } });
    doc = parser.parseFromString(input.toString("utf8"), "image/svg+xml");
  } catch {
    return { ok: false, reason: "bad_svg" };
  }
  const root = doc.documentElement;
  if (!root || (root.localName ?? "").toLowerCase() !== "svg") return { ok: false, reason: "bad_svg" };

  const walk = (el: XElement) => {
    const children = Array.from(el.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) {
        const ce = child as XElement;
        const name = (ce.localName ?? "").toLowerCase();
        if (BANNED_ELEMENTS.has(name)) { el.removeChild(child); continue; }
        if (name === "style") {
          const css = ce.textContent ?? "";
          if (/url\s*\(|@import|expression\s*\(/i.test(css)) { el.removeChild(child); continue; }
        }
        for (const attr of Array.from(ce.attributes)) {
          const an = attr.name.toLowerCase();
          const av = attr.value;
          if (an.startsWith("on")) { ce.removeAttribute(attr.name); continue; }
          if (an === "href" || an === "xlink:href" || an.endsWith(":href")) {
            if (!safeHref(av)) { ce.removeAttribute(attr.name); continue; }
            if (name === "use" && !av.trim().startsWith("#")) { ce.removeAttribute(attr.name); continue; }
          }
          if (an === "style" && /url\s*\(|expression\s*\(|javascript:/i.test(av)) { ce.removeAttribute(attr.name); continue; }
          if (/url\s*\(\s*['"]?\s*(https?:|\/\/)/i.test(av)) { ce.removeAttribute(attr.name); continue; }
        }
        walk(ce);
      } else if (child.nodeType === 7 || child.nodeType === 10) {
        el.removeChild(child);
      }
    }
  };
  walk(root);
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const out = Buffer.from(new XMLSerializer().serializeToString(doc), "utf8");
  return { ok: true, file: { kind: "svg", mime: "image/svg+xml", ext: "svg", data: out, thumb: null } };
}

/** A raster thumbnail for an SVG, when sharp can rasterise it. */
export async function svgThumb(svg: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(svg, { density: 144 }).resize(320, 320, { fit: "contain", background: "#1b1715" }).jpeg({ quality: 78 }).toBuffer();
  } catch {
    return null;
  }
}
