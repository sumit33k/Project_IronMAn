'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { FileText, Upload, Loader2, Plus, ChevronDown, ChevronUp, AlertTriangle, FileUp } from 'lucide-react';
import { api, AgentRun } from '@/lib/api';
import { clsx } from 'clsx';

interface DocOutput {
  summary?: string;
  key_points?: string[];
  extracted_tasks?: { title: string; priority?: string; description?: string }[];
}

interface HistoryEntry {
  run: AgentRun;
  expanded: boolean;
}

export default function DocumentsPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [pdfPasteMode, setPdfPasteMode] = useState(false);
  const [pdfPastedText, setPdfPastedText] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [output, setOutput] = useState<DocOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState<Record<number, boolean>>({});
  const [addedTask, setAddedTask] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    try {
      const runs = await api.getAgentRuns();
      const docRuns = runs
        .filter(r => r.agent_id === 'document_agent')
        .slice(0, 5)
        .map(run => ({ run, expanded: false }));
      setHistory(docRuns);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { void loadHistory(); }, []);

  const readFile = (f: File) => {
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setPdfPasteMode(true);
      setFileContent('');
      return;
    }
    setPdfPasteMode(false);
    const reader = new FileReader();
    reader.onload = e => {
      setFileContent((e.target?.result as string) ?? '');
    };
    reader.readAsText(f);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      setOutput(null);
      setError(null);
      readFile(dropped);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setOutput(null);
      setError(null);
      readFile(selected);
    }
  };

  const handleSummarize = async () => {
    if (!file) return;
    const content = pdfPasteMode ? pdfPastedText : fileContent;
    if (!content.trim()) {
      setError('No content to summarize. Please provide text.');
      return;
    }
    setSummarizing(true);
    setError(null);
    setOutput(null);
    try {
      const run = await api.runAgent('document_agent', {
        filename: file.name,
        content: content.slice(0, 50000),
        context: '',
      });
      const out = (run.output_data ?? {}) as DocOutput;
      setOutput(out);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to summarize document');
    } finally {
      setSummarizing(false);
    }
  };

  const handleAddTask = async (task: { title: string; priority?: string; description?: string }, idx: number) => {
    setAddingTask(a => ({ ...a, [idx]: true }));
    try {
      await api.createTask({
        title: task.title,
        description: task.description,
        priority: task.priority ?? 'medium',
        status: 'inbox',
      });
      setAddedTask(a => ({ ...a, [idx]: true }));
    } catch {
      // ignore
    } finally {
      setAddingTask(a => { const n = { ...a }; delete n[idx]; return n; });
    }
  };

  const toggleHistory = (i: number) => {
    setHistory(h => h.map((e, idx) => idx === i ? { ...e, expanded: !e.expanded } : e));
  };

  const contentPreview = pdfPasteMode ? pdfPastedText : fileContent;

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-xs text-slate-500">Upload documents and extract summaries &amp; tasks with Jarvis</p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-5',
          dragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : file
              ? 'border-[#1e2847] bg-[#131720] hover:border-indigo-600/40'
              : 'border-[#1e2847] bg-[#0d0f14] hover:border-indigo-600/40 hover:bg-[#131720]'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.doc,.docx,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="w-8 h-8 text-indigo-400" />
            <p className="text-sm font-medium text-white">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · Click to change file</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-slate-400">Drag &amp; drop a file, or click to select</p>
            <p className="text-xs text-slate-600">Supports .txt, .md, .pdf, .csv</p>
          </div>
        )}
      </div>

      {/* PDF paste mode */}
      {pdfPasteMode && (
        <div className="bg-[#131720] border border-amber-800/40 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300 font-medium">PDF detected — paste text manually</p>
          </div>
          <p className="text-xs text-slate-500 mb-3">Open your PDF, select all text (Ctrl+A / Cmd+A), and paste it below.</p>
          <textarea
            value={pdfPastedText}
            onChange={e => setPdfPastedText(e.target.value)}
            placeholder="Paste PDF text here…"
            rows={8}
            className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full resize-none placeholder-slate-600"
          />
        </div>
      )}

      {/* Preview */}
      {!pdfPasteMode && contentPreview && (
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-slate-400 mb-2">Preview (first 500 chars)</p>
          <p className="text-xs text-slate-500 font-mono whitespace-pre-wrap break-words">
            {contentPreview.slice(0, 500)}{contentPreview.length > 500 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Summarize button */}
      {file && (
        <button
          onClick={() => void handleSummarize()}
          disabled={summarizing || (pdfPasteMode ? !pdfPastedText.trim() : !fileContent.trim())}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-medium mb-5"
        >
          {summarizing ? <><Loader2 className="w-4 h-4 animate-spin" /> Summarizing…</> : <><FileText className="w-4 h-4" /> Summarize with Jarvis</>}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-800/40 rounded-lg px-4 py-3 mb-5">{error}</p>
      )}

      {/* Results */}
      {output && (
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 mb-6 space-y-5">
          <p className="text-sm font-semibold text-white">Summary Results</p>

          {output.summary && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{output.summary}</p>
            </div>
          )}

          {output.key_points && output.key_points.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Key Points</p>
              <ul className="space-y-1.5">
                {output.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {output.extracted_tasks && output.extracted_tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">Extracted Tasks</p>
              <div className="space-y-2">
                {output.extracted_tasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-[#1a2035] border border-[#1e2847] rounded-xl px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                      )}
                    </div>
                    {task.priority && (
                      <span className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium flex-shrink-0',
                        task.priority === 'high' ? 'bg-orange-500/15 text-orange-400 border-orange-800/40' :
                        task.priority === 'critical' ? 'bg-red-500/15 text-red-400 border-red-800/40' :
                        task.priority === 'low' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40' :
                        'bg-yellow-500/15 text-yellow-400 border-yellow-800/40'
                      )}>
                        {task.priority}
                      </span>
                    )}
                    <button
                      onClick={() => void handleAddTask(task, i)}
                      disabled={addingTask[i] || addedTask[i]}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-600/40 text-indigo-400 text-xs hover:bg-indigo-600/40 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {addingTask[i] ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : addedTask[i] ? (
                        '✓ Added'
                      ) : (
                        <><Plus className="w-3 h-3" /> Add to inbox</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-[#131720] border border-[#1e2847] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2847]">
          <p className="text-sm font-semibold text-white">Previous Summaries</p>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-slate-600 text-sm">No document history yet.</div>
        ) : (
          <div className="divide-y divide-[#1e2847]">
            {history.map((entry, i) => {
              const inp = entry.run.input_data ?? {};
              const out = (entry.run.output_data ?? {}) as DocOutput;
              return (
                <div key={entry.run.id}>
                  <button
                    onClick={() => toggleHistory(i)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{String(inp.filename || 'Document')}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(entry.run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    {entry.expanded ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                  </button>
                  {entry.expanded && out.summary && (
                    <div className="px-5 pb-4">
                      <p className="text-xs text-slate-400 leading-relaxed">{out.summary}</p>
                      {out.key_points && out.key_points.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {out.key_points.map((pt, j) => (
                            <li key={j} className="text-[10px] text-slate-500 flex items-start gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />{pt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
