import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SEOSettings {
    page_path: string;
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string[];
    og_title?: string;
    og_description?: string;
    og_image?: string;
    twitter_title?: string;
    twitter_description?: string;
    twitter_image?: string;
    canonical_url?: string;
    robots_meta?: string;
    structured_data?: any;
}

interface SEOContextType {
    seoSettings: Map<string, SEOSettings>;
    getSEOForPage: (path: string) => SEOSettings | undefined;
    isLoading: boolean;
}

const SEOContext = createContext<SEOContextType | undefined>(undefined);

export function SEOProvider({ children }: { children: ReactNode }) {
    const [seoSettings, setSeoSettings] = useState<Map<string, SEOSettings>>(new Map());

    const { data, isLoading } = useQuery({
        queryKey: ['seo-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('seo_settings')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;
            return data as SEOSettings[];
        },
        staleTime: 1000 * 60 * 15, // 15 minutes - SEO settings don't change often
        cacheTime: 1000 * 60 * 30, // 30 minutes
    });

    useEffect(() => {
        if (data) {
            const settingsMap = new Map<string, SEOSettings>();
            data.forEach(setting => {
                settingsMap.set(setting.page_path, setting);
            });
            setSeoSettings(settingsMap);
        }
    }, [data]);

    const getSEOForPage = (path: string): SEOSettings | undefined => {
        // First try exact match
        if (seoSettings.has(path)) {
            return seoSettings.get(path);
        }

        // Try pattern matching for dynamic routes (e.g., /coin/:id)
        for (const [pattern, settings] of seoSettings.entries()) {
            if (pattern.includes(':')) {
                const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(path)) {
                    return settings;
                }
            }
        }

        return undefined;
    };

    return (
        <SEOContext.Provider value={{ seoSettings, getSEOForPage, isLoading }}>
            {children}
        </SEOContext.Provider>
    );
}

export function useSEO() {
    const context = useContext(SEOContext);
    if (context === undefined) {
        throw new Error('useSEO must be used within SEOProvider');
    }
    return context;
}
