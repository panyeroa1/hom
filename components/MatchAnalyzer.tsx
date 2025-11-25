import React, { useState } from 'react';
import { analyzeMatchWithThinking } from '../services/gemini';

const MatchAnalyzer: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!resume || !jobDesc) return;
    setLoading(true);
    setAnalysis('');
    try {
      const result = await analyzeMatchWithThinking(resume, jobDesc);
      setAnalysis(result || "No analysis returned.");
    } catch (error) {
      console.error(error);
      setAnalysis("Error running analysis. Please check your API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-600">
             <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
           </svg>
           Smart Match Analysis
           <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium ml-2">Thinking Model</span>
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Use our advanced reasoning AI to check if you're a good fit for a role.
        </p>
      </div>
      
      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Paste Resume Text</label>
            <textarea
              className="w-full h-40 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              placeholder="Experience: 5 years in React..."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Paste Job Description</label>
            <textarea
              className="w-full h-40 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
              placeholder="We are looking for a Senior Frontend Engineer..."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !resume || !jobDesc}
            className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
          >
            {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Thinking...
                </>
            ) : "Analyze Match"}
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 h-full min-h-[400px] overflow-y-auto">
             <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Analysis Result</h4>
             {analysis ? (
                 <div className="prose prose-sm prose-slate max-w-none">
                     <div className="whitespace-pre-wrap">{analysis}</div>
                 </div>
             ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2 opacity-50">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                     </svg>
                     <p>Results will appear here</p>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
};

export default MatchAnalyzer;
