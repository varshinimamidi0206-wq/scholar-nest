import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  useAnalyzeDocument, useAskNestGuide, useCreateApplication, useCreateDocument, useDeleteApplication,
  useDeleteDocument, useGetCurrentUser, useGetDashboard, useGetScholarship,
  useExplainEligibility, useGetScholarshipMatches, useGetStudentProfile, useHealthCheck, useListApplications,
  useListDocuments, useListSavedScholarships, useListScholarships, useLogin,
  useListNotifications, useMarkNotificationRead,
  useLogout, useRegister, useRemoveSavedScholarship, useRequestDocumentUpload,
  useSaveScholarship, useUpdateApplication, useUpdateStudentProfile,
  setAuthTokenGetter,
  useCreateScholarship,
  useDeleteScholarship,
  useUpdateScholarship,
} from '@workspace/api-client-react';
import type {
  AiExplanation, Application, ApplicationStatus, DocumentAnalysis, ScholarshipMatch, StudentProfile,
  StudentProfileInput, DocumentInputDocumentType,
} from '@workspace/api-client-react';
import {
  ArrowDownRight, ArrowRight, Bell, Bookmark, BookOpen, BriefcaseBusiness,
  Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Compass, FileCheck2,
  FileText, Filter, Landmark, LayoutDashboard, ListChecks, LogOut,
  MessageCircle, Search, ShieldCheck, Sparkles, Target, UploadCloud, UserRound,
  Wallet, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const TOKEN_KEY = 'scholarnest_access_token';
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
const supabaseStorageUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabaseStorage = supabaseStorageUrl && supabasePublishableKey
  ? createClient(supabaseStorageUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const primaryNav = [
  { href: '/app', label: 'Overview', icon: LayoutDashboard },
  { href: '/profile', label: 'My profile', icon: UserRound },
  { href: '/scholarships', label: 'Explore scholarships', icon: Compass },
  { href: '/recommended', label: 'Recommended', icon: Target },
];
const workflowNav = [
  { href: '/saved', label: 'Saved scholarships', icon: Bookmark },
  { href: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { href: '/documents', label: 'My documents', icon: FileCheck2 },
  { href: '/deadlines', label: 'Deadlines', icon: Clock3 },
  { href: '/compare', label: 'Compare', icon: ListChecks },
  { href: '/nestguide', label: 'NestGuide', icon: MessageCircle },
];

function Notice({ children, onClose }: { children: string; onClose: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onClose, 3600); return () => window.clearTimeout(timer); }, [onClose]);
  return <div className="toast-message" role="status">{children}</div>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <div className="brand" style={light ? { color: '#f4f8fc' } : undefined}>
    <span className="brand-mark"><BookOpen size={19} strokeWidth={2.5} /></span>
    <span>ScholarNest</span>
  </div>;
}

function Sidebar({ path, userName, signOut }: { path: string; userName: string; signOut: () => void }) {
  return <aside className="sidebar">
    <Link href="/app"><Brand light /></Link>
    <div className="nav-label">Your space</div>
    {primaryNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${path === href ? 'active' : ''}`}><Icon size={17} />{label}</Link>)}
    <div className="nav-label" style={{ marginTop: 17 }}>Scholarship journey</div>
    {workflowNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${path === href ? 'active' : ''}`}><Icon size={17} />{label}</Link>)}
    <div style={{ marginTop: 'auto', padding: '16px 10px 0', borderTop: '1px solid #34465a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 14px' }}>
        <span style={{ width: 34, height: 34, background: '#d9eaf4', color: '#284b66', borderRadius: 50, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{userName.slice(0, 1).toUpperCase() || 'S'}</span>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{userName || 'Student account'}</div><div style={{ color: '#98a8b9', fontSize: 10 }}>Your scholarship journey</div></div>
      </div>
      <button className="nav-link" onClick={signOut} style={{ border: 0, background: 'transparent', width: '100%', textAlign: 'left' }}><LogOut size={16} /> Sign out</button>
    </div>
  </aside>;
}

function MobileNav({ path }: { path: string }) {
  const nav = [primaryNav[0], primaryNav[2], workflowNav[1], workflowNav[2], workflowNav[5]];
  return <nav className="mobile-menu">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href ? 'active' : ''}><Icon size={18} /><span>{label.split(' ')[0]}</span></Link>)}</nav>;
}

