import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PriceStatsData {
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  liquidity: number;
}

interface CoinPriceStatsProps {
  coinId: string;
  symbol: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `KES ${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `KES ${(value / 1000).toFixed(2)}K`;
  }
  return `KES ${value.toFixed(2)}`;
};

export const CoinPriceStats: React.FC<CoinPriceStatsProps> = ({ coinId, symbol }) => {
  const [stats, setStats] = useState<PriceStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('coins')
          .select('high_24h, low_24h, volume_24h, liquidity')
          .eq('id', coinId)
          .single();

        if (error) throw error;
        setStats(data as PriceStatsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching price stats:', err);
        setLoading(false);
      }
    };

    fetchStats();

    // Subscribe to coin updates
    channel = supabase
      .channel(`stats-${coinId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'coins',
          filter: `id=eq.${coinId}`,
        },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [coinId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 bg-gradient-to-r from-gray-900 to-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-4 text-foreground">24h Statistics</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">High</span>
          <span className="font-medium text-green-400">{formatCurrency(stats.high_24h)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Low</span>
          <span className="font-medium text-red-400">{formatCurrency(stats.low_24h)}</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Volume</span>
          <span className="font-medium text-blue-400">{formatCurrency(stats.volume_24h)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Liquidity</span>
          <span className="font-medium text-purple-400">{formatCurrency(stats.liquidity)}</span>
        </div>
      </div>
    </Card>
  );
};
