"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MANUAL_CHAPTERS,
  GLOBAL_SHORTCUTS,
  TargetRole,
  ManualChapter,
  ManualSection,
} from '@/data/manualContent';
import ManualHeader from './ManualHeader';
import ManualSidebar from './ManualSidebar';
import ManualCheatSheet from './ManualCheatSheet';
import ManualChapterSection from './ManualChapterSection';
import { SearchX, RotateCcw, BookOpenCheck } from 'lucide-react';

interface ManualViewProps {
  isEmbedded?: boolean;
  subdomain?: string;
  userRole?: string | null;
}

export default function ManualView({
  isEmbedded = false,
  subdomain,
  userRole,
}: ManualViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<TargetRole>('all');
  const [activeChapterId, setActiveChapterId] = useState<string>(
    MANUAL_CHAPTERS[0]?.id || 'capitulo-1'
  );
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  // Handle printing
  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  // Filter chapters and sections based on search and role
  const filteredChapters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return MANUAL_CHAPTERS.map((chapter) => {
      // Role matching at chapter level
      const chapterRoleMatch =
        selectedRole === 'all' ||
        chapter.targetRole === 'all' ||
        chapter.targetRole === selectedRole;

      // Filter sections
      const matchingSections = chapter.sections.filter((section) => {
        // Section role match
        const sectionRoleMatch =
          selectedRole === 'all' ||
          section.targetRole === 'all' ||
          section.targetRole === selectedRole;

        if (!sectionRoleMatch) return false;
        if (!query) return true;

        // Textual matching across title, summary, keypoints, steps, shortcuts, and callouts
        const matchesTitle = section.title.toLowerCase().includes(query);
        const matchesSummary = section.summary.toLowerCase().includes(query);
        const matchesKeyPoints = section.keyPoints?.some((kp) =>
          kp.toLowerCase().includes(query)
        );
        const matchesSteps = section.steps?.some(
          (step) =>
            step.title.toLowerCase().includes(query) ||
            step.description.toLowerCase().includes(query) ||
            step.tips?.some((tip) => tip.toLowerCase().includes(query))
        );
        const matchesShortcuts = section.shortcuts?.some(
          (sc) =>
            sc.description.toLowerCase().includes(query) ||
            sc.keys.some((k) => k.toLowerCase().includes(query))
        );
        const matchesCallouts = section.callouts?.some(
          (c) =>
            c.title.toLowerCase().includes(query) ||
            c.content.toLowerCase().includes(query)
        );

        return (
          matchesTitle ||
          matchesSummary ||
          matchesKeyPoints ||
          matchesSteps ||
          matchesShortcuts ||
          matchesCallouts
        );
      });

      // Chapter matches if query matches chapter header or it has matching sections
      const matchesChapterHeader =
        query === '' ||
        chapter.title.toLowerCase().includes(query) ||
        chapter.summary.toLowerCase().includes(query) ||
        chapter.badge.toLowerCase().includes(query);

      const hasMatchingSections = matchingSections.length > 0;

      if (!chapterRoleMatch && !hasMatchingSections) {
        return null;
      }

      if (query && !matchesChapterHeader && !hasMatchingSections) {
        return null;
      }

      return {
        ...chapter,
        sections: query ? matchingSections : matchingSections,
      };
    }).filter((c): c is ManualChapter => c !== null && c.sections.length > 0);
  }, [searchQuery, selectedRole]);

  // Set active chapter when filtered list changes
  useEffect(() => {
    if (filteredChapters.length > 0) {
      const isCurrentStillPresent = filteredChapters.some(
        (c) => c.id === activeChapterId
      );
      if (!isCurrentStillPresent) {
        setActiveChapterId(filteredChapters[0].id);
      }
    }
  }, [filteredChapters, activeChapterId]);

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id.startsWith('capitulo-')) {
              setActiveChapterId(id);
            } else {
              setActiveSectionId(id);
              // Also find parent chapter
              const parentChapter = MANUAL_CHAPTERS.find((c) =>
                c.sections.some((s) => s.id === id)
              );
              if (parentChapter) {
                setActiveChapterId(parentChapter.id);
              }
            }
          }
        });
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    const elements = document.querySelectorAll('article[id], section[id]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [filteredChapters]);

  // Filter global shortcuts for cheat sheet based on role if needed
  const displayShortcuts = useMemo(() => {
    if (selectedRole === 'all') return GLOBAL_SHORTCUTS;
    if (selectedRole === 'digitizer') {
      return GLOBAL_SHORTCUTS.filter(
        (s) =>
          s.context.includes('Visor') ||
          s.context.includes('Paleográfico') ||
          s.context.includes('Global')
      );
    }
    if (selectedRole === 'evaluator') {
      return GLOBAL_SHORTCUTS.filter(
        (s) =>
          s.context.includes('Evaluación') ||
          s.context.includes('Arbitraje') ||
          s.context.includes('Global')
      );
    }
    return GLOBAL_SHORTCUTS;
  }, [selectedRole]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRole('all');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Dedicated Print Media Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              margin: 1.5cm;
              size: A4 portrait;
            }
            body {
              background: #ffffff !important;
              color: #000000 !important;
              font-size: 11pt !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            header, aside, button, nav {
              display: none !important;
            }
            article, section {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              border-color: #e2e8f0 !important;
            }
            a {
              text-decoration: none !important;
              color: inherit !important;
            }
          }
        `,
        }}
      />

      {/* Manual Top Header */}
      <ManualHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        isEmbedded={isEmbedded}
        subdomain={subdomain}
        userRole={userRole}
        onPrint={handlePrint}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          {/* Sticky Sidebar Navigation */}
          {filteredChapters.length > 0 && (
            <ManualSidebar
              chapters={filteredChapters}
              activeChapterId={activeChapterId}
              onSelectChapter={setActiveChapterId}
              activeSectionId={activeSectionId}
            />
          )}

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 w-full" id="manual-content-main">
            {/* Search / Filter summary indicator */}
            {(searchQuery || selectedRole !== 'all') && (
              <div className="mb-6 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Filtros activos:{' '}
                    {searchQuery && (
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        &quot;{searchQuery}&quot;
                      </span>
                    )}
                    {searchQuery && selectedRole !== 'all' && ' + '}
                    {selectedRole !== 'all' && (
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        Rol: {selectedRole}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    ({filteredChapters.reduce((acc, c) => acc + c.sections.length, 0)} secciones en {filteredChapters.length} capítulos)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer
                </button>
              </div>
            )}

            {/* Global Keyboard Shortcuts Cheat Sheet */}
            {!searchQuery && (
              <ManualCheatSheet shortcuts={displayShortcuts} />
            )}

            {/* Chapters and Sections List */}
            {filteredChapters.length > 0 ? (
              <div className="space-y-4">
                {filteredChapters.map((chapter) => (
                  <ManualChapterSection
                    key={chapter.id}
                    chapter={chapter}
                  />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="py-20 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-4">
                  <SearchX className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No se encontraron resultados
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  No hay capítulos, secciones o atajos que coincidan con la búsqueda
                  {searchQuery && <strong> &quot;{searchQuery}&quot;</strong>}
                  {selectedRole !== 'all' && <span> para el rol <strong>{selectedRole}</strong></span>}.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restablecer búsqueda y filtros
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
