import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Briefcase, MapPin, Clock, Send, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

interface JobPosition {
    id: string;
    title: string;
    description: string;
    location: string;
    type: string;
    is_active: boolean;
    created_at: string;
}

export function JobSection() {
    const [jobs, setJobs] = useState<JobPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState<JobPosition | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Application Form
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        resume_link: '',
        cover_letter: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            // Cast 'job_positions' to any to avoid type errors with mismatched schema
            const { data, error } = await supabase
                .from('job_positions' as any)
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            // Cast to any to avoid type errors with mismatched schema
            setJobs((data as any) || []);
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = (job: JobPosition) => {
        setSelectedJob(job);
        setIsDialogOpen(true);
        setSubmitted(false);
        setFormData({
            name: '',
            email: '',
            phone: '',
            resume_link: '',
            cover_letter: ''
        });
    };

    const handleSubmitApplication = async () => {
        if (!formData.name || !formData.email || !formData.phone) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (!selectedJob) return;

        setSubmitting(true);
        try {
            // Check if user has already applied (optional, but good practice)
            // Here we just insert
            const { error } = await supabase
                .from('job_applications' as any)
                .insert({
                    job_position_id: selectedJob.id,
                    applicant_name: formData.name,
                    applicant_email: formData.email,
                    applicant_phone: formData.phone,
                    resume_link: formData.resume_link || null,
                    cover_letter: formData.cover_letter || null,
                    status: 'pending'
                });

            if (error) throw error;

            setSubmitted(true);
            toast.success('Application submitted successfully!');

            // Close dialog after 2 seconds
            setTimeout(() => {
                setIsDialogOpen(false);
                setSubmitted(false);
            }, 2000);

        } catch (error) {
            console.error('Error submitting application:', error);
            toast.error('Failed to submit application. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return null;
    if (jobs.length === 0) return null;

    return (
        <section className="py-20 border-t border-border/50 relative overflow-hidden" id="careers">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
            <div className="container relative z-10">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
                        Join Our <span className="gradient-text">Team</span>
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        We're looking for talented individuals to help us revolutionize crypto trading in Africa.
                    </p>
                </motion.div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {jobs.map((job, index) => (
                        <motion.div
                            key={job.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="glass-card p-6 flex flex-col justify-between group hover:border-primary/50 transition-all duration-300"
                        >
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <Briefcase className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                                        {job.type}
                                    </span>
                                </div>
                                <h3 className="font-semibold text-lg mb-2">{job.title}</h3>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {job.location}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(job.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {job.description}
                                </p>
                            </div>

                            <Button variant="outline" className="w-full mt-auto group-hover:bg-primary group-hover:text-primary-foreground transition-colors" onClick={() => handleApply(job)}>
                                Apply Now
                            </Button>
                        </motion.div>
                    ))}
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="glass-card border-none sm:max-w-md">
                    {submitted ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle className="h-8 w-8 text-success" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Application Sent!</h3>
                                <p className="text-muted-foreground mt-2">
                                    Thanks for applying to {selectedJob?.title}. We'll be in touch soon.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
                                <DialogDescription>
                                    Please fill out the form below to submit your application.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="john@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number *</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+254..."
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="resume">Resume / Portfolio Link</Label>
                                    <Input
                                        id="resume"
                                        placeholder="https://linkedin.com/in/..."
                                        value={formData.resume_link}
                                        onChange={(e) => setFormData({ ...formData, resume_link: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cover_letter">Cover Letter (Optional)</Label>
                                    <Textarea
                                        id="cover_letter"
                                        placeholder="Tell us why you're a good fit..."
                                        className="h-24"
                                        value={formData.cover_letter}
                                        onChange={(e) => setFormData({ ...formData, cover_letter: e.target.value })}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={submitting}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmitApplication} disabled={submitting} className="gap-2">
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            Submit Application
                                            <Send className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
