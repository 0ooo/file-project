import React, { useEffect, useState } from 'react';
import { List, Button, message } from 'antd';
import axios from 'axios';
import { useAppSelector, useAppDispatch } from '../hooks';
import { setFilesUpdated } from '../store/uploadSlice';
import { FileItem } from '../types/listTypes';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3002';

const API_GET_FILES = `${SERVER_URL}/files`;
const API_DOWNLOAD_FILE = `${SERVER_URL}/download`;

const FileList: React.FC = () => {
  const dispatch = useAppDispatch();
  const [files, setFiles] = useState<FileItem[]>([]);
  const { filesUpdated } = useAppSelector((state) => state.upload);

  const fetchFiles = async () => {
    try {
      const response = await axios.get<FileItem[]>(API_GET_FILES);
      setFiles(response.data);

      dispatch(setFilesUpdated(false));
    } catch (error) {
      console.error('Ошибка при получении списка файлов:', error);
      message.error('Не удалось получить список файлов');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [filesUpdated]);

  const downloadFile = async (filename: string) => {
    try {
      const response = await axios.get(`${API_DOWNLOAD_FILE}/${filename}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error);
      message.error('Ошибка при скачивании файла');
    }
  };

  return (
    <List
      header={<div>Загруженные файлы</div>}
      bordered
      dataSource={files}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button type="link" onClick={() => downloadFile(item.name)}>
              Скачать
            </Button>,
          ]}
        >
          {item.name} -{' '}
          {item.size ? (item.size / 1024 / 1024).toFixed(2) : '0.00'} MB -
          Последнее изменение: {new Date(item.lastModified).toLocaleString()}
        </List.Item>
      )}
    />
  );
};

export default FileList;