function PageFrame({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">ScholarNest • Student workspace</div><h1 className="display">{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</div>;
}

function Loading({ label = 'Loading your scholarship workspace…' }: { label?: string }) {
  return <div className="card card-pad" aria-label={label}><div style={{ height: 14, width: '31%', background: '#e9eff4', borderRadius: 20, marginBottom: 18 }} /><div style={{ height: 34, width: '55%', background: '#edf2f6', borderRadius: 8, marginBottom: 24 }} /><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>{[1, 2, 3].map((n) => <div key={n} style={{ height: 86, background: '#f0f4f7', borderRadius: 12 }} />)}</div></div>;
}
function ErrorState({ retry }: { retry: () => void }) {
  return <div className="card empty-state"><div className="empty-icon"><CircleHelp size={24} /></div><h3>We couldn’t load this just yet</h3><p>Your work is safe. Check your connection and try again in a moment.</p><button className="btn btn-primary" onClick={retry}>Try again</button></div>;
}
function Empty({ title, body, icon: Icon = Compass, action }: { title: string; body: string; icon?: typeof Compass; action?: ReactNode }) {
  return <div className="card empty-state"><div className="empty-icon"><Icon size={24} /></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}
function StatusChip({ status }: { status: string }) {
  const s = status.toUpperCase();
  const color = s === 'SELECTED' || s === 'READY_TO_APPLY' || s === 'APPLIED' ? 'green' : s === 'REJECTED' ? 'rose' : s === 'UNDER_REVIEW' ? 'gold' : '';
  return <span className={`chip ${color}`}>{s.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase())}</span>;
}
function MatchCard({ item, onSave, saved, compact = false }: { item: ScholarshipMatch; onSave?: () => void; saved?: boolean; compact?: boolean }) {
  return <article className="card match-card" data-testid={`card-scholarship-${item.id}`}>
    <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h3>{item.name}</h3>{item.verified && <span className="chip green"><ShieldCheck size={12} /> Verified listing</span>}</div>
      <div style={{ color: '#7a8998', fontSize: 12, marginTop: 5 }}>{item.provider}</div>
      <p>{item.description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}><span className="chip"><Wallet size={12} /> ₹{Number(item.amount || 0).toLocaleString('en-IN')}</span>{item.deadline && <span className="chip gold"><Clock3 size={12} /> Deadline {new Date(item.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}{item.eligible && <span className="chip green">{item.matchLabel}</span>}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link className="btn btn-primary" href={`/scholarships/${item.id}`}>View details <ChevronRight size={15} /></Link>{onSave && <button className="btn" onClick={onSave}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</button>}{!compact && <Link className="btn" href="/compare">Compare</Link>}</div>
    </div><div className="match-score">{item.matchScore}%</div>
  </article>;
}

function Landing() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [notice, setNotice] = useState('');
  const login = useLogin(); const register = useRegister();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '');
    const password = String(data.get('password') || '');
    const success = (session: { token: string }) => { localStorage.setItem(TOKEN_KEY, session.token); queryClient.invalidateQueries(); setLocation('/app'); };
    if (mode === 'register') register.mutate({ data: { name: String(data.get('name') || ''), email, password } }, { onSuccess: success, onError: () => setNotice('Could not create your account. Please review your details.') });
    else login.mutate({ data: { email, password } }, { onSuccess: success, onError: () => setNotice('That sign-in did not work. Check your email and password.') });
  };
  const busy = login.isPending || register.isPending;
  return <main className="landing">
    <nav className="landing-nav"><Link href="/"><Brand /></Link><div style={{ display: 'flex', gap: 10 }}><button className="btn" onClick={() => setMode('login')}>Sign in</button><button className="btn btn-primary" onClick={() => setMode('register')}>Create account <ArrowRight size={15} /></button></div></nav>
    <section className="hero">
      <div><span className="chip green"><ShieldCheck size={13} /> A clearer path to funding</span><h1>Scholarships,<br /><span>within reach.</span></h1><p>Find support that fits your story. ScholarNest turns confusing eligibility rules into a clear, practical path from your profile to a confident application.</p><div style={{ display: 'flex', gap: 10, marginTop: 25, flexWrap: 'wrap' }}><button className="btn btn-primary" style={{ padding: '12px 17px' }} onClick={() => setMode('register')}>Find my matches <ArrowRight size={16} /></button><button className="btn" style={{ padding: '12px 17px' }} onClick={() => setMode('login')}>I already have an account</button></div><div style={{ display: 'flex', gap: 22, marginTop: 27, color: '#738396', fontSize: 12 }}><span><Check size={14} style={{ verticalAlign: 'middle', color: '#30845e' }} /> Eligibility made clear</span><span><Check size={14} style={{ verticalAlign: 'middle', color: '#30845e' }} /> Your documents, organized</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-illustration"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div className="eyebrow">Your next opportunity</div><strong style={{ display: 'block', marginTop: 8, font: '750 21px Manrope', color: '#203b58' }}>A great-fit scholarship</strong></div><span className="match-score">92%</span></div><div className="illustration-lines"><i /><i /><i /></div><div style={{ background: '#f1f7f5', color: '#307955', borderRadius: 8, padding: '10px 11px', marginTop: 20, fontSize: 11, fontWeight: 700 }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> You meet the key requirements</div></div><div className="hero-stamp"><ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Your journey, in one place</div></div>
    </section>
    <section className="landing-section"><div className="eyebrow">Less guesswork. More progress.</div><h2>One steady guide,<br />from search to submitted.</h2><p className="muted" style={{ maxWidth: 600, lineHeight: 1.7 }}>A scholarship search should not feel like decoding a rulebook. We help you understand what fits, what to prepare, and what to do next.</p>
      <div className="feature-row"><div className="feature-panel"><div className="stat-icon"><Target size={18} /></div><h3>Matches with reasons</h3><p>See how your study, location, and financial details align—plus what may still need attention.</p><div style={{ borderTop: '1px solid #edf1f4', paddingTop: 15, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#597085' }}><span className="chip green">Strong match</span> Clear factors, not a mystery score</div></div>
        <div style={{ display: 'grid', gap: 16 }}><div className="feature-panel" style={{ display: 'flex', gap: 14 }}><div className="stat-icon"><FileCheck2 size={18} /></div><div><h3 style={{ marginTop: 2 }}>Documents, ready when you are</h3><p style={{ marginBottom: 0 }}>Keep your important files and scholarship checklists together.</p></div></div><div className="feature-panel" style={{ display: 'flex', gap: 14 }}><div className="stat-icon"><Clock3 size={18} /></div><div><h3 style={{ marginTop: 2 }}>Deadlines that stay visible</h3><p style={{ marginBottom: 0 }}>A simple view of upcoming dates, so the next step never sneaks up.</p></div></div></div></div>
    </section>
    <section style={{ background: '#eaf3f8', padding: '65px 25px', textAlign: 'center' }}><div className="eyebrow">Start with your story</div><h2 className="display" style={{ fontSize: 'clamp(30px,4vw,43px)', color: '#193650', margin: '12px 0' }}>Your next step can be simple.</h2><p className="muted">Build your profile once. See opportunities shaped around you.</p><button className="btn btn-primary" onClick={() => setMode('register')} style={{ marginTop: 15 }}>Get started <ArrowRight size={15} /></button></section>
    <footer className="landing-footer"><span>© ScholarNest · Made for student journeys across India</span><span>Clear information. Confident next steps.</span></footer>
    {mode && <div onClick={() => setMode(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#12263a80', display: 'grid', placeItems: 'center', padding: 18 }}><div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(100%,440px)', padding: 28, position: 'relative' }}><button aria-label="Close" className="btn" onClick={() => setMode(null)} style={{ position: 'absolute', right: 18, top: 18, padding: 7 }}><X size={17} /></button><Brand /><h2 className="display" style={{ margin: '22px 0 6px', fontSize: 27 }}>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2><p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{mode === 'register' ? 'A better scholarship journey starts here.' : 'Pick up right where you left off.'}</p><form onSubmit={submit}>{mode === 'register' && <div className="field"><label className="label">Your name</label><input name="name" required className="input" placeholder="Full name" /></div>}<div className="field"><label className="label">Email address</label><input name="email" type="email" required className="input" placeholder="you@example.com" /></div><div className="field"><label className="label">Password</label><input name="password" type="password" minLength={mode === 'register' ? 8 : 1} required className="input" placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} /></div><button disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: 12 }}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button></form><p style={{ textAlign: 'center', fontSize: 12, color: '#758396', marginBottom: 0 }}>{mode === 'register' ? 'Already registered?' : 'New to ScholarNest?'} <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')} style={{ color: '#276ca3', border: 0, background: 'none', fontWeight: 700 }}>{mode === 'register' ? 'Sign in' : 'Create an account'}</button></p></div></div>}
    {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
  </main>;
}

function Workspace({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const user = useGetCurrentUser();
  const health = useHealthCheck({ query: { queryKey: ['/api/healthz'], staleTime: 60_000 } });
  const logout = useLogout();
  const [, setLocation] = useLocation();
  const signOut = () => logout.mutate(undefined, { onSettled: () => { localStorage.removeItem(TOKEN_KEY); queryClient.clear(); setLocation('/'); } });
  return <div className="app-shell"><Sidebar path={path} userName={user.data?.name || ''} signOut={signOut} /><main className="main-area"><header className="topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="eyebrow" style={{ letterSpacing: '.04em', textTransform: 'none', color: '#758396' }}>Your scholarship workspace</span><span className={`chip ${health.isError ? 'rose' : 'green'}`} aria-label={health.isError ? 'API unavailable' : 'API available'}>{health.isError ? 'Service unavailable' : 'Service ready'}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 13 }}><NotificationMenu /><Link href="/nestguide" className="btn" style={{ padding: '7px 10px' }}><MessageCircle size={15} /> Ask NestGuide</Link><span style={{ height: 34, width: 34, borderRadius: 50, background: '#e3eff7', color: '#2c618a', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>{user.data?.name?.slice(0, 1) || 'S'}</span></div></header>{children}</main><MobileNav path={path} /></div>;
}

function NotificationMenu() {
  const notifications = useListNotifications();
  const markRead = useMarkNotificationRead();
  const [open, setOpen] = useState(false);
  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.read).length;
  const qc = useQueryClient();
  return <div style={{ position: 'relative' }}>
    <button className="btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)} style={{ padding: '8px 10px', position: 'relative' }}><Bell size={16} />{unread > 0 && <span style={{ position: 'absolute', top: -5, right: -5, borderRadius: 20, minWidth: 17, height: 17, background: '#c75d55', color: 'white', fontSize: 9, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{unread}</span>}</button>
    {open && <div className="card" style={{ position: 'absolute', zIndex: 30, right: 0, top: 42, width: 'min(340px, calc(100vw - 36px))', padding: 12, boxShadow: '0 14px 38px #20364a24' }}>
      <div className="eyebrow" style={{ margin: '3px 5px 10px' }}>Notifications</div>
      {notifications.isLoading ? <p className="muted" style={{ padding: 8, fontSize: 12 }}>Loading notifications…</p> : notifications.isError ? <p role="alert" className="muted" style={{ padding: 8, fontSize: 12 }}>Notifications are unavailable.</p> : items.length ? <div style={{ display: 'grid', gap: 5, maxHeight: 340, overflowY: 'auto' }}>{items.map((item) => <button key={item.id} onClick={() => !item.read && markRead.mutate({ id: item.id }, { onSuccess: () => qc.invalidateQueries() })} className="btn" style={{ display: 'block', textAlign: 'left', whiteSpace: 'normal', padding: 10, background: item.read ? '#fff' : '#f0f6fa', borderColor: '#e8eef3' }}><strong style={{ display: 'block', color: '#34516b', fontSize: 12 }}>{item.title}</strong><span style={{ display: 'block', fontSize: 11, lineHeight: 1.5, color: '#738396', marginTop: 3 }}>{item.message}</span><span className="muted" style={{ display: 'block', fontSize: 10, marginTop: 5 }}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</span></button>)}</div> : <p className="muted" style={{ padding: 8, fontSize: 12 }}>You’re all caught up. Updates will appear here.</p>}
    </div>}
  </div>;
}

function DashboardPage() {
  const d = useGetDashboard(); const profile = useGetStudentProfile();
  const [notice, setNotice] = useState('');
  const save = useSaveScholarship(); const qc = useQueryClient();
  if (d.isLoading) return <PageFrame title="Good things take a plan"><Loading /></PageFrame>;
  if (d.isError) return <PageFrame title="Your overview"><ErrorState retry={() => d.refetch()} /></PageFrame>;
  const dashboard = d.data;
  return <PageFrame title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}${dashboard?.user?.name ? `, ${dashboard.user.name.split(' ')[0]}` : ''}.`} subtitle="Your scholarship journey, one clear next step at a time.">
    {!profile.data && <div className="card" style={{ background: '#eef6fb', padding: 18, display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'center', marginBottom: 18 }}><div><div className="eyebrow">Start with your profile</div><strong style={{ display: 'block', marginTop: 5 }}>A few details unlock more relevant matches.</strong></div><Link className="btn btn-primary" href="/profile">Complete profile <ArrowRight size={15} /></Link></div>}
    <div className="stat-grid">{([
      { label: 'Profile complete', value: `${dashboard?.stats.profileCompletion ?? profile.data?.profileCompletion ?? 0}%`, Icon: UserRound },
      { label: 'Scholarships found', value: dashboard?.stats.scholarshipsFound ?? 0, Icon: Compass },
      { label: 'Strong matches', value: dashboard?.stats.strongMatches ?? 0, Icon: Target },
      { label: 'Deadlines this week', value: dashboard?.stats.deadlinesThisWeek ?? 0, Icon: Clock3 },
    ] satisfies Array<{ label: string; value: string | number; Icon: typeof UserRound }>).map(({ label, value, Icon }) => <div key={label} className="card stat-card"><span className="stat-icon"><Icon size={17} /></span><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>)}</div>
    <div className="section-title"><h2>Matches worth a closer look</h2><Link href="/recommended" style={{ color: '#286b9f', fontSize: 12, fontWeight: 700 }}>See all matches <ArrowRight size={13} style={{ verticalAlign: 'middle' }} /></Link></div>
    {dashboard?.bestMatches?.length ? <div style={{ display: 'grid', gap: 12 }}>{dashboard.bestMatches.slice(0, 3).map(m => <MatchCard key={m.id} item={m} onSave={() => save.mutate({ data: { scholarshipId: m.id } }, { onSuccess: () => { qc.invalidateQueries(); setNotice('Scholarship saved to your list.'); } })} />)}</div> : <Empty title="Your matches are taking shape" body="Complete your student profile so we can show opportunities aligned to your situation." icon={Target} action={<Link className="btn btn-primary" href="/profile">Add profile details</Link>} />}
    <div className="section-title"><h2>Application progress</h2><Link href="/applications" style={{ color: '#286b9f', fontSize: 12, fontWeight: 700 }}>Open tracker <ArrowRight size={13} style={{ verticalAlign: 'middle' }} /></Link></div>
    {dashboard?.applications?.length ? <div className="card table-wrap"><table><thead><tr><th>Scholarship</th><th>Deadline</th><th>Status</th><th>Last updated</th></tr></thead><tbody>{dashboard.applications.slice(0, 4).map(a => <tr key={a.id}><td><strong>{a.scholarshipName}</strong><div className="muted" style={{ fontSize: 11 }}>{a.provider}</div></td><td>{a.deadline ? new Date(a.deadline).toLocaleDateString('en-IN') : '—'}</td><td><StatusChip status={a.status} /></td><td>{new Date(a.updatedAt).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div> : <Empty title="No applications in your tracker" body="Save an opportunity or start an application to keep your next steps organized." icon={BriefcaseBusiness} action={<Link className="btn" href="/scholarships">Explore scholarships</Link>} />}
    {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
  </PageFrame>;
}

function ProfilePage() {
  const { data, isLoading, isError } = useGetStudentProfile();
  const update = useUpdateStudentProfile(); const qc = useQueryClient();
  const [notice, setNotice] = useState('');
  if (isLoading) return <PageFrame title="My profile"><Loading /></PageFrame>;
  if (isError) return <PageFrame title="My profile"><div className="card card-pad" style={{ marginBottom: 14 }}>Add or update your details to get relevant scholarship matches.</div><ProfileForm initial={null} submit={update.mutate} pending={update.isPending} saved={() => { qc.invalidateQueries(); setNotice('Your profile is saved.'); }} /></PageFrame>;
  return <PageFrame title="My profile" subtitle="Your details help us find scholarships that fit. Your information stays private." action={data && <span className="chip green"><CheckCircle2 size={13} /> {data.profileCompletion}% complete</span>}>
    <ProfileForm initial={data || null} submit={update.mutate} pending={update.isPending} saved={() => { qc.invalidateQueries(); setNotice('Your profile is saved.'); }} />
    {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
  </PageFrame>;
}
function ProfileForm({ initial, submit, pending, saved }: { initial: StudentProfile | null; submit: ReturnType<typeof useUpdateStudentProfile>['mutate']; pending: boolean; saved: () => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>(() => ({
    fullName: initial?.fullName || '', age: initial?.age?.toString() || '', state: initial?.state || '', district: initial?.district || '', course: initial?.course || '', branch: initial?.branch || '', year: initial?.year || '', collegeName: initial?.collegeName || '', collegeType: initial?.collegeType || '', cgpa: initial?.cgpa?.toString() || '', percentage: initial?.percentage?.toString() || '', annualFamilyIncome: initial?.annualFamilyIncome?.toString() || '', category: initial?.category || '', gender: initial?.gender || '', disabilityStatus: initial?.disabilityStatus || false, minorityStatus: initial?.minorityStatus || false, ruralUrban: initial?.ruralUrban || '', previousScholarship: initial?.previousScholarship || false, achievements: initial?.achievements || '',
  }));
  const field = (key: string, label: string, placeholder = '', type = 'text') => <div className="field"><label className="label" htmlFor={`profile-${key}`}>{label}</label><input id={`profile-${key}`} className="input" type={type} value={String(form[key] ?? '')} placeholder={placeholder} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>;
  const select = (key: string, label: string, options: string[]) => <div className="field"><label className="label" htmlFor={`profile-${key}`}>{label}</label><select id={`profile-${key}`} className="select" value={String(form[key] ?? '')} onChange={e => setForm({ ...form, [key]: e.target.value })}><option value="">Select</option>{options.map(v => <option key={v}>{v}</option>)}</select></div>;
  const toggle = (key: string, label: string) => <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#4c6074', margin: '8px 0' }}><input type="checkbox" checked={Boolean(form[key])} onChange={e => setForm({ ...form, [key]: e.target.checked })} />{label}</label>;
  const save = () => {
    const n = (key: string) => String(form[key] || '').trim();
    const nullable = (key: string) => n(key) ? Number(n(key)) : null;
    submit({ data: { fullName: n('fullName'), age: nullable('age'), state: n('state'), district: n('district'), course: n('course'), branch: n('branch'), year: n('year'), collegeName: n('collegeName'), collegeType: n('collegeType'), cgpa: nullable('cgpa'), percentage: nullable('percentage'), annualFamilyIncome: nullable('annualFamilyIncome'), category: n('category'), gender: n('gender'), disabilityStatus: Boolean(form.disabilityStatus), minorityStatus: Boolean(form.minorityStatus), ruralUrban: n('ruralUrban') as StudentProfileInput['ruralUrban'], previousScholarship: Boolean(form.previousScholarship), achievements: n('achievements') } }, { onSuccess: saved });
  };
  return <div className="card card-pad"><div className="eyebrow">Student details</div><div className="two-col" style={{ marginTop: 18 }}>{field('fullName', 'Full name', 'As on your documents')}{field('age', 'Age', 'Your age', 'number')}{field('state', 'State / UT', 'e.g. Karnataka')}{field('district', 'District', 'Your district')}{field('course', 'Course', 'e.g. B.Tech')}{field('branch', 'Branch / subject', 'e.g. Computer Science')}{field('year', 'Current year', 'e.g. 2nd year')}{field('collegeName', 'College / institution')}{select('collegeType', 'Institution type', ['Government', 'Private', 'Aided', 'Other'])}{field('cgpa', 'CGPA (out of 10)', 'Optional', 'number')}{field('percentage', 'Percentage', 'Optional', 'number')}{field('annualFamilyIncome', 'Annual family income (₹)', 'As per latest certificate', 'number')}{select('category', 'Category', ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'])}{select('gender', 'Gender', ['Female', 'Male', 'Other'])}{select('ruralUrban', 'Area', ['rural', 'urban'])}</div><div style={{ borderTop: '1px solid #edf1f4', paddingTop: 13, marginTop: 4 }}>{toggle('disabilityStatus', 'I have a disability certificate')}{toggle('minorityStatus', 'I belong to a minority community')}{toggle('previousScholarship', 'I have received a scholarship before')}</div><div className="field" style={{ marginTop: 18 }}><label className="label">Achievements or additional context</label><textarea className="textarea" value={String(form.achievements)} onChange={e => setForm({ ...form, achievements: e.target.value })} placeholder="Share details that could help identify suitable opportunities" /></div><button className="btn btn-primary" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save profile'} <Check size={15} /></button></div>;
}

function ExplorePage({ recommended = false, savedOnly = false }: { recommended?: boolean; savedOnly?: boolean }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All matches');
  const [course, setCourse] = useState('');
  const queryParams = useMemo(() => ({ q: search || undefined, course: course || undefined, sort: 'best-match' as const }), [search, course]);
  const all = useListScholarships(queryParams);
  const matches = useGetScholarshipMatches();
  const saved = useListSavedScholarships();
  const save = useSaveScholarship(); const remove = useRemoveSavedScholarship(); const qc = useQueryClient();
  const data = savedOnly ? saved.data : recommended ? matches.data : all.data;
  const isLoading = savedOnly ? saved.isLoading : recommended ? matches.isLoading : all.isLoading;
  const isError = savedOnly ? saved.isError : recommended ? matches.isError : all.isError;
  const visible = (data || []).filter(item => {
    const textMatch = `${item.name} ${item.provider} ${item.description}`.toLowerCase().includes(search.toLowerCase());
    if (!textMatch) return false;
    if (filter === 'Eligible for me') return item.eligible;
    if (filter === 'Closing soon') return item.deadline && new Date(item.deadline).getTime() < Date.now() + 45 * 86400000;
    return true;
  });
  const title = savedOnly ? 'Saved scholarships' : recommended ? 'Your recommended matches' : 'Explore scholarships';
  const retry = () => { all.refetch(); matches.refetch(); saved.refetch(); };
  return <PageFrame title={title} subtitle={savedOnly ? 'Keep promising opportunities close while you plan your next step.' : 'Search verified opportunities and see how they fit your profile.'}>
    <div className="card card-pad" style={{ marginBottom: 18 }}><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><div style={{ flex: '1 1 230px', position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#8090a0' }} /><input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scholarships, providers…" style={{ paddingLeft: 37 }} aria-label="Search scholarships" /></div><input className="input" style={{ flex: '0 1 180px' }} value={course} onChange={e => setCourse(e.target.value)} placeholder="Filter by course" aria-label="Filter by course" /><button className="btn"><Filter size={15} /> Filters</button></div><div className="pill-tabs" style={{ margin: '14px 0 0' }}>{['All matches', 'Eligible for me', 'Closing soon'].map(item => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
    {isLoading ? <Loading label="Finding scholarships…" /> : isError ? <ErrorState retry={retry} /> : visible.length ? <><p className="muted" style={{ fontSize: 12 }}>{visible.length} opportunity{visible.length !== 1 ? 'ies' : ''} to explore</p><div style={{ display: 'grid', gap: 12 }}>{visible.map(item => <MatchCard key={item.id} item={item} onSave={() => (savedOnly ? remove.mutate({ scholarshipId: item.id }, { onSuccess: () => qc.invalidateQueries() }) : save.mutate({ data: { scholarshipId: item.id } }, { onSuccess: () => qc.invalidateQueries() }))} saved={savedOnly} />)}</div></> : <Empty title={savedOnly ? 'Your shortlist starts here' : 'No scholarships match those filters'} body={savedOnly ? 'Save opportunities as you explore, then come back to compare and plan.' : 'Try a broader search or remove a filter to see more opportunities.'} icon={savedOnly ? Bookmark : Search} action={savedOnly ? <Link className="btn btn-primary" href="/scholarships">Explore scholarships</Link> : <button className="btn" onClick={() => { setSearch(''); setCourse(''); setFilter('All matches'); }}>Clear filters</button>} />}
  </PageFrame>;
}

function ScholarshipDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useGetScholarship(id, { query: { enabled: !!id, queryKey: ['/api/scholarships', id] } });
  const save = useSaveScholarship(); const createApp = useCreateApplication(); const qc = useQueryClient();
  const explain = useExplainEligibility();
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [msg, setMsg] = useState('');
  if (isLoading) return <PageFrame title="Scholarship details"><Loading /></PageFrame>;
  if (isError || !data) return <PageFrame title="Scholarship details"><ErrorState retry={() => refetch()} /></PageFrame>;
  const breakdown = data.breakdown;
  const factors = [['Academic', breakdown.academic, 25], ['Family income', breakdown.income, 20], ['Course', breakdown.course, 20], ['Location', breakdown.location, 15], ['Category', breakdown.category, 10], ['Other', breakdown.other, 10]] as const;
  return <PageFrame title={data.name} subtitle={data.provider} action={<Link className="btn" href="/scholarships">← Back to scholarships</Link>}>
    <div className="split"><div>
      <div className="card card-pad"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, flexWrap: 'wrap' }}><div><div className="eyebrow">Scholarship overview</div><h2 className="display" style={{ fontSize: 26, margin: '8px 0' }}>₹{Number(data.amount).toLocaleString('en-IN')}<span style={{ fontSize: 13, color: '#78889a', fontFamily: 'DM Sans', letterSpacing: 0 }}> / award</span></h2></div><div className="match-score" style={{ width: 68, height: 68, fontSize: 16 }}>{data.matchScore}%</div></div><p style={{ color: '#617489', lineHeight: 1.7, fontSize: 14 }}>{data.description}</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className={`chip ${data.eligible ? 'green' : 'rose'}`}>{data.eligible ? data.matchLabel : 'Not eligible yet'}</span>{data.verified && <span className="chip green"><ShieldCheck size={12} /> Verified listing</span>}{data.deadline && <span className="chip gold"><Clock3 size={12} /> Apply by {new Date(data.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}</div><div style={{ display: 'flex', gap: 9, marginTop: 20, flexWrap: 'wrap' }}><button className="btn btn-primary" disabled={createApp.isPending} onClick={() => createApp.mutate({ data: { scholarshipId: data.id, status: 'INTERESTED' } }, { onSuccess: () => { qc.invalidateQueries(); setMsg('Added to your application tracker.'); } })}><BriefcaseBusiness size={15} /> Add to tracker</button><button className="btn" onClick={() => save.mutate({ data: { scholarshipId: data.id } }, { onSuccess: () => { qc.invalidateQueries(); setMsg('Saved to your shortlist.'); } })}><Bookmark size={15} /> Save scholarship</button>{data.officialUrl && <a className="btn" href={data.officialUrl} target="_blank" rel="noreferrer">Official site <ArrowDownRight size={14} /></a>}</div></div>
      <div className="section-title"><h2>Your match, explained</h2></div><div className="card card-pad"><p className="muted" style={{ fontSize: 12, marginTop: 0 }}>A deterministic comparison of your profile with the published requirements.</p>{factors.map(([label, value, max]) => <div key={label} style={{ margin: '17px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}><span style={{ color: '#41566b', fontWeight: 700 }}>{label}</span><span className="muted">{value} / {max}</span></div><div className="progress"><span style={{ width: `${Math.min(value / max * 100, 100)}%` }} /></div></div>)}</div>
       <div className="section-title"><h2>Requirements checklist</h2></div><div className="card card-pad"><div className="two-col"><div><div className="eyebrow" style={{ color: '#32805b' }}>Matched</div>{data.matchedRequirements?.length ? data.matchedRequirements.map(x => <div key={x} style={{ marginTop: 11, fontSize: 13, color: '#486153' }}><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 7, color: '#4a9a6e' }} />{x}</div>) : <p className="muted" style={{ fontSize: 12 }}>No matching criteria listed yet.</p>}</div><div><div className="eyebrow" style={{ color: '#a16e34' }}>Needs attention</div>{data.missingRequirements?.length ? data.missingRequirements.map(x => <div key={x} style={{ marginTop: 11, fontSize: 13, color: '#6b5b49' }}><CircleHelp size={15} style={{ verticalAlign: 'middle', marginRight: 7, color: '#b7803d' }} />{x}</div>) : <p className="muted" style={{ fontSize: 12 }}>Nothing outstanding from the information provided.</p>}</div></div><button className="btn" style={{ marginTop: 18 }} disabled={explain.isPending} onClick={() => explain.mutate({ data: { scholarshipId: data.id } }, { onSuccess: setExplanation })}><Sparkles size={15} />{explain.isPending ? 'Preparing explanation…' : 'Explain this match'}</button>{explain.isError && <p role="alert" className="muted" style={{ fontSize: 12 }}>The explanation is unavailable just now. Your deterministic match details above are still available.</p>}{explanation && <div style={{ marginTop: 15, padding: 14, background: '#f4f8fa', borderRadius: 10 }}><strong style={{ color: '#34516b', fontSize: 13 }}>In plain language</strong><p style={{ fontSize: 12, lineHeight: 1.65, color: '#5f7182' }}>{explanation.matchSummary}</p>{explanation.nextSteps.map((step, i) => <div key={i} style={{ fontSize: 12, color: '#52697d', marginTop: 8 }}>{i + 1}. {step}</div>)}<p className="muted" style={{ fontSize: 10, marginBottom: 0 }}>AI guidance does not change your match or replace the provider’s official rules.</p></div>}</div>
    </div><aside><div className="card card-pad"><div className="eyebrow">Eligibility at a glance</div><h3 style={{ font: '700 15px Manrope', color: '#25425d' }}>Key requirements</h3><ul style={{ margin: 0, paddingLeft: 18, color: '#68798b', fontSize: 12, lineHeight: 2 }}>{data.courseEligibility?.map(x => <li key={x}>{x}</li>)}{data.minimumCgpa != null && <li>Minimum CGPA: {data.minimumCgpa}</li>}{data.maximumIncome != null && <li>Family income up to ₹{data.maximumIncome.toLocaleString('en-IN')}</li>}{data.eligibleStates?.length > 0 && <li>States: {data.eligibleStates.join(', ')}</li>}{data.eligibleCategories?.length > 0 && <li>Categories: {data.eligibleCategories.join(', ')}</li>}</ul><div className="eyebrow" style={{ marginTop: 20 }}>Documents to prepare</div>{data.requiredDocuments?.map(d => <div key={d} style={{ marginTop: 11, fontSize: 12, color: '#50657a' }}><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 7, color: '#437ba3' }} />{d}</div>)}<Link className="btn btn-soft" href="/documents" style={{ width: '100%', marginTop: 20 }}>Organize documents <ArrowRight size={14} /></Link></div></aside></div>
    {msg && <Notice onClose={() => setMsg('')}>{msg}</Notice>}
  </PageFrame>;
}

function ApplicationsPage() {
  const q = useListApplications(); const update = useUpdateApplication(); const remove = useDeleteApplication(); const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('All');
  const apps = (q.data || []).filter(a => statusFilter === 'All' || a.status === statusFilter);
  const statusOptions: ApplicationStatus[] = ['SAVED', 'INTERESTED', 'DOCUMENTS_PREPARING', 'READY_TO_APPLY', 'APPLIED', 'UNDER_REVIEW', 'SELECTED', 'REJECTED'];
  if (q.isLoading) return <PageFrame title="Applications"><Loading /></PageFrame>;
  if (q.isError) return <PageFrame title="Applications"><ErrorState retry={() => q.refetch()} /></PageFrame>;
  return <PageFrame title="Applications" subtitle="Keep every opportunity moving, with notes and status in one place." action={<Link className="btn btn-primary" href="/scholarships"><Compass size={15} /> Find a scholarship</Link>}>
    <div className="pill-tabs">{['All', ...statusOptions].map(s => <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'selected' : ''}>{s === 'All' ? s : s.replaceAll('_', ' ')}</button>)}</div>
    {apps.length ? <div style={{ display: 'grid', gap: 12 }}>{apps.map(a => <ApplicationCard key={a.id} app={a} statusOptions={statusOptions} onStatus={status => update.mutate({ id: a.id, data: { status } }, { onSuccess: () => qc.invalidateQueries() })} onDelete={() => { if (window.confirm(`Remove ${a.scholarshipName} from your tracker?`)) remove.mutate({ id: a.id }, { onSuccess: () => qc.invalidateQueries() }); }} onSaveNotes={notes => update.mutate({ id: a.id, data: { notes } }, { onSuccess: () => qc.invalidateQueries() })} />)}</div> : <Empty title="A calmer way to track your applications" body="Add scholarships to your tracker and stay on top of documents, next steps, and decisions." icon={BriefcaseBusiness} action={<Link className="btn btn-primary" href="/scholarships">Explore scholarships</Link>} />}
  </PageFrame>;
}
function ApplicationCard({ app, statusOptions, onStatus, onDelete, onSaveNotes }: { app: Application; statusOptions: ApplicationStatus[]; onStatus: (s: ApplicationStatus) => void; onDelete: () => void; onSaveNotes: (n: string) => void }) {
  const [notes, setNotes] = useState(app.notes || '');
  return <div className="card card-pad"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h3 style={{ margin: 0, font: '700 16px Manrope', color: '#233c56' }}>{app.scholarshipName}</h3><p className="muted" style={{ fontSize: 12, margin: '5px 0 12px' }}>{app.provider}</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatusChip status={app.status} />{app.deadline && <span className="chip gold"><Clock3 size={12} /> Due {new Date(app.deadline).toLocaleDateString('en-IN')}</span>}</div></div><div style={{ display: 'flex', gap: 8, alignItems: 'start' }}><select className="select" aria-label="Update application status" value={app.status} onChange={e => onStatus(e.target.value as ApplicationStatus)} style={{ width: 'auto' }}>{statusOptions.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select><button className="btn btn-danger" onClick={onDelete} aria-label="Remove application"><X size={15} /></button></div></div><div style={{ display: 'flex', gap: 8, marginTop: 18 }}><input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a note or next step…" /><button className="btn" onClick={() => onSaveNotes(notes)}>Save note</button></div></div>;
}

const documentTypes: DocumentInputDocumentType[] = ['Income Certificate', 'Caste/Category Certificate', 'Marks Memo', 'Bonafide Certificate', 'Identity Document', 'Disability Certificate', 'Bank Document', 'Other'];
function DocumentsPage() {
  const q = useListDocuments(); const request = useRequestDocumentUpload(); const create = useCreateDocument(); const remove = useDeleteDocument(); const qc = useQueryClient();
  const analyze = useAnalyzeDocument();
  const [type, setType] = useState<DocumentInputDocumentType>('Other'); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Record<string, DocumentAnalysis>>({});
  const [analysisError, setAnalysisError] = useState('');
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Files must be smaller than 8 MB.');
      const extension = file.name.split('.').pop()?.toLowerCase();
      const contentType = file.type || (extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension || '') ? 'image/jpeg' : '');
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(contentType)) throw new Error('Upload a PDF, PNG, or JPEG file.');
      const instructions = await request.mutateAsync({ data: { fileName: file.name, contentType } });
      if (!supabaseStorage) throw new Error('Secure file storage is not configured. Please contact support.');
      const { error: uploadError } = await supabaseStorage.storage
        .from(instructions.bucket)
        .uploadToSignedUrl(instructions.path, instructions.token, file, { contentType, upsert: false });
      if (uploadError) throw new Error('The file could not be uploaded. Please try again.');
      await create.mutateAsync({ data: { fileName: file.name, documentType: type, storagePath: instructions.path } });
      await qc.invalidateQueries(); setNotice('Document uploaded and added to your private checklist.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please try again.'); }
    finally { setBusy(false); }
  };
  if (q.isLoading) return <PageFrame title="My documents"><Loading /></PageFrame>;
  if (q.isError) return <PageFrame title="My documents"><ErrorState retry={() => q.refetch()} /></PageFrame>;
  return <PageFrame title="My documents" subtitle="A private home for the files that support your applications.">
     <div className="split"><div className="card card-pad"><div className="eyebrow">Upload a document</div><h2 className="display" style={{ fontSize: 20, margin: '8px 0 16px' }}>Keep your checklist close.</h2><div className="field"><label className="label">Document type</label><select className="select" value={type} onChange={e => setType(e.target.value as DocumentInputDocumentType)}>{documentTypes.map(t => <option key={t}>{t}</option>)}</select></div><label htmlFor="document-upload" style={{ minHeight: 150, border: '1.5px dashed #bfd0df', background: '#f7fafc', borderRadius: 12, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20, cursor: busy ? 'wait' : 'pointer' }}><span><span className="empty-icon"><UploadCloud size={23} /></span><strong style={{ display: 'block', color: '#34536f', fontSize: 13 }}>{busy ? 'Uploading securely…' : 'Choose a file to upload'}</strong><span className="muted" style={{ fontSize: 11 }}>PDF, PNG, or JPEG up to 8 MB; stored privately</span></span></label><input id="document-upload" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = ''; }} style={{ display: 'none' }} />{error && <p role="alert" style={{ color: '#a14c4c', fontSize: 12 }}>{error}</p>}<p className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>Uploaded files are stored in your configured private storage. AI-assisted document analysis does not verify official documents.</p></div>
      <div className="card card-pad"><div className="eyebrow">Useful to prepare</div><h3 style={{ font: '700 16px Manrope', margin: '8px 0 16px' }}>Common scholarship documents</h3>{documentTypes.slice(0, 7).map((d, i) => <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 0', borderBottom: i < 6 ? '1px solid #edf1f4' : 0, color: '#53687c', fontSize: 12 }}><FileText size={15} color="#5886a8" />{d}<span style={{ marginLeft: 'auto', color: '#9aa6b2' }}>Checklist</span></div>)}</div></div>
    <div className="section-title"><h2>Uploaded documents</h2><span className="chip">{q.data?.length || 0} files</span></div>
     {analysisError && <p role="alert" className="muted">{analysisError}</p>}
     {q.data?.length ? <div style={{ display: 'grid', gap: 10 }}>{q.data.map(d => <div key={d.id} className="card card-pad"><div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><span className="stat-icon"><FileText size={17} /></span><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{d.fileName}</strong><span className="muted" style={{ fontSize: 11 }}>{d.documentType} · Added {new Date(d.uploadedAt).toLocaleDateString('en-IN')}</span></div><StatusChip status={d.status} /><button className="btn" disabled={analyze.isPending} onClick={async () => { setAnalysisError(''); try { const result = await analyze.mutateAsync({ data: { documentId: d.id } }); setAnalysis(old => ({ ...old, [d.id]: result })); } catch { setAnalysisError('Document analysis is unavailable. Your original file remains unchanged.'); } }}>Review details</button><button className="btn btn-danger" aria-label="Delete document" onClick={() => { if (window.confirm(`Delete ${d.fileName}?`)) remove.mutate({ id: d.id }, { onSuccess: () => { qc.invalidateQueries(); setAnalysis(old => { const next = { ...old }; delete next[d.id]; return next; }); } }); }}><X size={15} /></button></div>{analysis[d.id] && <div style={{ marginTop: 14, padding: 14, background: '#f5f8fa', borderRadius: 9, fontSize: 12, color: '#596e81' }}><strong style={{ color: '#34516b' }}>AI-assisted extraction · {Math.round((analysis[d.id]?.confidence ?? 0) * 100)}% confidence</strong><p style={{ margin: '8px 0' }}>Detected type: {analysis[d.id]?.documentType}{analysis[d.id]?.studentName ? ` · Student: ${analysis[d.id]?.studentName}` : ''}{analysis[d.id]?.annualIncome != null ? ` · Income: ₹${analysis[d.id]?.annualIncome?.toLocaleString('en-IN')}` : ''}</p>{analysis[d.id]?.possibleIssues?.map((issue, i) => <div key={i}>• {issue}</div>)}<div className="muted" style={{ fontSize: 10, marginTop: 8 }}>This extraction may be incomplete. It does not verify document authenticity.</div></div>}</div>)}</div> : <Empty title="Your document shelf is empty" body="Upload important certificates and academic documents to keep your application preparation organized." icon={FileCheck2} />}
    {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
  </PageFrame>;
}

function DeadlinesPage() {
  const dashboard = useGetDashboard(); const matches = useGetScholarshipMatches(); const apps = useListApplications();
  if (dashboard.isLoading || matches.isLoading || apps.isLoading) return <PageFrame title="Deadlines"><Loading /></PageFrame>;
  if (dashboard.isError && matches.isError) return <PageFrame title="Deadlines"><ErrorState retry={() => { dashboard.refetch(); matches.refetch(); }} /></PageFrame>;
  const combined = new Map<string, ScholarshipMatch>();
  [...(dashboard.data?.deadlines || []), ...(matches.data || [])].forEach(s => { if (s.deadline) combined.set(s.id, s); });
  const rows = [...combined.values()].sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime());
  const upcoming = rows.filter(r => new Date(r.deadline || '').getTime() >= new Date().setHours(0, 0, 0, 0));
  return <PageFrame title="Deadlines" subtitle="Dates are taken from scholarship listings. Always confirm details on the official application page.">
    <div className="card card-pad" style={{ background: '#eaf3f8', marginBottom: 18, display: 'flex', gap: 15, alignItems: 'center' }}><span className="stat-icon"><Clock3 size={18} /></span><div><strong style={{ color: '#274d6c' }}>{upcoming.length} upcoming deadline{upcoming.length === 1 ? '' : 's'}</strong><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Based on current matches and scholarship deadlines.</div></div></div>
    {upcoming.length ? <div style={{ display: 'grid', gap: 11 }}>{upcoming.map(item => { const days = Math.ceil((new Date(item.deadline || '').getTime() - Date.now()) / 86400000); const application = apps.data?.find(a => a.scholarshipId === item.id); return <div className="card" key={item.id} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}><div style={{ minWidth: 58, borderRadius: 11, background: days < 15 ? '#fff2de' : '#edf4f9', color: days < 15 ? '#a2712b' : '#356e98', padding: '8px 6px', textAlign: 'center' }}><strong style={{ display: 'block', fontSize: 18 }}>{new Date(item.deadline || '').getDate()}</strong><span style={{ fontSize: 10, textTransform: 'uppercase' }}>{new Date(item.deadline || '').toLocaleDateString('en-IN', { month: 'short' })}</span></div><div style={{ flex: 1 }}><strong style={{ font: '700 14px Manrope', color: '#2a435e' }}>{item.name}</strong><div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{item.provider} · {days === 0 ? 'Due today' : `${days} days remaining`}{application ? ` · ${application.status.replaceAll('_', ' ')}` : ''}</div></div><Link className="btn" href={`/scholarships/${item.id}`}>Details <ChevronRight size={14} /></Link></div>; })}</div> : <Empty title="No upcoming dates found" body="As your matching opportunities load in, published deadlines will be gathered here." icon={Clock3} action={<Link className="btn" href="/scholarships">Explore scholarships</Link>} />}
  </PageFrame>;
}

function ComparePage() {
  const saved = useListSavedScholarships(); const [selected, setSelected] = useState<string[]>([]);
  const options = saved.data || [];
  const visible = options.filter(s => selected.includes(s.id)).slice(0, 3);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : current.length < 3 ? [...current, id] : current);
  return <PageFrame title="Compare scholarships" subtitle="Lay out the details side by side. Choose up to three saved opportunities.">
    {saved.isLoading ? <Loading /> : saved.isError ? <ErrorState retry={() => saved.refetch()} /> : !options.length ? <Empty title="Save a few options to compare" body="Your shortlist makes it easier to weigh awards, deadlines, and requirements together." icon={ListChecks} action={<Link className="btn btn-primary" href="/scholarships">Explore scholarships</Link>} /> : <><div className="card card-pad" style={{ marginBottom: 16 }}><div className="eyebrow">Your shortlist</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>{options.map(o => <button key={o.id} onClick={() => toggle(o.id)} className={`btn ${selected.includes(o.id) ? 'btn-soft' : ''}`}><span style={{ width: 15, height: 15, borderRadius: 4, border: '1px solid #aabac8', display: 'grid', placeItems: 'center' }}>{selected.includes(o.id) && <Check size={12} />}</span>{o.name}</button>)}</div><p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>{selected.length}/3 selected</p></div>{visible.length ? <div className="card table-wrap"><table style={{ minWidth: 550 }}><thead><tr><th>Details</th>{visible.map(v => <th key={v.id}>{v.name}</th>)}</tr></thead><tbody>{[['Provider', ...visible.map(v => v.provider)], ['Award', ...visible.map(v => `₹${Number(v.amount).toLocaleString('en-IN')}`)], ['Match', ...visible.map(v => `${v.matchScore}% · ${v.matchLabel}`)], ['Eligible', ...visible.map(v => v.eligible ? 'Yes' : 'Not currently')], ['Deadline', ...visible.map(v => v.deadline ? new Date(v.deadline).toLocaleDateString('en-IN') : 'Not listed')], ['Minimum CGPA', ...visible.map(v => v.minimumCgpa ?? 'Not specified')], ['Max family income', ...visible.map(v => v.maximumIncome ? `₹${v.maximumIncome.toLocaleString('en-IN')}` : 'Not specified')], ['Documents', ...visible.map(v => v.requiredDocuments.join(', ') || 'Not listed')]].map(([label, ...vals]) => <tr key={String(label)}><td><strong>{label}</strong></td>{vals.map((value, i) => <td key={i}>{String(value)}</td>)}</tr>)}</tbody></table></div> : <Empty title="Select scholarships to compare" body="Select at least two from your saved shortlist. You can compare up to three at once." icon={ListChecks} />}</>}
  </PageFrame>;
}

function NestGuidePage() {
  const ask = useAskNestGuide(); const [question, setQuestion] = useState(''); const [language, setLanguage] = useState<'English' | 'Hindi' | 'Telugu'>('English');
  const [messages, setMessages] = useState<{ question: string; answer?: string; error?: string }[]>([]);
  const prompts = ['What documents should I prepare first?', 'How do I understand my eligibility?', 'How can I stay on top of deadlines?'];
  const send = (q = question) => {
    if (!q.trim() || ask.isPending) return;
    const idx = messages.length; setQuestion(''); setMessages(old => [...old, { question: q }]);
    ask.mutate({ data: { question: q, language } }, { onSuccess: res => setMessages(old => old.map((m, i) => i === idx ? { ...m, answer: res.answer } : m)), onError: () => setMessages(old => old.map((m, i) => i === idx ? { ...m, error: 'NestGuide could not answer just now. Please try again.' } : m)) });
  };
  return <PageFrame title="Meet NestGuide" subtitle="Ask practical questions about scholarships, applications, and what to do next.">
    <div className="split"><div className="card" style={{ minHeight: 450, display: 'flex', flexDirection: 'column' }}><div style={{ padding: '17px 20px', borderBottom: '1px solid #edf1f4', display: 'flex', alignItems: 'center', gap: 10 }}><span className="stat-icon"><Sparkles size={17} /></span><div><strong style={{ fontSize: 13 }}>NestGuide</strong><div className="muted" style={{ fontSize: 10 }}>Here to help you find your next step</div></div><select aria-label="Response language" className="select" style={{ width: 120, marginLeft: 'auto', padding: '7px 9px' }} value={language} onChange={e => setLanguage(e.target.value as typeof language)}><option>English</option><option>Hindi</option><option>Telugu</option></select></div><div style={{ flex: 1, padding: 20, display: 'grid', alignContent: 'start', gap: 15 }}>{messages.length ? messages.map((m, i) => <div key={i}><div style={{ background: '#edf4f9', padding: 13, borderRadius: '12px 12px 3px 12px', marginLeft: 'auto', maxWidth: '85%', fontSize: 13, color: '#31536f' }}>{m.question}</div><div style={{ padding: '12px 4px', maxWidth: '92%', color: '#556b7f', fontSize: 13, lineHeight: 1.7 }}>{m.answer || m.error || 'NestGuide is thinking…'}</div></div>) : <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 350 }}><span className="empty-icon"><MessageCircle size={22} /></span><h3 style={{ font: '700 16px Manrope' }}>A good question gets you moving.</h3><p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>Get grounded guidance for your scholarship journey. Confirm deadlines and requirements with official sources.</p></div>}</div><form onSubmit={e => { e.preventDefault(); send(); }} style={{ borderTop: '1px solid #edf1f4', padding: 15, display: 'flex', gap: 8 }}><input className="input" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about eligibility, documents, next steps…" /><button className="btn btn-primary" disabled={ask.isPending || !question.trim()} aria-label="Send question"><ArrowRight size={16} /></button></form></div>
      <aside><div className="card card-pad"><div className="eyebrow">Try asking</div>{prompts.map(p => <button key={p} onClick={() => send(p)} className="btn" style={{ width: '100%', justifyContent: 'space-between', marginTop: 9, textAlign: 'left', whiteSpace: 'normal' }}>{p}<ArrowRight size={14} /></button>)}</div><div className="card card-pad" style={{ marginTop: 14, background: '#f3f7fa' }}><ShieldCheck size={18} color="#36749e" /><p style={{ fontSize: 12, lineHeight: 1.6, color: '#64778a', marginBottom: 0 }}>NestGuide offers helpful context, not an official decision. Always confirm eligibility and dates with the scholarship provider.</p></div></aside></div>
  </PageFrame>;
}

function AdminPage() {
  const user = useGetCurrentUser();
  const { data, isLoading, isError, refetch } = useListScholarships({});
  if (user.isLoading) return <PageFrame title="Scholarship administration"><Loading /></PageFrame>;
  if (user.data?.role !== 'admin') return <PageFrame title="Admin access only" subtitle="Scholarship administration is available only to accounts with the admin role."><Empty title="This area is restricted" body="Sign in with an administrator account to manage scholarship records." icon={ShieldCheck} action={<Link className="btn" href="/app">Return to your workspace</Link>} /></PageFrame>;
  if (isLoading) return <PageFrame title="Scholarship administration"><Loading /></PageFrame>;
  if (isError) return <PageFrame title="Scholarship administration"><ErrorState retry={() => refetch()} /></PageFrame>;
  const list = data || [];
  return <PageFrame title="Scholarship administration" subtitle="Manage scholarship records. This workspace is available to admin accounts only." action={<AdminCreate />}>
    <div className="card table-wrap"><table><thead><tr><th>Scholarship</th><th>Provider</th><th>Award</th><th>Deadline</th><th>Listing</th><th>Record</th></tr></thead><tbody>{list.map(item => <AdminRow key={item.id} item={item} />)}</tbody></table>{!list.length && <Empty title="No scholarship records yet" body="Add the first record to start curating verified opportunities." icon={Landmark} action={<AdminCreate />} />}</div>
  </PageFrame>;
}
function AdminCreate() {
  const create = useCreateScholarship(); const qc = useQueryClient(); const [open, setOpen] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ data: { name: String(f.get('name')), provider: String(f.get('provider')), description: String(f.get('description')), amount: Number(f.get('amount') || 0), courseEligibility: String(f.get('courses') || '').split(',').map(x => x.trim()).filter(Boolean), minimumCgpa: null, maximumIncome: null, eligibleStates: [], eligibleCategories: [], genderRequirement: null, ageMinimum: null, ageMaximum: null, requiredDocuments: String(f.get('documents') || '').split(',').map(x => x.trim()).filter(Boolean), deadline: String(f.get('deadline') || '') || null, officialUrl: String(f.get('url') || '') || null, applicationMethod: 'Online', verified: false, demoData: false } }, { onSuccess: () => { qc.invalidateQueries(); setOpen(false); } }); };
  return <><button className="btn btn-primary" onClick={() => setOpen(!open)}>{open ? <X size={15} /> : <Check size={15} />} {open ? 'Close' : 'Add scholarship'}</button>{open && <div style={{ position: 'fixed', inset: 0, background: '#14283c80', display: 'grid', placeItems: 'center', padding: 16, zIndex: 60 }}><form onSubmit={submit} className="card card-pad" style={{ width: 'min(100%,540px)', maxHeight: '90vh', overflowY: 'auto' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 className="display" style={{ margin: 0 }}>New scholarship</h2><button type="button" className="btn" onClick={() => setOpen(false)}><X size={15} /></button></div>{[['name','Scholarship name'],['provider','Provider'],['amount','Award amount'],['deadline','Deadline (ISO date)'],['courses','Eligible courses (comma separated)'],['documents','Required documents (comma separated)'],['url','Official URL']].map(([name,label]) => <div className="field" key={name}><label className="label">{label}</label><input className="input" name={name} required={['name','provider','amount'].includes(name)} type={name === 'amount' ? 'number' : 'text'} /></div>)}<div className="field"><label className="label">Description</label><textarea className="textarea" name="description" required /></div><button disabled={create.isPending} className="btn btn-primary">{create.isPending ? 'Adding…' : 'Create record'}</button></form></div>}</>;
}
function AdminRow({ item }: { item: ScholarshipMatch }) {
  const update = useUpdateScholarship(); const del = useDeleteScholarship(); const qc = useQueryClient();
  const toggleVerified = () => update.mutate({ id: item.id, data: {
    name: item.name, provider: item.provider, description: item.description, amount: item.amount,
    courseEligibility: item.courseEligibility, minimumCgpa: item.minimumCgpa, maximumIncome: item.maximumIncome,
    eligibleStates: item.eligibleStates, eligibleCategories: item.eligibleCategories, genderRequirement: item.genderRequirement,
    ageMinimum: item.ageMinimum, ageMaximum: item.ageMaximum, requiredDocuments: item.requiredDocuments,
    deadline: item.deadline, officialUrl: item.officialUrl, applicationMethod: item.applicationMethod,
    verified: !item.verified, demoData: item.demoData,
  } }, { onSuccess: () => qc.invalidateQueries() });
  return <tr><td><strong>{item.name}</strong></td><td>{item.provider}</td><td>₹{item.amount.toLocaleString('en-IN')}</td><td>{item.deadline ? new Date(item.deadline).toLocaleDateString('en-IN') : '—'}</td><td><span className={`chip ${item.verified ? 'green' : 'gold'}`}>{item.verified ? 'Verified' : 'Review needed'}</span></td><td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={toggleVerified}>{item.verified ? 'Unverify' : 'Verify'}</button> <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete ${item.name}?`)) del.mutate({ id: item.id }, { onSuccess: () => qc.invalidateQueries() }); }}>Delete</button></td></tr>;
}

function AppRouter() {
  const [path] = useLocation();
  if (path === '/') return <Landing />;
  return <Workspace><Switch>
    <Route path="/app" component={DashboardPage} />
    <Route path="/profile" component={ProfilePage} />
    <Route path="/scholarships">{() => <ExplorePage />}</Route>
    <Route path="/scholarships/:id" component={ScholarshipDetail} />
    <Route path="/recommended">{() => <ExplorePage recommended />}</Route>
    <Route path="/saved">{() => <ExplorePage savedOnly />}</Route>
    <Route path="/applications" component={ApplicationsPage} />
    <Route path="/documents" component={DocumentsPage} />
    <Route path="/deadlines" component={DeadlinesPage} />
    <Route path="/compare" component={ComparePage} />
    <Route path="/nestguide" component={NestGuidePage} />
    <Route path="/admin/scholarships" component={AdminPage} />
    <Route component={NotFound} />
  </Switch></Workspace>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRouter /></WouterRouter></QueryClientProvider>;
}

export default App;
