import React from 'react';
import { CoverResult } from '../types';

interface ResultCardProps {
  result: CoverResult;
  index: number;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, index }) => {
  const { 
    style_recommendation, 
    reasoning, 
    text_layout_guide, 
    generatedImage, 
    isGeneratingImage, 
    imageError 
  } = result;

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

        {/* Overlay Layout Guide (Hover or Always visible contextually) */}
        {generatedImage && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">排版参考 (Layout Guide)</p>
             <p className="font-bold text-lg leading-tight mb-1">"{text_layout_guide.main_text}"</p>
             <p className="text-sm opacity-90 mb-2">{text_layout_guide.sub_text}</p>
             <div className="text-xs bg-white/20 backdrop-blur-sm rounded p-2 border border-white/10">
               <span className="font-bold text-yellow-300">建议: </span> 
               {text_layout_guide.design_note}
             </div>
          </div>
        )}
      </div>

      {/* Footer Text Guide (Visible always) */}
      <div className="p-4 bg-white flex-1 flex flex-col gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">主标题文案</h4>
          <p className="text-slate-800 font-medium select-all bg-slate-50 p-2 rounded border border-slate-100">
            {text_layout_guide.main_text}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">视觉/装饰建议</h4>
          <p className="text-sm text-slate-600">
            {text_layout_guide.design_note}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;