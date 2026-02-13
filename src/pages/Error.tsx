import { motion } from 'framer-motion';
import { AlertTriangle, Home, ArrowLeft, RefreshCcw, Shield } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorType = searchParams.get('type') || '500';
  const errorMessage = searchParams.get('message');

  const errorConfig: Record<string, { icon: any; title: string; description: string; color: string }> = {
    '404': {
      icon: AlertTriangle,
      title: 'Page Not Found',
      description: 'The page you\'re looking for doesn\'t exist or has been moved.',
      color: 'text-warning',
    },
    '403': {
      icon: Shield,
      title: 'Access Denied',
      description: 'You don\'t have permission to access this resource.',
      color: 'text-destructive',
    },
    '500': {
      icon: AlertTriangle,
      title: 'Server Error',
      description: 'Something went wrong on our end. We\'re working to fix it.',
      color: 'text-destructive',
    },
  };

  const config = errorConfig[errorType] || errorConfig['500'];
  const Icon = config.icon;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6 text-center space-y-6">
              <div className={`mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
                <Icon className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
                <p className="text-muted-foreground">{errorMessage || config.description}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              </div>

              <div className="pt-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                  <Home className="mr-2 h-4 w-4" />
                  Return Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
