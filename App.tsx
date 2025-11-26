import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateStrategies, generateCoverImage } from './services/geminiService';
import { CoverResult, StrategyRecommendation } from './types';
import ResultCard from './components/ResultCard';
import { APP_NAME, APP_TAGLINE } from './constants';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [topic, setTopic] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [results, setResults] = useState<CoverResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reference Image State
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null); // Raw base64
  const [refImageMimeType, setRefImageMimeType] = useState<string>('image/png');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for API key on mount and when interactions happen
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
  }, [checkApiKey]);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after interaction, or re-check
      await checkApiKey();
    } else {
      alert("AI Studio environment not detected.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic validation
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
        setError("图片大小不能超过 4MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setRefImagePreview(result);
        
        // Extract raw base64 and mime type
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Re-generate image for a specific card
  const handleRegenerateImage = async (index: number, newPrompt: string) => {
    // Set loading state for this specific card
    setResults(prev => prev.map((item, i) => 
      i === index ? { ...item, isGeneratingImage: true, imageError: undefined, finalPrompt: newPrompt } : item
    ));

    try {
      // Prepare reference image object if available
      const refImageObj = refImageBase64 ? { data: refImageBase64, mimeType: refImageMimeType } : undefined;
      
      const base64Image = await generateCoverImage(newPrompt, refImageObj);
      setResults(prev => prev.map((item, i) => 
        i === index ? { ...item, generatedImage: base64Image, isGeneratingImage: false } : item
      ));
    } catch (err: any) {
      console.error(`Error regenerating image for strategy ${index + 1}:`, err);
      setResults(prev => prev.map((item, i) => 
        i === index ? { ...item, isGeneratingImage: false, imageError: err.message || "图片生成失败" } : item
      ));
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    // Ensure key before proceeding
    const keyReady = await checkApiKey();
    if (!keyReady) {
        // Try to trigger selection
        await handleSelectKey();
        const recheck = await checkApiKey();
        if(!recheck) return; // Still no key, abort
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);

    try {
      // 1. Generate Strategies (Logic)
      const strategies: StrategyRecommendation[] = await generateStrategies(topic);

      // Initialize results with strategies, image generation pending
      // Construct the initial prompt by appending the design note to ensure it's included
      const initialResults: CoverResult[] = strategies.map(s => ({
        ...s,
        isGeneratingImage: true,
        finalPrompt: `${s.gemini_image_prompt} (重点展示：${s.text_layout_guide.design_note})`
      }));
      setResults(initialResults);
      setIsProcessing(false); // Text part done

      // Prepare reference image object if available
      const refImageObj = refImageBase64 ? { data: refImageBase64, mimeType: refImageMimeType } : undefined;

      // 2. Trigger Image Generation in Parallel
      const imagePromises = initialResults.map(async (res, idx) => {
        try {
          // Use the prompt we just constructed
          const promptToUse = res.finalPrompt || res.gemini_image_prompt;
          
          const base64Image = await generateCoverImage(promptToUse, refImageObj);
          setResults(prev => prev.map((item, i) => 
            i === idx ? { ...item, generatedImage: base64Image, isGeneratingImage: false } : item
          ));
        } catch (err: any) {
          console.error(`Error generating image for strategy ${idx + 1}:`, err);
          setResults(prev => prev.map((item, i) => 
            i === idx ? { ...item, isGeneratingImage: false, imageError: err.message || "图片生成失败" } : item
          ));
        }
      });

      await Promise.all(imagePromises);

    } catch (err: any) {
      console.error("Workflow failed", err);
      
      let errorMessage = err.message || "发生未知错误，请重试。";
      
      // Attempt to parse JSON error message from backend (e.g., {"error": ...})
      if (typeof errorMessage === 'string' && (errorMessage.startsWith('{') || errorMessage.includes('{"error"'))) {
        try {
          // If the message contains the JSON, extract it
          const jsonStart = errorMessage.indexOf('{');
          const jsonString = errorMessage.substring(jsonStart);
          const parsed = JSON.parse(jsonString);
          if (parsed.error) {
            errorMessage = `API 错误 (${parsed.error.code || 'Unknown'}): ${parsed.error.message || parsed.error.status || 'Internal Error'}`;
          }
        } catch (e) {
          // Fallback to original message if parsing fails
        }
      }

      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="bg-red-500 text-white font-bold p-1.5 rounded-lg">
                VC
             </div>
             <div>
               <h1 className="text-lg font-bold text-slate-900 leading-none">{APP_NAME}</h1>
               <p className="text-xs text-slate-500">{APP_TAGLINE}</p>
             </div>
          </div>
          
          {!hasApiKey && (
            <button 
              onClick={handleSelectKey}
              className="text-xs font-semibold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors"
            >
              连接 Gemini API
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
        
        {/* Intro / Input Section */}
        <section className="mb-12 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">
            你的笔记主题是什么？
          </h2>
          <p className="text-slate-500 mb-8">
            输入主题，Gemini 3 Pro 将为你生成高点击率、具有原生感的爆款封面策略。
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：'薪资谈判失败' 或 '东京必去的10家咖啡馆'"
                className="w-full px-6 py-4 rounded-full border-2 border-slate-200 shadow-sm text-lg focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all placeholder:text-slate-300 pr-32"
                disabled={isProcessing && results.length === 0}
              />
              <button
                type="submit"
                disabled={isProcessing && results.length === 0}
                className="absolute right-2 top-2 bottom-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing && results.length === 0 ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>思考中...</span>
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

            {/* Reference Image Input */}
            <div className="flex flex-col items-center gap-2">
              {!refImagePreview ? (
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isProcessing && results.length === 0}
                  />
                  <div className="px-4 py-2 bg-white border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm group-hover:border-red-400 group-hover:text-red-500 transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    上传参考图 (可选，如：产品截图、特定场景)
                  </div>
                </div>
              ) : (
                <div className="relative inline-block mt-2">
                  <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <img 
                      src={refImagePreview} 
                      alt="Reference" 
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex flex-col items-start mr-2">
                      <span className="text-xs font-semibold text-slate-700">已使用参考图</span>
                      <span className="text-[10px] text-slate-400">将基于此图进行创作</span>
                    </div>
                    <button 
                      type="button"
                      onClick={clearRefImage}
                      className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                      disabled={isProcessing && results.length === 0}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 animate-fade-in break-words text-left">
              <strong>出错了:</strong> {error}
            </div>
          )}

          {!hasApiKey && !isProcessing && (
             <div className="mt-4 text-sm text-slate-400">
               注意: 本应用使用 Gemini 3 Pro。 <button onClick={handleSelectKey} className="underline hover:text-red-500">选择付费 API Key</button> 以启用图像生成功能。
               <br/>
               <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-slate-300 hover:text-slate-500">计费说明</a>
             </div>
          )}
        </section>

        {/* Results Section */}
        {results.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-bold text-slate-800">推荐爆款策略</h3>
               {results.some(r => r.isGeneratingImage) && (
                 <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                   <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                   正在冲印“原生感”实拍照片...
                 </span>
               )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

      </main>

      <footer className="py-6 text-center text-slate-400 text-sm">
         <p>© {new Date().getFullYear()} Viral Cover AI. Powered by Google Gemini 3 Pro.</p>
      </footer>
    </div>
  );
};

export default App;