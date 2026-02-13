import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PricePoint {
  price: number;
  created_at: string;
}

interface CoinPriceTrendProps {
  coinId: string;
  height?: number;
}

export const CoinPriceTrend: React.FC<CoinPriceTrendProps> = ({
  coinId,
  height = 60,
}) => {
  const [prices, setPrices] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchPriceHistory = async () => {
      try {
        // Get price history from last 24 hours
        const { data, error } = await supabase
          .from('price_history')
          .select('price, created_at')
          .eq('coin_id', coinId)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true });

        if (error) throw error;

        const priceList = (data as PricePoint[]).map((p) => p.price);
        setPrices(priceList.length > 0 ? priceList : [0]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setLoading(false);
      }
    };

    fetchPriceHistory();

    // Subscribe to updates
    channel = supabase
      .channel(`prices-${coinId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'price_history',
          filter: `coin_id=eq.${coinId}`,
        },
        (payload) => {
          setPrices((current) => [...current, (payload.new as PricePoint).price]);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [coinId]);

  if (loading || prices.length === 0) {
    return (
      <div
        style={{ height: `${height}px` }}
        className="w-full bg-gradient-to-b from-gray-900 to-gray-800 rounded animate-pulse"
      />
    );
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const isPositive = prices[prices.length - 1] >= prices[0];

  // Create SVG points
  const points = prices
    .map((price, index) => {
      const x = (index / Math.max(prices.length - 1, 1)) * 100;
      const y = 100 - ((price - minPrice) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="w-full flex items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        style={{ height: `${height}px` }}
        className="w-full"
        preserveAspectRatio="none"
      >
        {/* Background area */}
        <defs>
          <linearGradient
            id={`gradient-${coinId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor={isPositive ? '#86efac' : '#fca5a5'}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={isPositive ? '#86efac' : '#fca5a5'}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <polyline
          points={`0,100 ${points} 100,100`}
          fill={`url(#gradient-${coinId})`}
          stroke="none"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start and end points */}
        <circle
          cx="0"
          cy={(100 - ((prices[0] - minPrice) / range) * 100)}
          r="1.5"
          fill={isPositive ? '#22c55e' : '#ef4444'}
          opacity="0.5"
        />
        <circle
          cx="100"
          cy={(100 - ((prices[prices.length - 1] - minPrice) / range) * 100)}
          r="1.5"
          fill={isPositive ? '#22c55e' : '#ef4444'}
        />
      </svg>
    </div>
  );
};
