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
    const pdfParse = (await import('pdf-parse')).default;
    const { text } = await pdfParse(buffer);
    return text;
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8');
  }

  throw new Error(
    `Unsupported CV file type ".${ext}". Supported: .docx, .pdf, .txt`
  );
}
