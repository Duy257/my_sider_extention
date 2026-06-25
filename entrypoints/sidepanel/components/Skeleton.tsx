import React from "react";

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div 
      className={`relative overflow-hidden rounded-xl bg-surface/60 border border-stone-800/40 h-16 w-full animate-pulse before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-stone-700/10 before:to-transparent ${className}`}
    />
  );
}

export function SkeletonPanel() {
  return (
    <div className="flex flex-col gap-3.5 p-3.5 animate-fade-in-up">
      {/* Header bar placeholder */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-850/50 mb-2">
        <div className="h-6 w-28 rounded-lg bg-surface/50 animate-pulse relative overflow-hidden" />
        <div className="flex gap-2">
          <div className="h-6 w-14 rounded-lg bg-surface/50 animate-pulse relative overflow-hidden" />
          <div className="h-6 w-8 rounded-lg bg-surface/50 animate-pulse relative overflow-hidden" />
          <div className="h-6 w-8 rounded-lg bg-surface/50 animate-pulse relative overflow-hidden" />
        </div>
      </div>

      <SkeletonRow className="h-20" />
      <SkeletonRow className="w-[85%] h-24" />
      <SkeletonRow className="w-[70%] h-16" />
      <SkeletonRow className="w-[90%] h-20" />
      
      {/* Footer input placeholder */}
      <div className="mt-auto pt-4">
        <div className="h-11 w-full rounded-xl bg-surface/50 animate-pulse relative overflow-hidden" />
      </div>
    </div>
  );
}
