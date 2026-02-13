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
    Reload Page
            </Button >
          )
}
        </div >
      </motion.div >
    </div >
  );
}
