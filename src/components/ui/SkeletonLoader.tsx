import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

export function CoinCardSkeleton() {
    return (
        <Card className="glass-card">
            <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                    {/* Logo skeleton */}
                    <div className="h-10 w-10 rounded-xl bg-muted/50 animate-pulse" />
                    <div className="flex-1 min-w-0 space-y-2">
                        {/* Name skeleton */}
                        <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                        {/* Symbol skeleton */}
                        <div className="h-3 w-16 bg-muted/50 rounded animate-pulse" />
                    </div>
                    {/* Status badge skeleton */}
                    <div className="h-6 w-16 bg-muted/50 rounded-full animate-pulse" />
                </div>

                {/* Price skeleton */}
                <div className="space-y-2 mb-3">
                    <div className="h-3 w-20 bg-muted/50 rounded animate-pulse" />
                    <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
                </div>

                {/* Button skeleton */}
                <div className="h-9 w-full bg-muted/50 rounded animate-pulse" />
            </CardContent>
        </Card>
    );
}

export function CoinGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <CoinCardSkeleton key={i} />
            ))}
        </div>
    );
}

export function TransactionRowSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 border-b border-border/50">
            <div className="h-10 w-10 rounded-full bg-muted/50 animate-pulse" />
            <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
            <div className="h-6 w-20 bg-muted/50 rounded animate-pulse" />
        </div>
    );
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-0">
            {Array.from({ length: count }).map((_, i) => (
                <TransactionRowSkeleton key={i} />
            ))}
        </div>
    );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full space-y-3">
            {/* Header */}
            <div className="flex gap-4 pb-3 border-b border-border/50">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className="flex-1 h-4 bg-muted/50 rounded animate-pulse" />
                ))}
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4 py-3">
                    {Array.from({ length: cols }).map((_, colIndex) => (
                        <div key={colIndex} className="flex-1 h-4 bg-muted/50 rounded animate-pulse" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="glass-card">
                        <CardContent className="p-6 space-y-2">
                            <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                            <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
                            <div className="h-3 w-20 bg-muted/50 rounded animate-pulse" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Holdings */}
            <Card className="glass-card">
                <CardContent className="pt-6">
                    <div className="h-6 w-32 bg-muted/50 rounded animate-pulse mb-4" />
                    <CoinGridSkeleton count={3} />
                </CardContent>
            </Card>

            {/* Transactions */}
            <Card className="glass-card">
                <CardContent className="pt-6">
                    <div className="h-6 w-40 bg-muted/50 rounded animate-pulse mb-4" />
                    <TransactionListSkeleton />
                </CardContent>
            </Card>
        </div>
    );
}

export function PageSkeleton() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                >
                    {/* Header */}
                    <div className="space-y-2">
                        <div className="h-8 w-48 bg-muted/50 rounded animate-pulse" />
                        <div className="h-4 w-64 bg-muted/50 rounded animate-pulse" />
                    </div>

                    {/* Content */}
                    <Card className="glass-card">
                        <CardContent className="pt-8 pb-8 space-y-4">
                            <div className="h-6 w-full bg-muted/50 rounded animate-pulse" />
                            <div className="h-6 w-5/6 bg-muted/50 rounded animate-pulse" />
                            <div className="h-6 w-4/6 bg-muted/50 rounded animate-pulse" />
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
