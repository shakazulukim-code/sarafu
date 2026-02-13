import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function ResetPassword() {
    const navigate = useNavigate();
    const { updatePassword, loading, session } = useAuth();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Monitor auth state changes specifically for password recovery
    useEffect(() => {
        if (loading) return;

        // If we're not loading and have no session, we might need to redirect
        // But we should check if we're currently in a recovery flow
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            console.log('ResetPassword Auth Event:', event);
            if (event === 'SIGNED_OUT') {
                navigate('/auth');
            }
        });

        // If after loading there's no session and it's not a recovery attempt (no hash/token)
        // we redirect. Supabase handles the recovery via the URL fragment automatically.
        if (!session && !window.location.hash.includes('access_token=')) {
            navigate('/auth');
        }

        return () => subscription.unsubscribe();
    }, [loading, session, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await updatePassword(password);
            if (error) {
                setError(error.message);
            } else {
                setSuccess(true);
                // Sign out after reset to ensure the user is not automatically logged in
                // as per the project requirements.
                await supabase.auth.signOut();
                setTimeout(() => {
                    navigate('/auth?tab=signin');
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 pointer-events-none" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

            <Navbar />

            <div className="flex-1 flex items-center justify-center p-4 pt-20 sm:pt-24 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <Card className="border-border/50 shadow-2xl bg-card/50 backdrop-blur-xl">
                        <CardHeader className="space-y-1 text-center">
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                                <Lock className="w-6 h-6 text-white" />
                            </div>
                            <CardTitle className="text-3xl font-bold font-display gradient-text">Set New Password</CardTitle>
                            <CardDescription className="text-muted-foreground/80">
                                Please enter your new password below to secure your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {success ? (
                                <div className="space-y-6 text-center py-6">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-success/20 flex items-center justify-center border border-success/30">
                                        <CheckCircle2 className="w-8 h-8 text-success" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xl font-bold text-success">Password Updated!</p>
                                        <p className="text-sm text-muted-foreground">
                                            Your password has been reset successfully.
                                            For security, please sign in with your new password.
                                        </p>
                                        <div className="pt-4">
                                            <p className="text-xs text-muted-foreground/60 animate-pulse">
                                                Redirecting to sign in...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                                        >
                                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                            {error}
                                        </motion.div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="password">New Password</Label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Lock className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            </div>
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="pl-10 h-11 bg-muted/30 focus:bg-background transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Lock className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            </div>
                                            <Input
                                                id="confirm-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="pl-10 h-11 bg-muted/30 focus:bg-background transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button type="submit" variant="hero" className="w-full h-11 text-base shadow-lg shadow-primary/20" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                Setting Password...
                                            </>
                                        ) : (
                                            'Update Password'
                                        )}
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
            <Footer />
        </div>
    );
}
