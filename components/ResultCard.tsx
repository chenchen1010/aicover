
import React, { useState, useEffect } from 'react';
import { CoverResult } from '../types';

interface ResultCardProps {
  result: CoverResult;
  index: number;
  onRegenerateImage?: (prompt: string) => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, index, onRegenerateImage }) => {
  const { 
    style_recommendation, 
    reasoning, 
    text_layout_guide, 
    generatedImage, 
    isGeneratingImage, 
    imageError,
    finalPrompt
  } = result;

  // Local state for the editable prompt
  const [localPrompt, setLocalPrompt] = useState(finalPrompt || "");
  const [isPromptEdited, setIsPromptEdited] = useState(false);

  // Local state for editable text fields
  const [mainText, setMainText] = useState(text_layout_guide.main_text || "");
  const [subText, setSubText] = useState(text_layout_guide.sub_text || "");
  const [tags, setTags] = useState(text_layout_guide.tags || "");

  // Sync local prompt when result updates (initial load)
  useEffect(() => {
    if (finalPrompt) {
        setLocalPrompt(finalPrompt);
    }
  }, [finalPrompt]);

  // Sync text fields when result updates
  useEffect(() => {
    setMainText(text_layout_guide.main_text || "");
    setSubText(text_layout_guide.sub_text || "");
    setTags(text_layout_guide.tags || "");
  }, [text_layout_guide]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalPrompt(e.target.value);
    setIsPromptEdited(true);
  };

  const handleRegenerateClick = () => {
    if (onRegenerateImage) {
      onRegenerateImage(localPrompt);
      setIsPromptEdited(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            方案 {index + 1}
          </span>
          <h3 className="font-bold text-slate-800 text-lg leading-tight">
            {style_recommendation}
          </h3>
        </div>
        <p className="text-xs text-slate-500 italic">
          {reasoning}
        </p>
      </div>

      {/* Image Area */}
      <div className="relative w-full aspect-[3/4] bg-slate-100 group">
        {isGeneratingImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <svg className="animate-spin h-8 w-8 text-red-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium animate-pulse">正在冲印实拍照片...</span>
          </div>
        ) : generatedImage ? (
          <img 
            src={`data:image/png;base64,${generatedImage}`} 
            alt={style_recommendation}
            className="w-full h-full object-cover"
          />
        ) : imageError ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-500 p-4 text-center text-sm">
            图片生成失败 <br/> {imageError}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
             无图片
          </div>
        )}

        {/* Overlay Design Note (Hover) */}
        {generatedImage && !isGeneratingImage && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
             <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400 mb-1">视觉/装饰建议</p>
             <p className="text-sm leading-relaxed font-medium text-slate-100">
               {text_layout_guide.design_note}
             </p>
          </div>
        )}
      </div>

      {/* Prompt Editor & Regeneration Section */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
         <div className="flex justify-between items-center mb-1">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">AI 绘图提示词 (Prompt)</h4>
             <button 
                onClick={handleRegenerateClick}
                disabled={isGeneratingImage}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    isGeneratingImage ? 'text-slate-300 cursor-not-allowed' : 
                    isPromptEdited ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm' : 
                    'text-red-500 hover:bg-red-50 hover:text-red-600'
                }`}
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 ${isGeneratingImage ? 'animate-spin' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {isGeneratingImage ? "生成中..." : isPromptEdited ? "应用修改并重绘" : "重新生图"}
             </button>
         </div>
         <textarea 
            value={localPrompt}
            onChange={handlePromptChange}
            className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 resize-y min-h-[60px]"
            placeholder="在此修改提示词..."
         />
      </div>

      {/* Footer Text Guide - Editable Fields */}
      <div className="p-4 bg-white flex-1 flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">主标题文案</h4>
          <textarea
            value={mainText}
            onChange={(e) => setMainText(e.target.value)}
            className="w-full text-slate-800 font-bold text-lg bg-slate-50 p-2 rounded border border-slate-100 focus:bg-white focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-300 resize-none overflow-hidden"
            rows={2}
          />
        </div>
        
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">副标题 / 补充文案</h4>
          <textarea
            value={subText}
            onChange={(e) => setSubText(e.target.value)}
            className="w-full text-slate-600 font-medium bg-slate-50 p-2 rounded border border-slate-100 focus:bg-white focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-300 resize-none overflow-hidden"
            rows={2}
          />
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
             </svg>
             SEO 标签
          </h4>
          <textarea
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full text-sm text-blue-600 font-medium bg-blue-50/50 p-2 rounded border border-blue-100 focus:bg-white focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 resize-none min-h-[60px]"
            placeholder="#标签1 #标签2..."
          />
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
