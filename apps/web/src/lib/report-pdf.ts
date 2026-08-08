/**
 * Client-side PDF capture + WhatsApp file sharing for lab documents.
 *
 * `wa.me` links can only carry text — they can never attach a file. To deliver
 * the actual PDF report over WhatsApp without any API key, we rasterize the
 * already-rendered print document (the same one the /print routes show) into
 * a multi-page A4 PDF, then hand the file to the native share sheet via the
 * Web Share API — the staff tap WhatsApp in the sheet and the PDF is sent.
 *
 * `jspdf` and `html-to-image` are imported lazily so they live in their own
 * chunks and never touch the main bundle.
 */

export type PdfShareResult = "shared" | "dismissed" | "unsupported";

/** True when the browser can attach files to the native share sheet. */
export function canSharePdf(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") {
    return false;
  }
  try {
    return navigator.canShare({
      files: [new File([new Uint8Array([0])], "probe.pdf", { type: "application/pdf" })],
    });
  } catch {
    return false;
  }
}

/**
 * Rasterize a DOM node (the report/invoice document) into a multi-page A4 PDF.
 * The image is sliced at A4-page height so long documents flow across pages.
 */
export async function generateDocumentPdf(element: HTMLElement): Promise<Blob> {
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  // Make sure webfonts are settled before rasterizing (avoids clipped text).
  try {
    await document.fonts?.ready;
  } catch {
    // Non-fatal — proceed with whatever is loaded.
  }

  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: false,
  });

  const pageWidthMm = 210; // A4 portrait
  const pageHeightMm = 297;
  const imgWidthMm = pageWidthMm;
  const imgHeightMm = (element.offsetHeight * imgWidthMm) / element.offsetWidth;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  let remaining = imgHeightMm;
  let position = 0;
  pdf.addImage(dataUrl, "PNG", 0, position, imgWidthMm, imgHeightMm, undefined, "FAST");
  remaining -= pageHeightMm;

  while (remaining > 0) {
    position -= pageHeightMm;
    pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, position, imgWidthMm, imgHeightMm, undefined, "FAST");
    remaining -= pageHeightMm;
  }

  return pdf.output("blob");
}

/**
 * Share a PDF via the native share sheet (staff pick WhatsApp). Throws with
 * `share-unsupported` when the browser cannot attach files, so callers can
 * fall back to the wa.me text link.
 */
export async function sharePdfViaWhatsApp(
  blob: Blob,
  fileName: string,
  shareText?: string,
): Promise<PdfShareResult> {
  if (!canSharePdf()) return "unsupported";

  const file = new File([blob], fileName, { type: "application/pdf" });
  try {
    await navigator.share({ files: [file], ...(shareText ? { text: shareText } : {}) });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return "dismissed"; // User closed the share sheet — not an error.
    }
    throw e;
  }
}
