'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, closestCorners, useSensor, useSensors,
  PointerSensor, KeyboardSensor,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { api, Task } from '@/lib/api';
import { clsx } from 'clsx';

const LANES = [
  { key: 'inbox',       label: 'Inbox',       accent: 'border-slate-500',   text: 'text-slate-400'   },
  { key: 'today',       label: 'Today',       accent: 'border-indigo-500',  text: 'text-indigo-400'  },
  { key: 'in_progress', label: 'In Progress', accent: 'border-blue-500',    text: 'text-blue-400'    },
  { key: 'waiting',     label: 'Waiting',     accent: 'border-amber-500',   text: 'text-amber-400'   },
  { key: 'deferred',    label: 'Deferred',    accent: 'border-slate-600',   text: 'text-slate-500'   },
  { key: 'done',        label: 'Done',        accent: 'border-emerald-500', text: 'text-emerald-400' },
];

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-emerald-400',
};

type GroupedTasks = Record<string, Task[]>;

function groupByStatus(tasks: Task[]): GroupedTasks {
  const result: GroupedTasks = {};
  for (const lane of LANES) result[lane.key] = [];
  for (const t of tasks) {
    const key = t.status in result ? t.status : 'inbox';
    result[key].push(t);
  }
  return result;
}

function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (overlay) {
    return (
      <div className="bg-[#1a2035] rounded-lg p-2.5 border border-indigo-600/60 shadow-2xl rotate-1 cursor-grabbing">
        <div className="flex items-start gap-2 mb-1">
          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`} />
          <p className="text-xs text-white leading-tight line-clamp-2">{task.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a2035] rounded-lg p-2.5 border border-[#1e2847] hover:border-indigo-800/60 cursor-grab active:cursor-grabbing transition-all group"
        onClick={() => router.push(`/tasks/${task.id}`)}
      >
        <div className="flex items-start gap-2 mb-1.5">
          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`} />
          <p className="text-xs text-white leading-tight line-clamp-2">{task.title}</p>
        </div>
        {task.category && task.category !== 'general' && (
          <p className="text-[9px] text-slate-600 pl-3.5 capitalize">{task.category}</p>
        )}
        {task.due_date && (
          <p className="text-[9px] text-slate-600 pl-3.5 mt-0.5">📅 {task.due_date}</p>
        )}
      </motion.div>
    </div>
  );
}

function DroppableLane({
  lane, tasks,
}: {
  lane: typeof LANES[number];
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.key });
  const ids = tasks.map(t => t.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        'flex-shrink-0 w-60 flex flex-col rounded-xl border-t-2 bg-[#131720] border border-[#1e2847] transition-all',
        lane.accent,
        isOver && 'bg-[#171e30] border-indigo-800/40',
      )}
      style={{ borderTopWidth: '2px' }}
    >
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#1e2847]">
        <span className={clsx('text-xs font-semibold', lane.text)}>{lane.label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2035] text-slate-400 tabular-nums">{tasks.length}</span>
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[60px]">
          <AnimatePresence>
            {tasks.map(task => <TaskCard key={task.id} task={task} />)}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className={clsx('py-6 text-center rounded-lg border-2 border-dashed transition-all', isOver ? 'border-indigo-700/50' : 'border-transparent')}>
              <p className="text-[10px] text-slate-700">Drop here</p>
            </div>
          )}
        </div>
      </SortableContext>

      {lane.key === 'inbox' && (
        <button className="p-2 flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors border-t border-[#1e2847]">
          <Plus className="w-3 h-3" /> Add task
        </button>
      )}
    </motion.div>
  );
}

type FilterMode = 'All' | 'Personal' | 'Work';

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('All');
  const [heatmap, setHeatmap] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const data = await api.getTasks().catch(() => []);
    setTasks(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = tasks.filter(t => {
    if (filterMode === 'Personal') return t.personal_or_work === 'personal';
    if (filterMode === 'Work') return t.personal_or_work === 'work';
    return true;
  });

  const grouped = groupByStatus(filtered);

  const findTaskById = (id: UniqueIdentifier) => tasks.find(t => t.id === String(id)) ?? null;
  const findLaneForTask = (id: UniqueIdentifier) => {
    for (const [lane, ts] of Object.entries(grouped)) {
      if (ts.some(t => t.id === String(id))) return lane;
    }
    return null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask(findTaskById(e.active.id));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const task = findTaskById(active.id);
    if (!task) return;

    const fromLane = findLaneForTask(active.id);
    const toLaneId = String(over.id);
    const toLane = LANES.find(l => l.key === toLaneId);

    if (!toLane || fromLane === toLaneId) return;

    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: toLaneId } : t));
    await api.updateTask(task.id, { status: toLaneId }).catch(() => load());
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading board…
    </div>
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">{tasks.length} tasks — drag to move between lanes</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(['All', 'Personal', 'Work'] as FilterMode[]).map(f => (
              <button
                key={f}
                onClick={() => setFilterMode(f)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs transition-all',
                  filterMode === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setHeatmap(h => !h)}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-xs transition-all border',
              heatmap ? 'border-red-700/50 text-red-400 bg-red-950/20' : 'border-[#1e2847] text-slate-500 hover:text-slate-300',
            )}
          >
            🌡 Heatmap
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto flex-1 pb-4 min-h-0">
          {LANES.map(lane => (
            <DroppableLane key={lane.key} lane={lane} tasks={grouped[lane.key] ?? []} />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} overlay />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
