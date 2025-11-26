
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateStrategies, generateCoverImage } from './services/geminiService';
import { CoverResult, StrategyRecommendation, HistoryItem } from './types';
import ResultCard from './components/ResultCard';
import { APP_NAME, APP_TAGLINE } from './constants';

const HISTORY_KEY = 'viral_cover_ai_history';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  
  // Current Session State
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [results, setResults] = useState<CoverResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reference Image State
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null); // Raw base64
  const [refImageMimeType, setRefImageMimeType] = useState<string>('image/png');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open on desktop

  // --- API Key Management ---
  const checkApiKey = useCallback(async () => {
    try {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
        return hasKey;
      }
    } catch (e) {
      console.error("Error checking API key", e);
    }
    return false;
  }, []);

  useEffect(() => {
    checkApiKey();
    loadHistory();
  }, [checkApiKey]);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      await checkApiKey();
    } else {
      alert("AI Studio environment not detected.");
    }
  };

  // --- History Management ---
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const saveHistoryToStorage = (items: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
      setHistory(items);
    } catch (e) {
      console.error("Storage quota exceeded or error", e);
      // Optional: Logic to remove oldest item if quota full, but for now just logging.
      setError("本地存储空间已满，部分历史记录可能未保存。");
    }
  };

  const createNewSession = () => {
    setCurrentId(null);
    setTopic('');
    setResults([]);
    setRefImagePreview(null);
    setRefImageBase64(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // On mobile, maybe close sidebar
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const loadSession = (item: HistoryItem) => {
    setCurrentId(item.id);
    setTopic(item.topic);
    setResults(item.results);
    
    if (item.referenceImage) {
      setRefImagePreview(item.referenceImage.preview);
      setRefImageBase64(item.referenceImage.base64);
      setRefImageMimeType(item.referenceImage.mimeType);
    } else {
      setRefImagePreview(null);
      setRefImageBase64(null);
    }
    
    setError(null);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const updateCurrentHistory = (updatedResults: CoverResult[]) => {
    if (!currentId) return;

    const updatedHistory = history.map(item => {
      if (item.id === currentId) {
        return { ...item, results: updatedResults };
      }
      return item;
    });
    saveHistoryToStorage(updatedHistory);
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    saveHistoryToStorage(newHistory);
    if (currentId === id) {
      createNewSession();
    }
  };

  // --- Image Handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { 
        setError("图片大小不能超过 4MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setRefImagePreview(result);
        const matches = result.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          setRefImageMimeType(matches[1]);
          setRefImageBase64(matches[2]);
        }
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearRefImage = () => {
    setRefImagePreview(null);
    setRefImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Generation Logic ---
  const handleRegenerateImage = async (index: number, newPrompt: string) => {
    const newResults = [...results];
    newResults[index] = { 
      ...newResults[index], 
      isGeneratingImage: true, 
      imageError: undefined, 
      finalPrompt: newPrompt 
    };
    setResults(newResults);

    try {
      const refImageObj = refImageBase64 ? { data: refImageBase64, mimeType: refImageMimeType } : undefined;
      const base64Image = await generateCoverImage(newPrompt, refImageObj);
      
      const finishedResults = [...newResults];
      finishedResults[index] = { 
        ...finishedResults[index], 
        generatedImage: base64Image, 
        isGeneratingImage: false 
      };
      setResults(finishedResults);
      updateCurrentHistory(finishedResults);

    } catch (err: any) {
      console.error(`Error regenerating image:`, err);
      const errorResults = [...newResults];
      errorResults[index] = { 
        ...errorResults[index], 
        isGeneratingImage: false, 
        imageError: err.message || "图片生成失败" 
      };
      setResults(errorResults);
      updateCurrentHistory(errorResults);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    const keyReady = await checkApiKey();
    if (!keyReady) {
        await handleSelectKey();
        const recheck = await checkApiKey();
        if(!recheck) return;
    }

    setIsProcessing(true);
    setError(null);
    
    // Create new session ID immediately
    const newSessionId = Date.now().toString();
    setCurrentId(newSessionId);

    try {
      // 1. Generate Strategies
      const strategies: StrategyRecommendation[] = await generateStrategies(topic);

      const initialResults: CoverResult[] = strategies.map(s => ({
        ...s,
        isGeneratingImage: true,
        finalPrompt: `${s.gemini_image_prompt} (重点展示：${s.text_layout_guide.design_note})`
      }));
      setResults(initialResults);
      
      // Save initial state to history
      const newHistoryItem: HistoryItem = {
        id: newSessionId,
        topic: topic,
        timestamp: Date.now(),
        results: initialResults,
        referenceImage: refImagePreview && refImageBase64 ? {
          preview: refImagePreview,
          base64: refImageBase64,
          mimeType: refImageMimeType
        } : null
      };
      // Prepend to history
      const updatedHistory = [newHistoryItem, ...history];
      saveHistoryToStorage(updatedHistory);

      setIsProcessing(false); 

      // 2. Parallel Image Generation
      const refImageObj = refImageBase64 ? { data: refImageBase64, mimeType: refImageMimeType } : undefined;

      const imagePromises = initialResults.map(async (res, idx) => {
        try {
          const promptToUse = res.finalPrompt || res.gemini_image_prompt;
          const base64Image = await generateCoverImage(promptToUse, refImageObj);
          
          setResults(currentPrev => {
             const updated = currentPrev.map((item, i) => 
               i === idx ? { ...item, generatedImage: base64Image, isGeneratingImage: false } : item
             );
             // Update history logic inside the promise chain is tricky due to closures, 
             // but we can update the storage with the *latest* state after all settle, 
             // or update incrementally. For simplicity, we just update local state here 
             // and trigger a history update helper.
             return updated;
          });
        } catch (err: any) {
          console.error(`Error generating image for strategy ${idx + 1}:`, err);
          setResults(currentPrev => currentPrev.map((item, i) => 
            i === idx ? { ...item, isGeneratingImage: false, imageError: err.message || "图片生成失败" } : item
          ));
        }
      });

      await Promise.all(imagePromises);
      
      // Final sync with history after images generated
      // We need to access the latest 'results' state. 
      // Since closures might capture stale state, we use a functional update pattern in setResults usually,
      // but here we need to write to localStorage.
      // A safe way is to just read the current state from the setter or use a ref, 
      // but for this simple app, we can wait a tick or rely on an Effect.
      // Let's manually reconstruct for storage to be safe.
      setResults(finalResults => {
        const finalHistory = updatedHistory.map(h => h.id === newSessionId ? { ...h, results: finalResults } : h);
        saveHistoryToStorage(finalHistory);
        return finalResults;
      });

    } catch (err: any) {
      console.error("Workflow failed", err);
      let errorMessage = err.message || "发生未知错误";
      if (typeof errorMessage === 'string' && errorMessage.includes('{"error"')) {
        try {
          const parsed = JSON.parse(errorMessage.substring(errorMessage.indexOf('{')));
          if (parsed.error) errorMessage = `API Error: ${parsed.error.message}`;
        } catch (e) {}
      }
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Sidebar - History */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 text-slate-300 flex-shrink-0 transition-all duration-300 flex flex-col border-r border-slate-800 relative z-20`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-white tracking-wider">历史记录</span>
          <button onClick={createNewSession} className="p-1.5 hover:bg-slate-700 rounded-lg text-white" title="新会话">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">暂无历史记录</div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id}
                onClick={() => loadSession(item)}
                className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  currentId === item.id ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-200">
                    {item.topic || "无标题"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
                <button 
                   onClick={(e) => deleteHistoryItem(e, item.id)}
                   className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-slate-500 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          Local Storage Storage
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Mobile Sidebar Toggle & Header */}
        <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                 className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                 </svg>
               </button>
               <div className="flex items-center gap-2">
                  <div className="bg-red-500 text-white font-bold p-1 rounded">VC</div>
                  <div>
                    <h1 className="text-sm font-bold text-slate-900 leading-none sm:text-base">{APP_NAME}</h1>
                  </div>
               </div>
            </div>
            
            {!hasApiKey && (
              <button 
                onClick={handleSelectKey}
                className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors"
              >
                API Key
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
           <div className="max-w-4xl mx-auto">
             
             {/* Input Section (Only show large if no results yet, otherwise compact or hidden?) 
                 For simplicity, always keep it at top, but maybe cleaner. 
             */}
             <section className={`mb-10 transition-all duration-500 ${results.length > 0 ? 'opacity-100' : 'min-h-[60vh] flex flex-col justify-center'}`}>
                <div className="text-center mb-6">
                  {results.length === 0 && (
                    <>
                      <h2 className="text-3xl font-bold text-slate-800 mb-3">
                        你的笔记主题是什么？
                      </h2>
                      <p className="text-slate-500 mb-8">
                        输入主题，Gemini 3 Pro 将为你生成高点击率、具有原生感的爆款封面策略。
                      </p>
                    </>
                  )}
                </div>

                <form onSubmit={handleGenerate} className="space-y-4 max-w-2xl mx-auto w-full">
                  <div className="relative">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="例如：'薪资谈判失败' 或 '东京必去的10家咖啡馆'"
                      className="w-full px-6 py-4 rounded-full border-2 border-slate-200 shadow-sm text-lg focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all placeholder:text-slate-300 pr-32"
                      disabled={isProcessing}
                    />
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="absolute right-2 top-2 bottom-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>生成中</span>
                        </>
                      ) : (
                        <>
                          <span>生成策略</span>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 19.742c-.31 1.238 1.409 1.76 2.082.8l5.099-7.284c.487-.696-.065-1.666-.884-1.57l-3.23-.376 1.83-4.526c.453-1.121-1.077-1.782-1.722-.962l-6.844 8.683c-.496.63.02 1.57.818 1.487l3.765-.392z" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    {!refImagePreview ? (
                      <div className="relative group w-full text-center">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileChange}
                          ref={fileInputRef}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          disabled={isProcessing}
                        />
                        <div className="inline-flex px-4 py-2 bg-white border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm group-hover:border-red-400 group-hover:text-red-500 transition-colors items-center gap-2 cursor-pointer">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          上传参考图 (可选)
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm mt-2">
                        <img src={refImagePreview} alt="Ref" className="w-10 h-10 object-cover rounded" />
                        <span className="text-xs text-slate-500">已选参考图</span>
                        <button type="button" onClick={clearRefImage} className="text-slate-400 hover:text-red-500">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </form>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 max-w-2xl mx-auto break-words">
                    <strong>提示:</strong> {error}
                    {error.includes("403") && (
                       <div className="mt-1 text-xs text-red-500 opacity-80">
                         请检查您的 API Key 是否支持该模型，或者由于权限问题已自动切换到基础模型。
                       </div>
                    )}
                  </div>
                )}
             </section>

             {/* Results Section */}
             {results.length > 0 && (
               <section className="animate-fade-in-up pb-12">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800">推荐爆款策略</h3>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {results.map((result, index) => (
                     <ResultCard 
                       key={index} 
                       result={result} 
                       index={index} 
                       onRegenerateImage={(prompt) => handleRegenerateImage(index, prompt)}
                     />
                   ))}
                 </div>
               </section>
             )}
           </div>
        </main>
      </div>
    </div>
  );
};

export default App;
