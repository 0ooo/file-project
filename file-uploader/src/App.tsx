import React from 'react';
import { Layout } from 'antd';
import FileUpload from './components/FileUpload';
import FileList from './components/FileList';

const { Header, Content, Footer } = Layout;

const App: React.FC = () => {
  return (
    <Layout>
      <Header style={{ color: '#fff' }}>File Uploader</Header>
      <Content style={{ padding: '50px' }}>
        <FileUpload />
        <div style={{ marginTop: '50px' }}>
          <FileList />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>© 2024 File Uploader App</Footer>
    </Layout>
  );
};

export default App;
