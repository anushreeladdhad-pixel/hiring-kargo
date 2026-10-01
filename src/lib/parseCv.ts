import path from 'path';

// pdf.js tries to dynamically import its worker script using a relative
// path it computes at runtime ("./pdf.worker.mjs"), which Next.js's
// serverless bundler can't trace statically — the worker file silently
// doesn't make it into the deployed function, producing
// "Setting up fake worker failed: Cannot find module ...". Pointing
// GlobalWorkerOptions at the real on-disk path fixes this. pdfjs-dist is
// kept external (see next.config.mjs serverComponentsExternalPackages),
// so it's deployed as a plain node_modules folder — built from
// process.cwd() rather than require.resolve(), since webpack statically
// rewrites any literal `require.resolve(...)` call it sees at build time
// (even through a rebound `require`), which breaks on this ESM-only file.
const PDFJS_WORKER_SRC = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);

/**
 * Extracts text from a PDF using pdfjs-dist directly (actively maintained),
 * with xref-recovery enabled so a damaged/non-standard cross-reference
 * table doesn't hard-fail the whole upload.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Use the legacy Node build — the standard build assumes a browser/worker
  // environment that doesn't exist server-side.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Let pdf.js scan and rebuild the xref table instead of throwing when
    // it's damaged or non-standard, rather than failing the whole parse.
    stopAtErrors: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  await doc.destroy();
  return pages.join('\n\n');
}

/**
 * Extracts plain text from an uploaded CV file (.docx or .pdf). Mixed
 * formats are expected per the case brief ("Sixty CVs ... Mixed formats").
 */
export async function extractCvText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (ext === 'pdf') {
    try {
      return await extractPdfText(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `This PDF couldn't be read (it may be corrupted or exported in an ` +
          `unusual way). Try re-opening it and saving/exporting a fresh ` +
          `copy, then re-upload. [${message}]`
      );
    }
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8');
  }

  throw new Error(
    `Unsupported CV file type ".${ext}". Supported: .docx, .pdf, .txt`
  );
}
