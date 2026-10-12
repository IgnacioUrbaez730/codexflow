"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}

export default function SidebarItem({
  href,
  icon: Icon,
  label,
  isActive,
  isCollapsed,
}: SidebarItemProps) {
  if (isCollapsed) {
    return (
      <Link
        href={href}
        className={`w-10 h-10 flex items-center justify-center rounded-lg relative group transition-colors ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-800"
        }`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <div className="absolute left-full ml-3 px-2.5 py-1 bg-gray-950 text-white text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {label}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-gray-300 hover:text-white hover:bg-gray-800"
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium truncate">{label}</span>
    </Link>
  );
}
