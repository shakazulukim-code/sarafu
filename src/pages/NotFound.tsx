import { motion } from 'framer-motion';
import { Search, Home, ArrowLeft, Coins } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <Card className="glass-card">
            <CardContent className="pt-12 pb-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
                className="text-9xl font-bold font-display mb-4 bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent"
              >
                404
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10, delay: 0.1 }}
                className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6"
              >
                <Search className="h-8 w-8 text-muted-foreground" />
              </motion.div>

              <h1 className="text-2xl sm:text-3xl font-bold font-display mb-3">
                Page Not Found
              </h1>

              <p className="text-muted-foreground mb-8">
                The page you're looking for doesn't exist or has been moved.
              </p>

              <div className="flex gap-3 justify-center flex-wrap mb-8">
                <Button
                  variant="hero"
                  onClick={() => navigate('/')}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
              </div>

              <div className="pt-6 border-t border-border/50">
                <p className="text-sm text-muted-foreground mb-4">Try these popular pages:</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate('/launchpad')}
                    className="gap-1"
                  >
                    <Coins className="h-3 w-3" />
                    Launchpad
                  </Button>
                  <Button variant="link" size="sm" onClick={() => navigate('/dashboard')}>
                    Dashboard
                  </Button>
                  <Button variant="link" size="sm" onClick={() => navigate('/create-coin')}>
                    Create Coin
                  </Button>
                  <Button variant="link" size="sm" onClick={() => navigate('/about')}>
                    About
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
