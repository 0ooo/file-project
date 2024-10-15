import React, { useState, useEffect } from 'react';
import { Upload, Button, message, Progress, UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  setUploadProgress,
  setUploading,
  setError,
  setFilesUpdated,
} from '../store/uploadSlice';
import crc32 from 'crc-32';
import { UploadState, Chunk } from '../types/uploadTypes';

const CHUNK_SIZE_MB = parseInt(process.env.REACT_APP_CHUNK_SIZE || '100');
const CHUNK_SIZE = CHUNK_SIZE_MB * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = parseInt(
  process.env.REACT_APP_MAX_CONCURRENT_UPLOADS || '3'
);
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3002';

const API_UPLOAD_STATUS = `${SERVER_URL}/upload-status`;
const API_UPLOAD_CHUNK = `${SERVER_URL}/upload-chunk`;
const API_UPLOAD_COMPLETE = `${SERVER_URL}/upload-complete`;
const API_PING = `${SERVER_URL}/ping`;

const FileUpload: React.FC = () => {
  const dispatch = useAppDispatch();
  const { uploadProgress, uploading, error } = useAppSelector(
    (state) => state.upload
  );

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [checkServerIntervalId, setCheckServerIntervalId] =
    useState<NodeJS.Timeout | null>(null);

  const handleChange = (info: any) => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-1);
    setFileList(newFileList);

    setIsPaused(false);
    dispatch(setUploading(false));
    dispatch(setUploadProgress(0));
    dispatch(setError(null));
  };

  useEffect(() => {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      const uploadStateJson = localStorage.getItem(key);
      if (uploadStateJson) {
        const uploadState: UploadState = JSON.parse(uploadStateJson);
        if (
          uploadState.uploadId &&
          uploadState.uploadedChunks.length <
            Math.ceil(uploadState.fileSize / CHUNK_SIZE)
        ) {
          message.info(
            `Обнаружена незавершенная загрузка файла "${uploadState.fileName}". Пожалуйста, выберите этот файл для продолжения загрузки.`
          );
        }
      }
    });
  }, []);

  const uploadFile = async () => {
    if (fileList.length === 0) {
      message.error('Пожалуйста, выберите файл для загрузки');
      return;
    }

    const uploadFile = fileList[0];
    const file = uploadFile.originFileObj as File;

    if (!file) {
      message.error('Файл отсутствует');
      return;
    }

    dispatch(setUploading(true));
    dispatch(setError(null));

    const uploadId = `${file.name}-${file.size}`;

    let localUploadStateJson = localStorage.getItem(uploadId);
    let localUploadState: UploadState;
    if (localUploadStateJson) {
      localUploadState = JSON.parse(localUploadStateJson);
    } else {
      localUploadState = {
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        uploadedChunks: [],
      };
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    let errorOccurred = false;
    let activeUploads = 0;
    let chunksQueue: Chunk[] = [];
    let uploadedChunksCount = 0;
    let uploadedChunks: number[] = [];

    try {
      try {
        const response = await axios.get(API_UPLOAD_STATUS, {
          params: {
            uploadId,
          },
        });
        uploadedChunks = response.data.uploadedChunks;
        uploadedChunksCount = uploadedChunks.length;
      } catch (error) {
        console.error('Ошибка при проверке статуса загрузки:', error);
        uploadedChunks = localUploadState.uploadedChunks || [];
        uploadedChunksCount = uploadedChunks.length;
      }

      for (
        let start = 0, index = 0;
        start < file.size;
        start += CHUNK_SIZE, index++
      ) {
        const end = Math.min(start + CHUNK_SIZE, file.size);

        if (uploadedChunks.includes(index)) {
          console.log(`Чанк ${index} уже загружен, пропускаем...`);
          continue;
        }

        const chunk = file.slice(start, end);
        chunksQueue.push({ chunk, index });
      }

      const uploadNextChunk = async () => {
        if (errorOccurred || isPaused) {
          return;
        }

        if (chunksQueue.length === 0) {
          if (activeUploads === 0) {
            await completeUpload();
          }
          return;
        }

        const { chunk, index } = chunksQueue.shift()!;
        activeUploads++;

        try {
          const chunkArrayBuffer = await chunk.arrayBuffer();
          const chunkUint8Array = new Uint8Array(chunkArrayBuffer);
          const chunkCRC = (crc32.buf(chunkUint8Array) >>> 0).toString(16);

          const formData = new FormData();
          formData.append('chunk', new Blob([chunkArrayBuffer]));
          formData.append('originalFilename', file.name);
          formData.append('chunkIndex', index.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('uploadId', uploadId);
          formData.append('chunkCRC', chunkCRC);

          await axios.post(API_UPLOAD_CHUNK, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          uploadedChunksCount++;
          const progress = Math.floor(
            (uploadedChunksCount / totalChunks) * 100
          );
          dispatch(setUploadProgress(progress));

          uploadedChunks.push(index);
          localUploadState.uploadedChunks = uploadedChunks;
          localStorage.setItem(uploadId, JSON.stringify(localUploadState));
        } catch (error) {
          console.error(`Ошибка при загрузке чанка ${index}:`, error);
          message.error(`Ошибка при загрузке чанка ${index}`);

          chunksQueue.unshift({ chunk, index });

          errorOccurred = true;
          setIsPaused(true);
          startCheckingServer();

          dispatch(setUploading(false));
          dispatch(setError(`Ошибка при загрузке чанка ${index}`));

          return;
        } finally {
          activeUploads--;
          if (!errorOccurred && !isPaused) {
            uploadNextChunk();
          }
        }
      };

      const startCheckingServer = () => {
        if (checkServerIntervalId) {
          return;
        }

        const intervalId = setInterval(async () => {
          try {
            await axios.get(API_PING);
            clearInterval(intervalId);
            setCheckServerIntervalId(null);
            setIsPaused(false);
            errorOccurred = false;
            message.success(
              'Соединение с сервером восстановлено. Продолжаем загрузку.'
            );
            dispatch(setUploading(true));
            dispatch(setError(null));

            const uploadsToStart = Math.min(
              MAX_CONCURRENT_UPLOADS - activeUploads,
              chunksQueue.length
            );

            for (let i = 0; i < uploadsToStart; i++) {
              uploadNextChunk();
            }
          } catch (error) {
            console.log('Сервер недоступен, продолжаем проверку...');
          }
        }, 5000);

        setCheckServerIntervalId(intervalId);
      };

      const completeUpload = async () => {
        try {
          await axios.post(API_UPLOAD_COMPLETE, {
            originalFilename: file.name,
            totalChunks,
            uploadId,
          });

          message.success('Файл успешно загружен и собран на сервере');
          dispatch(setUploadProgress(100));

          localStorage.removeItem(uploadId);

          dispatch(setUploading(false));

          setFileList([]);
          dispatch(setUploadProgress(0));
          dispatch(setFilesUpdated(true));
        } catch (error) {
          console.error('Ошибка при сборке файла:', error);
          message.error('Ошибка при сборке файла');
          dispatch(setError('Ошибка при сборке файла'));
        }
      };

      const uploadsToStart = Math.min(
        MAX_CONCURRENT_UPLOADS,
        chunksQueue.length
      );
      for (let i = 0; i < uploadsToStart; i++) {
        uploadNextChunk();
      }
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      message.error('Ошибка при загрузке файла');
      dispatch(setError('Ошибка при загрузке файла'));
    } finally {
      if (
        !isPaused &&
        !errorOccurred &&
        chunksQueue.length === 0 &&
        activeUploads === 0
      ) {
        dispatch(setUploading(false));
      }
    }
  };

  const cancelUpload = () => {
    if (checkServerIntervalId) {
      clearInterval(checkServerIntervalId);
      setCheckServerIntervalId(null);
    }

    setIsPaused(false);
    dispatch(setUploading(false));
    dispatch(setUploadProgress(0));
    setFileList([]);
    localStorage.clear();
    message.info('Загрузка отменена пользователем.');
  };

  const getUploadButtonText = () => {
    if (uploading) {
      return 'Загрузка...';
    } else if (isPaused) {
      return 'Продолжить загрузку';
    } else {
      return 'Загрузить';
    }
  };

  return (
    <div>
      <Upload
        onChange={handleChange}
        beforeUpload={() => false}
        fileList={fileList}
        multiple={false}
        maxCount={1}
        onRemove={() => {
          setFileList([]);
        }}
      >
        <Button icon={<UploadOutlined />}>Выберите файл</Button>
      </Upload>
      {fileList.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            onClick={uploadFile}
            loading={uploading}
            disabled={uploading}
          >
            {getUploadButtonText()}
          </Button>
          <Button
            type="default"
            onClick={cancelUpload}
            disabled={!uploading && !isPaused}
            style={{ marginLeft: 8 }}
          >
            Отменить загрузку
          </Button>
        </div>
      )}
      {uploadProgress > 0 && (
        <Progress percent={uploadProgress} style={{ marginTop: 16 }} />
      )}
      {error && (
        <div style={{ color: 'red', marginTop: 16 }}>Ошибка: {error}</div>
      )}
    </div>
  );
};

export default FileUpload;
