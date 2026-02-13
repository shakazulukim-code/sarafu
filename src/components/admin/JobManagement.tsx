import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Briefcase,
    Users,
    Plus,
    Search,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    FileText,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Types
interface JobPosition {
    id: string;
    title: string;
    description: string;
    location: string;
    type: string;
    is_active: boolean;
    created_at: string;
}

interface JobApplication {
    id: string;
    job_position_id: string;
    applicant_name: string;
    applicant_email: string;
    applicant_phone: string;
    resume_link: string | null;
    cover_letter: string | null;
    status: 'pending' | 'reviewed' | 'rejected' | 'hired';
    created_at: string;
    job_positions?: {
        title: string;
    };
}

export function JobManagement() {
    const [positions, setPositions] = useState<JobPosition[]>([]);
    const [applications, setApplications] = useState<JobApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('positions');

    // Job Form State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        location: '',
        type: 'Full-time',
        is_active: true
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'positions') {
                const { data, error } = await supabase
                    .from('job_positions')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                // Cast to any because types are not yet generated
                setPositions((data as any) || []);
            } else {
                const { data, error } = await supabase
                    .from('job_applications')
                    .select('*, job_positions(title)')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                // Cast to any because types are not yet generated
                setApplications((data as any) || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (position?: JobPosition) => {
        if (position) {
            setEditingPosition(position);
            setFormData({
                title: position.title,
                description: position.description,
                location: position.location,
                type: position.type,
                is_active: position.is_active
            });
        } else {
            setEditingPosition(null);
            setFormData({
                title: '',
                description: '',
                location: '',
                type: 'Full-time',
                is_active: true
            });
        }
        setIsDialogOpen(true);
    };

    const handleSavePosition = async () => {
        if (!formData.title || !formData.description || !formData.location) {
            toast.error('Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            if (editingPosition) {
                // Update
                const { error } = await supabase
                    .from('job_positions')
                    .update(formData)
                    .eq('id', editingPosition.id);

                if (error) throw error;
                toast.success('Job position updated');
            } else {
                // Create
                const { error } = await supabase
                    .from('job_positions')
                    .insert(formData);

                if (error) throw error;
                toast.success('Job position created');
            }

            setIsDialogOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving position:', error);
            toast.error('Failed to save job position');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePosition = async (id: string) => {
        if (!confirm('Are you sure you want to delete this position?')) return;

        try {
            const { error } = await supabase
                .from('job_positions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Job position deleted');
            fetchData();
        } catch (error) {
            console.error('Error deleting position:', error);
            toast.error('Failed to delete job position');
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('job_applications')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            toast.success(`Application marked as ${newStatus}`);

            // Update local state
            setApplications(apps =>
                apps.map(app =>
                    app.id === id ? { ...app, status: newStatus as any } : app
                )
            );
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'hired': return 'bg-success/20 text-success border-success/20';
            case 'rejected': return 'bg-destructive/20 text-destructive border-destructive/20';
            case 'reviewed': return 'bg-primary/20 text-primary border-primary/20';
            default: return 'bg-muted text-muted-foreground border-border'; // Pending
        }
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="positions" value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                    <TabsList className="bg-muted/50">
                        <TabsTrigger value="positions" className="gap-2">
                            <Briefcase className="h-4 w-4" />
                            Job Positions
                        </TabsTrigger>
                        <TabsTrigger value="applications" className="gap-2">
                            <Users className="h-4 w-4" />
                            Applications
                            {applications.filter(a => a.status === 'pending').length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                    {applications.filter(a => a.status === 'pending').length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {activeTab === 'positions' && (
                        <Button onClick={() => handleOpenDialog()} className="gap-2" variant="hero">
                            <Plus className="h-4 w-4" />
                            Post New Job
                        </Button>
                    )}
                </div>

                <TabsContent value="positions" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : positions.length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Briefcase className="h-12 w-12 mb-4 opacity-50" />
                                <p>No job positions found</p>
                                <Button onClick={() => handleOpenDialog()} variant="link" className="mt-2 text-primary">
                                    Create your first job posting
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {positions.map((position) => (
                                <Card key={position.id} className="glass-card overflow-hidden">
                                    <CardContent className="p-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{position.title}</h3>
                                                    <Badge variant={position.is_active ? 'default' : 'secondary'} className={position.is_active ? 'bg-success/20 text-success hover:bg-success/30' : ''}>
                                                        {position.is_active ? 'Active' : 'Draft'}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {position.location}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {position.type}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleOpenDialog(position)}>
                                                    <Edit className="h-4 w-4 mr-1" />
                                                    Edit
                                                </Button>
                                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeletePosition(position.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="applications" className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : applications.length === 0 ? (
                        <Card className="glass-card">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Users className="h-12 w-12 mb-4 opacity-50" />
                                <p>No applications received yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {applications.map((application) => (
                                <Card key={application.id} className="glass-card">
                                    <CardContent className="p-4 sm:p-6">
                                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{application.applicant_name}</h3>
                                                    <Badge className={`${getStatusColor(application.status)} border`}>
                                                        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Applying for <span className="text-foreground font-medium">{application.job_positions?.title || 'Unknown Position'}</span>
                                                </p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                    <a href={`mailto:${application.applicant_email}`} className="flex items-center gap-1 hover:text-primary hover:underline">
                                                        <FileText className="h-3 w-3" />
                                                        {application.applicant_email}
                                                    </a>
                                                    <a href={`tel:${application.applicant_phone}`} className="flex items-center gap-1 hover:text-primary hover:underline">
                                                        <Users className="h-3 w-3" />
                                                        {application.applicant_phone}
                                                    </a>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(application.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {application.cover_letter && (
                                                    <div className="mt-4 p-3 bg-muted/30 rounded text-sm text-muted-foreground border border-border/50">
                                                        {application.cover_letter}
                                                    </div>
                                                )}

                                                {application.resume_link && (
                                                    <div className="mt-2">
                                                        <a
                                                            href={application.resume_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            View Resume / Portfolio
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-2 min-w-[140px]">
                                                <Select
                                                    value={application.status}
                                                    onValueChange={(val) => handleUpdateStatus(application.id, val)}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="reviewed">Reviewed</SelectItem>
                                                        <SelectItem value="hired">Hired</SelectItem>
                                                        <SelectItem value="rejected">Rejected</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Create/Edit Job Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="glass-card border-none sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingPosition ? 'Edit Job Position' : 'Post New Job'}</DialogTitle>
                        <DialogDescription>
                            Create a job listing that will appear on the landing page.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Job Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Senior Frontend Developer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g. Nairobi / Remote"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                                >
                                    <SelectTrigger id="type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Full-time">Full-time</SelectItem>
                                        <SelectItem value="Part-time">Part-time</SelectItem>
                                        <SelectItem value="Contract">Contract</SelectItem>
                                        <SelectItem value="Internship">Internship</SelectItem>
                                        <SelectItem value="Freelance">Freelance</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Job Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the role, responsibilities, and requirements..."
                                className="min-h-[150px]"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <Label htmlFor="is_active" className="cursor-pointer">Active (visible on landing page)</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSavePosition} disabled={saving} variant="hero">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingPosition ? 'Update Position' : 'Post Job')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
