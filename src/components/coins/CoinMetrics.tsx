import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, Zap, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface CoinMetricsData {
  id: string;
  price: number;
  change_24h_percent: number;
  market_cap: number;
  liquidity: number;
  holders_count: number;
  volume_24h: number;
  volatility: number;
  high_24h: number;
  low_24h: number;
}

interface CoinMetricsProps {
  coinId: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `KES ${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `KES ${(value / 1000).toFixed(2)}K`;
  }
  return `KES ${value.toFixed(2)}`;
};

const formatPercent = (value: number): string => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const CoinMetrics: React.FC<CoinMetricsProps> = ({ coinId }) => {
  const [metrics, setMetrics] = useState<CoinMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const fetchMetrics = async () => {
      try {
        // Fetch coin data and 24h change in parallel
        const [coinResult, changeResult] = await Promise.all([
          supabase
            .from('coins')
            .select('id, price, market_cap, liquidity, holders_count, volume_24h, volatility, high_24h, low_24h, circulating_supply, total_supply')
            .eq('id', coinId)
            .single(),
          supabase.rpc('calculate_24h_change', { coin_id: coinId }),
        ]);

        const { data: coinData, error: coinError } = coinResult;
        const { data: change24h, error: changeError } = changeResult;

        if (coinError || !coinData) throw coinError;
        const c = coinData as any;
        setMetrics({
          id: c.id,
          price: c.price,
          change_24h_percent: typeof change24h === 'number' ? change24h : (changeError ? 0 : Number(change24h) || 0),
          market_cap: c.market_cap ?? (c.price * (c.circulating_supply || 0)),
          liquidity: c.liquidity ?? 0,
          holders_count: c.holders_count ?? 0,
          volume_24h: c.volume_24h ?? 0,
          volatility: c.volatility ?? 0,
          high_24h: c.high_24h ?? c.price,
          low_24h: c.low_24h ?? c.price,
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchMetrics();

    // Subscribe to real-time updates
    channel = supabase
      .channel(`metrics-${coinId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'coins',
          filter: `id=eq.${coinId}`,
        },
        () => {
          fetchMetrics(); // Refetch when coin updates
        }
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4 h-24 animate-pulse bg-gradient-to-b from-gray-900 to-gray-800" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return <div className="text-muted-foreground">No metrics available</div>;
  }

  const isPositive = metrics.change_24h_percent >= 0;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
  const changeBgColor = isPositive ? 'bg-green-950/30' : 'bg-red-950/30';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* 24h Change */}
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">24h Change</span>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
        </div>
        <div className={`text-2xl font-bold ${changeColor}`}>
          {formatPercent(metrics.change_24h_percent)}
        </div>
        <div className={`text-xs mt-2 px-2 py-1 rounded ${changeBgColor} ${changeColor} w-fit`}>
          {isPositive ? '📈 Bullish' : '📉 Bearish'}
        </div>
      </Card>

      {/* Market Cap */}
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Market Cap</span>
          <Zap className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="text-xl font-bold truncate">
          {formatCurrency(metrics.market_cap)}
        </div>
        <div className="text-xs text-muted-foreground mt-2">Current valuation</div>
      </Card>

      {/* Liquidity */}
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Liquidity</span>
          <Activity className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-xl font-bold truncate">
          {formatCurrency(metrics.liquidity)}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {((metrics.liquidity / metrics.market_cap || 0) * 100).toFixed(1)}% of cap
        </div>
      </Card>

      {/* Holders */}
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Holders</span>
          <Users className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold">
          {metrics.holders_count.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground mt-2">Unique holders</div>
      </Card>

      {/* Volatility */}
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Volatility</span>
          <TrendingUp className="w-4 h-4 text-orange-400" />
        </div>
        <div className="text-2xl font-bold text-orange-400">
          {metrics.volatility.toFixed(2)}%
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {metrics.volatility > 50
            ? '⚡ High'
            : metrics.volatility > 20
              ? '⚠️ Medium'
              : '😌 Low'}
        </div>
      </Card>
    </div>
  );
};
