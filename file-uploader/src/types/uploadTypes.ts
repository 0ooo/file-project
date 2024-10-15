export interface UploadState {
  uploadId: string;
  fileName: string;
  fileSize: number;
  uploadedChunks: number[];
}

export interface Chunk {
  chunk: Blob;
  index: number;
}
