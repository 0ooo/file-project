import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UploadState {
  uploadProgress: number;
  uploading: boolean;
  error: string | null;
  filesUpdated: boolean;
}

const initialState: UploadState = {
  uploadProgress: 0,
  uploading: false,
  error: null,
  filesUpdated: false,
};

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    setUploadProgress(state, action: PayloadAction<number>) {
      state.uploadProgress = action.payload;
    },
    setUploading(state, action: PayloadAction<boolean>) {
      state.uploading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setFilesUpdated(state, action: PayloadAction<boolean>) {
      state.filesUpdated = action.payload;
    },
  },
});

export const { setUploadProgress, setUploading, setFilesUpdated, setError } =
  uploadSlice.actions;

export default uploadSlice.reducer;
