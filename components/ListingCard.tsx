import React, { useState } from 'react';
import { Listing } from '../types';

interface ListingCardProps {
  listing: Listing;
  onClick?: (listing: Listing) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing, onClick }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  return (
    <div 
      onClick={() => onClick && onClick(listing)}
      className="flex-shrink-0 w-80 bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 hover:shadow-xl transition-all duration-300 snap-start cursor-pointer hover:scale-[1.02] active:scale-95 group"
    >
      <div className="relative h-48 w-full bg-slate-200 overflow-hidden">
        {/* Skeleton for Image */}
        <div className={`absolute inset-0 bg-slate-200 animate-pulse z-0 ${isImageLoaded ? 'hidden' : 'block'}`} />
        
        <img 
          src={listing.imageUrls[0]} 
          alt={listing.name} 
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-slate-900 shadow-sm z-10">
          €{listing.price}/mo
        </div>
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-medium text-white shadow-sm z-10">
          {listing.type}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
           <h3 className="font-bold text-slate-900 leading-tight line-clamp-1 group-hover:text-indigo-600 transition-colors">{listing.name}</h3>
        </div>
        
        <div className="flex items-center text-slate-500 text-sm mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1 text-slate-400">
            <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.625a19.08 19.08 0 002.274 1.765c.311.193.571.337.757.433.092.047.186.094.281.14l.018.008.006.003.002.001zM10 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
          </svg>
          <span className="truncate">{listing.address}</span>
        </div>
        
        <div className="flex items-center gap-3 text-xs font-medium text-slate-600 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1">
             <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{listing.size} m²</span>
          </div>
          <div className="flex items-center gap-1">
             <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{listing.bedrooms} Beds</span>
          </div>
          {listing.petsAllowed && (
             <div className="flex items-center gap-1">
                <span className="bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded flex items-center gap-1" title="Pets Allowed">
                    🐾 Pets
                </span>
             </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
             <span className={`px-2 py-0.5 rounded border ${listing.energyClass === 'A' || listing.energyClass === 'A+' ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                EPC {listing.energyClass}
             </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingCard;