import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Material } from '../types';
import MaterialCard from './MaterialCard';
import AuthorProfileModal from './AuthorProfileModal';
import { Search, Filter, Lock } from 'lucide-react';

export default function MaterialList() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{id: string, name: string, photoUrl?: string} | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (!user) {
        setMaterials([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const materialsData: Material[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        materialsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Material);
      });
      setMaterials(materialsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching materials: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-24 glass-panel rounded-3xl">
        <div className="mx-auto h-16 w-16 text-luxury-gold mb-6 border border-luxury-gold/20 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-serif text-white mb-2">Private Collection</h3>
        <p className="text-white/40 font-light tracking-wide max-w-sm mx-auto uppercase text-[10px]">
          Authentication required to access the academic archives.
        </p>
      </div>
    );
  }

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (material.description && material.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (material.tags && material.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesFilter = filterType === 'all' || material.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border border-luxury-gold/30 rounded-full border-t-luxury-gold animate-spin"></div>
          <span className="text-luxury-gold/50 text-[10px] uppercase tracking-widest">Loading Archives</span>
        </div>
      </div>
    );
  }

  const handleAuthorClick = (id: string, name: string, photoUrl?: string) => {
    setSelectedProfile({ id, name, photoUrl });
    setIsProfileModalOpen(true);
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row gap-8 justify-between items-center border-b border-white/5 pb-8">
        <div className="relative w-full sm:w-96 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-white/20 group-focus-within:text-luxury-gold transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search the archive..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-12 pr-4 py-3 bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-sm placeholder:text-white/20"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">Filter by</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent border-b border-white/10 focus:border-luxury-gold outline-none py-2 px-2 text-sm font-light tracking-wide cursor-pointer transition-all appearance-none min-w-[120px]"
          >
            <option value="all" className="bg-luxury-black">All Collections</option>
            <option value="pdf" className="bg-luxury-black">Manuscripts (PDF)</option>
            <option value="word" className="bg-luxury-black">Documents (Word)</option>
            <option value="canva" className="bg-luxury-black">Presentations</option>
            <option value="link" className="bg-luxury-black">External Links</option>
            <option value="other" className="bg-luxury-black">Miscellaneous</option>
          </select>
        </div>
      </div>

      {filteredMaterials.length === 0 ? (
        <div className="text-center py-32 border border-white/5 rounded-3xl">
          <div className="mx-auto h-12 w-12 text-white/10 mb-6">
            <Search className="w-full h-full" />
          </div>
          <h3 className="text-xl font-serif text-white/60">No entries found in this section</h3>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/20">
            {searchTerm || filterType !== 'all' 
              ? "Adjust your parameters to broaden the search." 
              : "The archive is currently empty."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredMaterials.map((material) => (
            <MaterialCard 
              key={material.id} 
              material={material} 
              onAuthorClick={handleAuthorClick}
            />
          ))}
        </div>
      )}

      {selectedProfile && (
        <AuthorProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          authorName={selectedProfile.name}
          authorPhotoUrl={selectedProfile.photoUrl}
          materials={materials.filter(m => m.authorId === selectedProfile.id)}
        />
      )}
    </div>
  );
}
