import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HardDrive, LogIn, Search, File, ExternalLink, Loader2 } from 'lucide-react';

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
}

interface GoogleDrivePickerProps {
  onSelect: (file: DriveFile) => void;
}

export default function GoogleDrivePicker({ onSelect }: GoogleDrivePickerProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/google/status');
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) {
        fetchFiles();
      }
    } catch (err) {
      console.error('Error checking auth status', err);
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/drive/files');
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response from server');
      }
      setFiles(data);
    } catch (err: any) {
      console.error('Error fetching Drive files:', err);
      setError(err.message || 'Failed to fetch files from Google Drive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview, Vercel, or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.endsWith('.vercel.app') && !origin.includes('localhost')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        fetchFiles();
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    setError('');
    // Open window immediately to avoid popup blockers
    const authWindow = window.open('about:blank', 'google_oauth', 'width=600,height=700');
    
    if (!authWindow) {
      setError('Popup blocked. Please allow popups for this site to authorize Google Drive.');
      return;
    }

    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get authorization URL');
      }
      const { url } = await response.json();
      
      if (!url) throw new Error('Authorization URL is missing');
      
      authWindow.location.href = url;
    } catch (err: any) {
      console.error('Error connecting to Google Drive:', err);
      setError(err.message || 'Failed to connect to Google Drive. Check server logs.');
      authWindow.close();
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          <HardDrive className="w-8 h-8 text-luxury-gold" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-serif text-white">Connect Google Drive</h3>
          <p className="text-xs text-white/40 max-w-xs mx-auto font-light tracking-wide">
            Seamlessly link large files ({'>'}700KB) directly from your Google Drive archive.
          </p>
        </div>
        <button
          onClick={handleConnect}
          className="luxury-button bg-white text-luxury-black font-medium flex items-center gap-2 px-8 py-3 rounded-full hover:scale-105 transition-all"
        >
          <LogIn className="w-4 h-4" />
          Authorize Access
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <input
          type="text"
          placeholder="Search your Drive..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:border-luxury-gold outline-none transition-all text-sm font-light tracking-wide placeholder:text-white/10"
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-luxury-gold animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400 text-xs font-light">{error}</div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-xs font-light">No files found</div>
        ) : (
          filteredFiles.map((file) => (
            <motion.button
              key={file.id}
              whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
              onClick={() => onSelect(file)}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/5 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                  <img src={file.iconLink} alt="" className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <div className="text-sm text-white/80 group-hover:text-white transition-colors truncate max-w-[200px]">
                    {file.name}
                  </div>
                  <div className="text-[10px] text-white/20 font-light uppercase tracking-widest">
                    {file.size ? `${(parseInt(file.size) / 1024 / 1024).toFixed(1)} MB` : 'Size unknown'}
                  </div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-white/10 group-hover:text-luxury-gold transition-colors" />
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}
