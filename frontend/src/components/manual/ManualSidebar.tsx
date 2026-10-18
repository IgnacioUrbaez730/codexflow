"use client";

import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  UploadCloud,
  Scan,
  CheckSquare,
  Download,
  LifeBuoy,
  Building2,
  FolderTree,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Hash,
  LucideIcon
} from 'lucide-react';
import { ManualChapter } from '@/data/manualContent';

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  Users,
  UploadCloud,
  Scan,
  CheckSquare,
  Download,
  LifeBuoy,
  Building2,
  FolderTree,
  FileText,
  HelpCircle,
};

interface ManualSidebarProps {
  chapters: ManualChapter[];
  activeChapterId: string;
  onSelectChapter: (id: string) => void;
  activeSectionId?: string;
}

export default function ManualSidebar({
  chapters,
  activeChapterId,
  onSelectChapter,
  activeSectionId,
}: ManualSidebarProps) {
  // Track open/collapsed state for chapters with sub-sections
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const toggleCollapse = (chapterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedMap((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleChapterClick = (id: string) => {
    onSelectChapter(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSectionClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <aside
      aria-label="Tabla de Contenidos del Manual"
      className="w-full lg:w-72 xl:w-80 shrink-0 print:hidden"
    >
      <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-4 shadow-2xs scrollbar-thin">
        {/* Sidebar Header */}
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Índice de Capítulos ({chapters.length})
          </h2>
        </div>

        {/* Chapters Navigation */}
        <nav className="space-y-1.5" aria-label="Capítulos">
          {chapters.map((chapter) => {
            const IconComponent = ICON_MAP[chapter.iconName] || FileText;
            const isActiveChapter = activeChapterId === chapter.id;
            const isManuallyCollapsed = collapsedMap[chapter.id];
            // Auto expand if it's the active chapter unless explicitly collapsed
            const isExpanded = isActiveChapter ? !isManuallyCollapsed : !isManuallyCollapsed && false;

            return (
              <div key={chapter.id} className="space-y-1">
                {/* Chapter item row */}
                <div
                  onClick={() => handleChapterClick(chapter.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    isActiveChapter
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isActiveChapter
                          ? 'text-white'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                      }`}
                    />
                    <span className="truncate">
                      {chapter.number}. {chapter.title}
                    </span>
                  </div>

                  {chapter.sections.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => toggleCollapse(chapter.id, e)}
                      aria-label="Alternar secciones"
                      className={`p-1 rounded-md transition-colors ${
                        isActiveChapter
                          ? 'hover:bg-indigo-700 text-indigo-100'
                          : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Subsections list */}
                {isExpanded && chapter.sections.length > 0 && (
                  <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-4 my-1">
                    {chapter.sections.map((section) => {
                      const isSectionActive = activeSectionId === section.id;

                      return (
                        <a
                          key={section.id}
                          href={`#${section.id}`}
                          onClick={(e) => handleSectionClick(section.id, e)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            isSectionActive
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <Hash className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="truncate">{section.title}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
