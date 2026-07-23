import React from 'react';
import FTPImportWizard from '../components/import/FTPImportWizard';
import CSVUploadWithMapping from '../components/import/CSVUploadWithMapping';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Settings } from 'lucide-react';

const Import: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Data Import</h1>
            <p className="text-muted-foreground">
              Import vehicle data from CSV files or external systems via FTP/SFTP
            </p>
          </div>
        </div>

        <Tabs defaultValue="csv-upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="csv-upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Direct CSV Upload</span>
            </TabsTrigger>
            <TabsTrigger value="ftp-sftp" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>FTP/SFTP Import Wizard</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv-upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">Direct CSV Upload</h2>
                <p className="text-muted-foreground">
                  Upload CSV files directly and map fields to your database
                </p>
              </div>
              <CSVUploadWithMapping />
            </div>
          </TabsContent>

          <TabsContent value="ftp-sftp" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">FTP/SFTP Import Wizard</h2>
                <p className="text-muted-foreground">
                  Step-by-step wizard for importing data from FTP/SFTP servers
                </p>
              </div>
              <FTPImportWizard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Import; 