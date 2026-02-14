export type UploadResult = {
  key: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  originalName: string;
};

export interface StorageProvider {
  upload(params: {
    filename: string;
    contentType: string;
    buffer: Buffer;
  }): Promise<UploadResult>;
}
