import React from 'react';
import { Listing } from '../types';

interface ListingDetailsProps {
  listing: Listing;
  onClose: () => void;
}

const ListingDetails: React.FC<ListingDetailsProps> = ({ listing, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-in slide-in-from-bottom duration-500 sm:animate-none sm:fade-in">
      {/* Mobile-first Header: Back Button Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 z-20 bg-gradient-to-b from-black/50 to-transparent flex justify-between items-start pointer-events-none">
        <button 
          onClick={onClose}
          className="pointer-events-auto bg-white/90 hover:bg-white text-slate-900 p-2 rounded-full shadow-lg backdrop-blur-md transition-all active:scale-95"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        
        <div className="flex gap-2 pointer-events-auto">
          <button className="bg-white/90 hover:bg-white text-slate-900 p-2 rounded-full shadow-lg backdrop-blur-md transition-all active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
             </svg>
          </button>
          <button className="bg-white/90 hover:bg-white text-slate-900 p-2 rounded-full shadow-lg backdrop-blur-md transition-all active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
             </svg>
          </button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="w-full h-72 sm:h-96 md:h-[500px] relative">
         <img 
            src={listing.imageUrls[0]} 
            alt={listing.name} 
            className="w-full h-full object-cover"
         />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 pb-32">
        {/* Header Info */}
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 leading-tight">{listing.name}</h1>
            <p className="text-slate-500 text-lg flex items-center">
                <span className="font-semibold text-slate-900 mr-2">{listing.type}</span> 
                • {listing.address}
            </p>
        </div>

        <div className="flex gap-6 border-b border-slate-100 pb-6 mb-6">
            <div className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-3 w-24">
                <span className="text-2xl font-bold text-slate-800">{listing.bedrooms}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Bedrooms</span>
            </div>
            <div className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-3 w-24">
                <span className="text-2xl font-bold text-slate-800">{listing.size}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wide">m²</span>
            </div>
            <div className="flex flex-col items-center justify-center border border-slate-200 rounded-xl p-3 w-24">
                 <span className={`text-xl font-bold ${listing.energyClass.startsWith('A') ? 'text-green-600' : 'text-slate-800'}`}>{listing.energyClass}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wide">EPC</span>
            </div>
        </div>

        {/* Host Info (Mock) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-lg">E</div>
                <div>
                    <h3 className="font-bold text-slate-900">Hosted by Eburon</h3>
                    <p className="text-sm text-slate-500">Superhost • Response rate: 100%</p>
                </div>
            </div>
            <button className="text-indigo-600 border border-indigo-200 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-indigo-50 transition-colors">
                Contact Host
            </button>
        </div>

        {/* Description */}
        <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">About this place</h2>
            <p className="text-slate-600 leading-relaxed text-lg">
                {listing.description}
                <br/><br/>
                Located in a prime area, this property offers excellent connectivity to public transport and local amenities. Perfect for those who value both comfort and convenience.
            </p>
        </div>

        {/* Amenities */}
        <div className="mb-8 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">What this place offers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-slate-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                    <span>Kitchen</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" /></svg>
                    <span>Fast Wifi</span>
                </div>
                {listing.petsAllowed && (
                    <div className="flex items-center gap-3 text-slate-600">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" /></svg>
                        <span>Pets allowed</span>
                    </div>
                )}
                <div className="flex items-center gap-3 text-slate-600">
                     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.67.38m-4.5-8.006c-1.558.058-3.149.088-4.773.088-1.623 0-3.215-.03-4.773-.088m9.546.088c-.68.05-1.37.08-2.069.08-1.041 0-2.053-.045-3.033-.11m3.84 8.03c.581.084 1.162.15 1.745.195m0 0a2.18 2.18 0 0 0 1.66-2.18v-4.25m-1.66 2.18a2.18 2.18 0 0 1-1.745-.196m0 0c-.58.128-1.187.23-1.802.3m3.547-2.476v4.652m-13.63 0c-.25-.085-.476-.215-.67-.38m0 0V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m-4.5 8.006c.581.084 1.162.15 1.745.195m0 0a2.18 2.18 0 0 1 1.66-2.18v-4.25m-1.66 2.18a2.18 2.18 0 0 0-1.745-.196m0 0c.58.128 1.187.23 1.802.3" /></svg>
                     <span>Washer</span>
                </div>
            </div>
        </div>
      </div>

      {/* Sticky Footer for Action */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 px-6 flex justify-between items-center z-40 safe-bottom pb-8 sm:pb-4">
         <div>
            <p className="text-lg font-bold text-slate-900">€{listing.price}<span className="text-slate-500 text-sm font-normal"> / month</span></p>
            <p className="text-xs text-slate-500 underline">Available now</p>
         </div>
         <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95">
             Reserve
         </button>
      </div>
    </div>
  );
};

export default ListingDetails;