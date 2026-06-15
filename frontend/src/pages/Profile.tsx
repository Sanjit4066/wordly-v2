import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getHeatmap, updateUserProfile, getStreak } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Edit2, Check, X, Github, Linkedin, Instagram,
  Flame, Trophy, Calendar, Loader2, User as UserIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [streakData, setStreakData] = useState({ streak: 0, maxStreak: 0 });
  const [loading, setLoading] = useState(true);

  // Edit form states
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [dob, setDob] = useState(profile?.dob || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [githubId, setGithubId] = useState(profile?.githubId || '');
  const [linkedinId, setLinkedinId] = useState(profile?.linkedinId || '');
  const [instagramId, setInstagramId] = useState(profile?.instagramId || '');
  const [saving, setSaving] = useState(false);

  // Synchronize initial form values when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
      setDob(profile.dob || '');
      setBio(profile.bio || '');
      setGithubId(profile.githubId || '');
      setLinkedinId(profile.linkedinId || '');
      setInstagramId(profile.instagramId || '');
      setStreakData({
        streak: profile.streak || 0,
        maxStreak: profile.maxStreak || 0,
      });
    }
  }, [profile]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadProfileDetails();
  }, [selectedYear]);

  const loadProfileDetails = async () => {
    setLoading(true);
    try {
      const [heatmapRes, streakRes] = await Promise.all([
        getHeatmap(selectedYear),
        getStreak(),
      ]);
      setHeatmapData(heatmapRes.heatmap || {});
      setStreakData({
        streak: streakRes.streak || 0,
        maxStreak: profile?.maxStreak || 0,
      });
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setPhotoURL(dataUrl);
            toast.success('Photo updated locally! Save to apply.');
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Enforce 50-word limit check
  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordCount = getWordCount(bio);
    if (wordCount > 50) {
      toast.error(`Bio is too long! Current count: ${wordCount}/50 words.`);
      return;
    }

    setSaving(true);
    try {
      // If new streak is higher than current maxStreak, update it
      const newMaxStreak = Math.max(streakData.streak, profile?.maxStreak || 0);

      await updateUserProfile({
        displayName: name.trim(),
        photoURL: photoURL.trim(),
        dob,
        bio: bio.trim(),
        githubId: githubId.trim(),
        linkedinId: linkedinId.trim(),
        instagramId: instagramId.trim(),
        maxStreak: newMaxStreak,
      });

      await refreshProfile();
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Generate days grouped by 12 months for the selectedYear
  const getDatesByMonth = (year: number) => {
    const monthsData: Date[][] = Array.from({ length: 12 }, () => []);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const current = new Date(startDate);
    while (current <= endDate) {
      const month = current.getMonth();
      monthsData[month].push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return monthsData;
  };

  const datesByMonth = getDatesByMonth(selectedYear);
  const bioWordsLeft = 50 - getWordCount(bio);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
        <p className="text-xs font-bold text-brand-muted uppercase tracking-[0.2em]">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32">
      <header className="flex items-center justify-between sticky top-24 glass py-4 px-8 z-30 rounded-full border border-brand-border">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-muted hover:text-brand-primary transition-colors cursor-pointer group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Your Profile & Stats
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Profile Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card bg-white/80 dark:bg-brand-surface/80 backdrop-blur-xl border border-brand-accent/20 dark:border-brand-accent/30 rounded-[2.5rem] p-8 space-y-6 shadow-[0_24px_60px_rgba(0,0,0,0.06)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.3)] ring-4 ring-brand-accent/5">
            <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-36 h-36 rounded-full border-4 border-white dark:border-brand-surface ring-4 ring-brand-accent/30 flex items-center justify-center text-brand-accent overflow-hidden relative shadow-xl">
                {profile?.photoURL || user?.photoURL ? (
                  <img src={profile?.photoURL || user?.photoURL || undefined} alt={profile?.displayName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-14 h-14" />
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-serif font-black italic text-brand-primary tracking-tight leading-tight">{profile?.displayName}</h2>
                <span className="text-[9px] font-black text-brand-accent bg-brand-accent/10 border border-brand-accent/20 px-3 py-1 rounded-full uppercase tracking-widest">
                  {profile?.level} Level
                </span>
                {profile?.dob && (
                  <p className="text-[10px] text-brand-muted font-mono uppercase tracking-wider block pt-1">
                    🍰 DOB: {new Date(profile.dob).toLocaleDateString()}
                  </p>
                )}
              </div>
              <p className="text-sm font-serif italic text-brand-muted leading-relaxed px-2">
                "{profile?.bio || 'No bio written yet. Click edit to introduce yourself!'}"
              </p>
            </div>

            {/* Social Badge Links */}
            <div className="border-t border-brand-border/60 pt-6 space-y-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-brand-muted/70 text-center font-sans">Connected Networks</p>
              <div className="flex justify-center gap-3.5">
                {profile?.githubId ? (
                  <a
                    href={`https://github.com/${profile.githubId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full flex items-center justify-center border border-brand-border/60 text-brand-muted hover:bg-[#24292e] hover:text-white hover:border-[#24292e] transition-all shadow-sm"
                    title={`GitHub: @${profile.githubId}`}
                  >
                    <Github className="w-5 h-5" />
                  </a>
                ) : (
                  <span className="w-11 h-11 rounded-full flex items-center justify-center border border-brand-border/30 bg-brand-bg/50 text-brand-muted/20 cursor-not-allowed" title="No GitHub Connected">
                    <Github className="w-5 h-5" />
                  </span>
                )}

                {profile?.linkedinId ? (
                  <a
                    href={profile.linkedinId.startsWith('http') ? profile.linkedinId : `https://linkedin.com/in/${profile.linkedinId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full flex items-center justify-center border border-brand-border/60 text-brand-muted hover:bg-[#0077b5] hover:text-white hover:border-[#0077b5] transition-all shadow-sm"
                    title="LinkedIn Profile"
                  >
                    <Linkedin className="w-5 h-5" />
                  </a>
                ) : (
                  <span className="w-11 h-11 rounded-full flex items-center justify-center border border-brand-border/30 bg-brand-bg/50 text-brand-muted/20 cursor-not-allowed" title="No LinkedIn Connected">
                    <Linkedin className="w-5 h-5" />
                  </span>
                )}

                {profile?.instagramId ? (
                  <a
                    href={`https://instagram.com/${profile.instagramId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full flex items-center justify-center border border-brand-border/60 text-brand-muted hover:bg-gradient-to-tr hover:from-[#f9ce34] hover:via-[#ee2a7b] hover:to-[#6228d7] hover:text-white hover:border-transparent transition-all shadow-sm"
                    title={`Instagram: @${profile.instagramId}`}
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                ) : (
                  <span className="w-11 h-11 rounded-full flex items-center justify-center border border-brand-border/30 bg-brand-bg/50 text-brand-muted/20 cursor-not-allowed" title="No Instagram Connected">
                    <Instagram className="w-5 h-5" />
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 border border-brand-border/80 hover:border-brand-accent hover:text-brand-accent bg-brand-bg hover:bg-brand-accent/5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer group"
            >
              {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4 transition-transform group-hover:rotate-12" />}
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Right Side: Form / Streak Calendar grid */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSave}
                className="card bg-white/80 dark:bg-brand-surface/80 backdrop-blur-xl border border-brand-border rounded-[2.5rem] p-8 md:p-12 space-y-6 shadow-xl"
              >
                <h3 className="text-3xl font-serif font-black italic border-b border-brand-border/60 pb-4">Edit Profile Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="technical-label">Display Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your display name"
                      className="w-full px-4 py-3.5 bg-brand-bg/60 dark:bg-brand-surface border border-brand-border rounded-xl font-bold text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="technical-label">Date of Birth</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-4 py-3.5 bg-brand-bg/60 dark:bg-brand-surface border border-brand-border rounded-xl font-bold text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 border-b border-brand-border/40 pb-6">
                  <div className="relative group w-28 h-28 rounded-full border-4 border-brand-accent/25 overflow-hidden shadow-md bg-brand-bg flex items-center justify-center text-brand-accent">
                    {photoURL || user?.photoURL ? (
                      <img src={photoURL || user?.photoURL || undefined} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-10 h-10" />
                    )}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider gap-1 cursor-pointer">
                      <Edit2 className="w-4 h-4" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Profile Photo</p>
                    <p className="text-[10px] text-brand-muted mt-1">Select an image from your device (max 2MB)</p>
                    {photoURL && (
                      <button
                        type="button"
                        onClick={() => setPhotoURL('')}
                        className="text-[9px] font-bold text-red-500 hover:underline mt-2 cursor-pointer"
                      >
                        Reset to Gmail photo
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="technical-label">Short Bio (max 50 words)</label>
                    <span className={`text-[10px] font-bold ${bioWordsLeft < 0 ? 'text-red-500 font-black' : 'text-brand-muted'}`}>
                      {bioWordsLeft} words remaining
                    </span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A brief bio introducing yourself..."
                    rows={3}
                    className="w-full px-5 py-4 bg-brand-bg/60 dark:bg-brand-surface border border-brand-border rounded-2xl font-serif italic text-base focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all resize-none"
                  />
                </div>

                <div className="border-t border-brand-border/60 pt-6 space-y-4">
                  <h4 className="technical-label">Connect Links (Usernames / Handles)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="technical-label flex items-center gap-1.5"><Github className="w-3.5 h-3.5 text-brand-muted" /> GitHub ID</label>
                      <input
                        type="text"
                        value={githubId}
                        onChange={(e) => setGithubId(e.target.value)}
                        placeholder="github-username"
                        className="w-full px-4 py-3 bg-brand-bg/60 dark:bg-brand-surface border border-brand-border rounded-xl font-bold text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="technical-label flex items-center gap-1.5"><Linkedin className="w-3.5 h-3.5 text-brand-muted" /> LinkedIn ID</label>
                      <input
                        type="text"
                        value={linkedinId}
                        onChange={(e) => setLinkedinId(e.target.value)}
                        placeholder="linkedin-username"
                        className="w-full px-4 py-3 bg-brand-bg/60 dark:bg-brand-surface border border-brand-border rounded-xl font-bold text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="technical-label flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5 text-brand-muted" /> Instagram ID</label>
                      <input
                        type="text"
                        value={instagramId}
                        onChange={(e) => setInstagramId(e.target.value)}
                        placeholder="insta-username"
                        className="w-full px-4 py-3 bg-brand-bg/60 dark:bg-brand-surface border border-brand-border rounded-xl font-bold text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-brand-border/60">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || bioWordsLeft < 0}
                    className="px-8 py-3.5 bg-brand-primary hover:bg-brand-accent text-white rounded-2xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="stats-dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Streak Stats Cards */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="card p-6 flex items-center gap-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 dark:from-orange-500/20 dark:to-orange-500/5 border border-orange-500/20 rounded-[2rem] shadow-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                      <Flame className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-4xl font-serif font-black italic text-brand-primary leading-tight">{streakData.streak} days</p>
                      <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mt-1">Current Streak</p>
                    </div>
                  </div>

                  <div className="card p-6 flex items-center gap-4 bg-gradient-to-br from-brand-accent/15 to-brand-accent/5 dark:from-brand-accent/20 dark:to-brand-accent/5 border border-brand-accent/20 rounded-[2rem] shadow-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-brand-accent to-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-accent/25">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-4xl font-serif font-black italic text-brand-primary leading-tight">{streakData.maxStreak} days</p>
                      <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mt-1">Max Streak</p>
                    </div>
                  </div>
                </div>

                {/* LeetCode style Activity Heatmap Calendar */}
                <div className="card bg-white/80 dark:bg-brand-surface/80 backdrop-blur-xl border border-brand-accent/20 dark:border-brand-accent/30 rounded-[2.5rem] p-8 space-y-6 shadow-xl font-sans">
                  <div className="flex items-center justify-between border-b border-brand-border/60 pb-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-brand-accent animate-pulse" />
                      <h4 className="technical-label text-brand-primary">Activity Calendar</h4>
                    </div>
                    
                    {/* Years selector list */}
                    <div className="flex gap-2">
                      {[2026, 2025, 2024, 2023].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedYear(yr)}
                          className={`px-4 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                            selectedYear === yr
                              ? 'bg-brand-accent text-white shadow-md'
                              : 'bg-brand-bg dark:bg-brand-surface border border-brand-border text-brand-muted hover:text-brand-primary'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-4">
                    <div className="overflow-x-auto pb-2">
                      <div className="min-w-[850px] py-4 pr-4 pl-2">
                        {/* Calendar Grid representation */}
                        <div className="flex gap-4 items-end">
                          {/* Day-of-week labels side column */}
                          <div className="grid grid-rows-7 gap-1 text-[8px] font-bold text-brand-muted uppercase tracking-wider pb-0.5 select-none text-right justify-between w-6 h-[98px] font-sans">
                            <span>Sun</span>
                            <span></span>
                            <span>Tue</span>
                            <span></span>
                            <span>Thu</span>
                            <span></span>
                            <span>Sat</span>
                          </div>

                          {/* 12 Month blocks container */}
                          <div className="flex gap-2.5 items-end">
                            {datesByMonth.map((monthDates, monthIdx) => {
                              const monthName = new Date(selectedYear, monthIdx, 1).toLocaleDateString('en-US', { month: 'short' });
                              return (
                                <div key={monthIdx} className="flex flex-col space-y-2 border-r border-brand-border/20 pr-2 last:border-r-0 last:pr-0">
                                  {/* Month title */}
                                  <span className="text-[9px] font-bold text-brand-muted uppercase tracking-wider text-center select-none h-4 border-b border-brand-border/50 pb-1 font-mono">
                                    {monthName}
                                  </span>
                                  {/* Monthly grid */}
                                  <div className="grid grid-rows-7 grid-flow-col gap-1.5 h-[98px]">
                                    {monthDates.map((date, idx) => {
                                      const dateStr = date.toISOString().split('T')[0];
                                      const count = heatmapData[dateStr] || 0;
                                      const dayOfWeek = date.getDay();

                                      const colorClass =
                                        count === 0
                                          ? 'bg-slate-100/60 dark:bg-slate-800/20 border-slate-200/20 dark:border-slate-800/10'
                                          : count <= 2
                                          ? 'bg-brand-accent/20 border-brand-accent/30'
                                          : count <= 4
                                          ? 'bg-brand-accent/55 border-brand-accent/60 shadow-sm'
                                          : 'bg-brand-accent text-white border-brand-accent shadow-md shadow-brand-accent/25';

                                      return (
                                        <div
                                          key={idx}
                                          style={{ gridRowStart: dayOfWeek + 1 }}
                                          className={`w-3.5 h-3.5 rounded-sm border transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer ${colorClass}`}
                                          title={`${count} words seen on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Heatmap Legend */}
                    <div className="flex items-center justify-end gap-2 text-[10px] text-brand-muted font-bold uppercase tracking-wider pr-4 select-none font-sans">
                      <span>Less</span>
                      <div className="w-3 h-3 bg-slate-100/60 dark:bg-slate-800/20 border border-slate-200/20 dark:border-slate-800/10 rounded-sm" />
                      <div className="w-3 h-3 bg-brand-accent/20 border border-brand-accent/30 rounded-sm" />
                      <div className="w-3 h-3 bg-brand-accent/55 border border-brand-accent/60 rounded-sm" />
                      <div className="w-3 h-3 bg-brand-accent border border-brand-accent rounded-sm" />
                      <span>More</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Profile;
