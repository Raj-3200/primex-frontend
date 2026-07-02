"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebarStore } from "@/stores/sidebar-store";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
}

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { toggleMobile } = useSidebarStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const trimmedSearch = useMemo(() => search.trim(), [search]);

  useEffect(() => {
    if (trimmedSearch.length < 2) {
      setResults([]);
      setSearchOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const token = localStorage.getItem("access_token") || "";
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedSearch)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json();
      setResults(data.results ?? []);
      setSearchOpen(true);
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedSearch]);

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-20 flex items-center px-6 gap-4"
    >
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleMobile}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Page title */}
      {title && (
        <h1 className="text-lg font-bold text-foreground font-display hidden sm:block">
          {title}
        </h1>
      )}

      {/* Search */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers, phone, orders..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchOpen(results.length > 0)}
            className="pl-9 h-9 bg-muted/50 border-muted focus:bg-background text-sm"
          />
          {searchOpen && (
            <div className="absolute left-0 right-0 top-11 rounded-xl border border-border bg-popover shadow-premium overflow-hidden z-50">
              {results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No matching records</div>
              ) : (
                results.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.href}
                    onClick={() => {
                      setSearch("");
                      setSearchOpen(false);
                    }}
                    className="block px-4 py-3 hover:bg-muted/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <Badge variant="outline" className="text-[10px]">{result.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{result.detail}</p>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9"
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </motion.div>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="w-4 h-4" />
              <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-3 border-b">
              <p className="font-semibold text-sm">Notifications</p>
            </div>
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="cursor-pointer">Open notification center</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Welcome text */}
        <div className="hidden lg:block pl-2 border-l border-border">
          <p className="text-xs text-muted-foreground">Welcome back,</p>
          <p className="text-sm font-semibold text-foreground">
            {user?.full_name?.split(" ")[0] || "Admin"}
          </p>
        </div>
      </div>
    </motion.header>
  );
}
