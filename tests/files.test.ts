import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processUpload } from "@/lib/files";

describe("uploads, INTAKE-SPEC section 4 and 14", () => {
  it("refuses an exe renamed to jpg, by bytes not by name", async () => {
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(600, 0x90)]);
    const r = await processUpload(exe);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("type");
  });

  it("strips EXIF, including GPS, from a jpg", async () => {
    const withGps = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#e08536" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "test", Software: "test" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 58/1 0/1" } })
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();
    const r = await processUpload(withGps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.kind).toBe("image");
    const meta = await sharp(r.file.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("jpeg");
  });

  it("removes scripts, handlers and external references from an SVG", async () => {
    const svg = Buffer.from(`<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
  <script>alert(2)</script>
  <style>@import url(https://evil.example/x.css); .a{fill:red}</style>
  <image xlink:href="https://evil.example/track.png" width="1" height="1"/>
  <use xlink:href="https://evil.example/x.svg#a"/>
  <a href="javascript:alert(3)"><rect width="10" height="10" onclick="alert(4)" fill="#e08536"/></a>
  <foreignObject><div>hi</div></foreignObject>
</svg>`);
    const r = await processUpload(svg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.file.data.toString("utf8");
    expect(r.file.kind).toBe("svg");
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onload|onclick/i);
    expect(out).not.toMatch(/evil\.example/);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/foreignObject/i);
    expect(out).toMatch(/<rect/);
  });

  it("refuses HEIC with the HEIC reason", async () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(64, 0)]);
    const r = await processUpload(heic);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("heic");
  });

  it("keeps a PDF as it is", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    const r = await processUpload(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.kind).toBe("pdf");
  });
});
