import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useSiteSettings } from '@/lib/site-settings-context';

interface SEOHeadProps {
    title?: string;
    description?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    canonicalUrl?: string;
    robotsMeta?: string;
    structuredData?: object;
}

const DEFAULT_SEO = {
    title: 'Sarafu Mpya - Noble Coin Launch Platform',
    description: 'Launch and trade community tokens on the premier Kenyan cryptocurrency platform. Create your own coin, trade with M-PESA, and join the crypto revolution.',
    keywords: ['cryptocurrency', 'Kenya', 'M-PESA', 'token launch', 'crypto trading', 'blockchain', 'Sarafu'],
    ogImage: 'https://storage.googleapis.com/gpt-engineer-file-uploads/PunDlKU5SGTRcANrcxIX8dohHoY2/social-images/social-1770389556567-ChatGPT_Image_Feb_6,_2026,_05_52_07_PM.png',
    twitterCard: 'summary_large_image',
};

export function SEOHead({
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    canonicalUrl,
    robotsMeta = 'index,follow',
    structuredData,
}: SEOHeadProps) {
    const location = useLocation();
    const { settings } = useSiteSettings();
    const baseUrl = window.location.origin;

    const fullTitle = title || settings?.site_name || DEFAULT_SEO.title;
    const fullDescription = description || settings?.site_description || DEFAULT_SEO.description;
    const fullKeywords = keywords || DEFAULT_SEO.keywords;
    const fullCanonical = canonicalUrl || `${baseUrl}${location.pathname}`;
    const fullOgImage = ogImage || settings?.logo_url || DEFAULT_SEO.ogImage;

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={fullDescription} />
            {settings?.google_verification_code && (
                <meta name="google-site-verification" content={settings.google_verification_code} />
            )}
            {fullKeywords.length > 0 && (
                <meta name="keywords" content={fullKeywords.join(', ')} />
            )}
            <meta name="robots" content={robotsMeta} />
            <link rel="canonical" href={fullCanonical} />

            {/* Open Graph */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={fullCanonical} />
            <meta property="og:title" content={ogTitle || fullTitle} />
            <meta property="og:description" content={ogDescription || fullDescription} />
            <meta property="og:image" content={fullOgImage} />
            <meta property="og:site_name" content="Sarafu Mpya" />

            {/* Twitter Card */}
            <meta name="twitter:card" content={DEFAULT_SEO.twitterCard} />
            <meta name="twitter:url" content={fullCanonical} />
            <meta name="twitter:title" content={twitterTitle || ogTitle || fullTitle} />
            <meta name="twitter:description" content={twitterDescription || ogDescription || fullDescription} />
            <meta name="twitter:image" content={twitterImage || fullOgImage} />

            {/* Structured Data (JSON-LD) */}
            {structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            )}
        </Helmet>
    );
}

// Helper function to create coin structured data
export function createCoinStructuredData(coin: {
    name: string;
    symbol: string;
    description?: string;
    price: number;
    marketCap?: number;
    logoUrl?: string;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FinancialProduct',
        name: coin.name,
        description: coin.description || `${coin.name} (${coin.symbol}) - Community token on Sarafu Mpya`,
        category: 'Cryptocurrency',
        image: coin.logoUrl,
        offers: {
            '@type': 'Offer',
            price: coin.price,
            priceCurrency: 'KES',
        },
    };
}

// Helper function to create organization structured data
export function createOrganizationStructuredData() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Sarafu Mpya',
        description: 'Community token launch and trading platform',
        url: window.location.origin,
        logo: 'https://storage.googleapis.com/gpt-engineer-file-uploads/PunDlKU5SGTRcANrcxIX8dohHoY2/uploads/1770390453292-ChatGPT_Image_Feb_6__2026__06_01_46_PM__2_-removebg-preview.png',
        sameAs: [
            // Add social media links when available
        ],
    };
}
