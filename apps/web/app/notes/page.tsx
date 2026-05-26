'use client';

import { useEffect, useState, useCallback } from 'react';
import { StickyNote, Search, Pin, Trash2, Loader2, Plus, Tag } from 'lucide-react';
import { api, Note } from '@/lib/api';
import { clsx } from 'clsx';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [pinning, setPinning] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // New note form
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState<Record<string, string>>({});

  const load = useCallback(async (q?: string) => {
    try {
      const data = await api.getNotes(q);
      setNotes(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    setSearching(true);
    const timer = setTimeout(() => void load(q || undefined), 400);
    return () => clearTimeout(timer);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
      const note = await api.createNote({ title: newTitle.trim(), body: newBody.trim(), tags });
      setNotes(ns => [note, ...ns]);
      setNewTitle('');
      setNewBody('');
      setNewTags('');
      setShowForm(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handlePin = async (note: Note) => {
    setPinning(p => ({ ...p, [note.id]: true }));
    try {
      const updated = await api.updateNote(note.id, { pinned: !note.pinned });
      setNotes(ns => ns.map(n => n.id === note.id ? updated : n));
    } catch {
      // ignore
    } finally {
      setPinning(p => { const n = { ...p }; delete n[note.id]; return n; });
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(d => ({ ...d, [id]: true }));
    try {
      await api.deleteNote(id);
      setNotes(ns => ns.filter(n => n.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      setDeleting(d => { const n = { ...d }; delete n[id]; return n; });
    }
  };

  const handleSave = async (note: Note) => {
    const title = editTitle[note.id] ?? note.title;
    const body = editBody[note.id] ?? note.body;
    if (title === note.title && body === note.body) return;
    setSaving(s => ({ ...s, [note.id]: true }));
    try {
      const updated = await api.updateNote(note.id, { title, body });
      setNotes(ns => ns.map(n => n.id === note.id ? updated : n));
    } catch {
      // ignore
    } finally {
      setSaving(s => { const n = { ...s }; delete n[note.id]; return n; });
    }
  };

  const toggleExpand = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    if (expandedId === id) {
      void handleSave(note);
      setExpandedId(null);
    } else {
      setEditTitle(t => ({ ...t, [id]: note.title }));
      setEditBody(b => ({ ...b, [id]: note.body }));
      setExpandedId(id);
    }
  };

  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading notes…
    </div>
  );

  const NoteCard = ({ note }: { note: Note }) => {
    const isExpanded = expandedId === note.id;
    return (
      <div
        className={clsx(
          'bg-[#131720] border rounded-2xl p-4 transition-all group',
          isExpanded ? 'border-indigo-600/40' : 'border-[#1e2847] hover:border-indigo-800/40 cursor-pointer'
        )}
        onClick={!isExpanded ? () => toggleExpand(note.id) : undefined}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          {isExpanded ? (
            <input
              value={editTitle[note.id] ?? note.title}
              onChange={e => setEditTitle(t => ({ ...t, [note.id]: e.target.value }))}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-transparent text-sm font-semibold text-white focus:outline-none border-b border-transparent focus:border-indigo-500 pb-0.5"
            />
          ) : (
            <p className="text-sm font-semibold text-white truncate flex-1">{note.title}</p>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            {note.pinned && !isExpanded && (
              <Pin className="w-3 h-3 text-indigo-400" />
            )}
            <button
              onClick={e => { e.stopPropagation(); void handlePin(note); }}
              disabled={pinning[note.id]}
              className={clsx(
                'p-1 rounded-lg transition-all',
                note.pinned ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-700 hover:text-indigo-400',
                'opacity-0 group-hover:opacity-100'
              )}
              title={note.pinned ? 'Unpin' : 'Pin'}
            >
              {pinning[note.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pin className="w-3 h-3" />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); void handleDelete(note.id); }}
              disabled={deleting[note.id]}
              className="p-1 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
            >
              {deleting[note.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {isExpanded ? (
          <textarea
            value={editBody[note.id] ?? note.body}
            onChange={e => setEditBody(b => ({ ...b, [note.id]: e.target.value }))}
            onClick={e => e.stopPropagation()}
            rows={6}
            className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 resize-none mb-3"
          />
        ) : (
          note.body && (
            <p className="text-xs text-slate-500 line-clamp-3 mb-2 leading-relaxed">
              {note.body.slice(0, 150)}{note.body.length > 150 ? '…' : ''}
            </p>
          )
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {note.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[#1a2035] border border-[#1e2847] rounded text-slate-500">
                <Tag className="w-2.5 h-2.5" />{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {saving[note.id] && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
            {isExpanded && (
              <button
                onClick={e => { e.stopPropagation(); toggleExpand(note.id); }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Save & close
              </button>
            )}
            <p className="text-[10px] text-slate-700">
              {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <StickyNote className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="text-xs text-slate-500">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* New note form */}
      {showForm && (
        <form
          onSubmit={e => void handleCreate(e)}
          className="bg-[#131720] border border-indigo-800/40 rounded-2xl p-5 mb-5 space-y-3"
        >
          <p className="text-sm font-semibold text-white">New Note</p>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Title…"
            required
            className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Body…"
            rows={4}
            className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600 resize-none"
          />
          <input
            value={newTags}
            onChange={e => setNewTags(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {creating ? 'Saving…' : 'Add Note'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-[#1a2035] border border-[#1e2847] text-slate-400 text-sm rounded-lg hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search notes…"
          className="bg-[#131720] border border-[#1e2847] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-500"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-500" />}
      </div>

      {/* Empty state */}
      {notes.length === 0 && (
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-12 text-center">
          <StickyNote className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{search ? 'No notes match your search.' : 'No notes yet.'}</p>
          {!search && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
            >
              Create your first note
            </button>
          )}
        </div>
      )}

      {/* Pinned notes */}
      {pinned.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> Pinned
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinned.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        </div>
      )}

      {/* All notes */}
      {unpinned.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">All Notes</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unpinned.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        </div>
      )}
    </div>
  );
}
