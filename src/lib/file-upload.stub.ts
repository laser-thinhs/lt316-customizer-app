export type UploadResult = {
  mimeType: string;
  filePath: string;
  widthPx?: number;
  heightPx?: number;
};

export async function normalizeUploadStub(): Promise<UploadResult> {
  // Layer 1 stub only. Real pipeline comes in Layer 2.
  return {
    mimeType: "image/svg+xml",
    filePath: "/stub/uploads/not-implemented.svg"
  };
}
