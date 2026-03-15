import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
  addDays,
  differenceInDays,
  format,
  parseISO,
  isWeekend,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachDayOfInterval,
  isSameDay,
  getMonth,
  getYear,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { Leg } from '@leg-go/shared';

interface DayTripItem {
  id: string;
  destination_name: string;
  date: string;
  status: 'confirmed' | 'idea';
}

interface LegWithDetails extends Leg {
  accommodation?: { total_cost?: number | null; cost_per_night?: number | null; name?: string | null } | null;
  day_trips?: DayTripItem[];
}

interface RouteTimelineProps {
  legs: LegWithDetails[];
  tripStartDate: string;
  tripEndDate: string;
  onUpdateLeg: (legId: string, startDate: string, endDate: string) => Promise<void>;
  onUpdateDayTrip?: (dayTripId: string, date: string) => Promise<void>;
  onSelectLeg?: (legId: string) => void;
}

const COLORS = [
  { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600', subBg: 'bg-blue-200', subText: 'text-blue-800', subBorder: 'border-blue-400' },
  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600', subBg: 'bg-emerald-200', subText: 'text-emerald-800', subBorder: 'border-emerald-400' },
  { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600', subBg: 'bg-amber-200', subText: 'text-amber-800', subBorder: 'border-amber-400' },
  { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600', subBg: 'bg-purple-200', subText: 'text-purple-800', subBorder: 'border-purple-400' },
  { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600', subBg: 'bg-rose-200', subText: 'text-rose-800', subBorder: 'border-rose-400' },
  { bg: 'bg-cyan-500', text: 'text-white', border: 'border-cyan-600', subBg: 'bg-cyan-200', subText: 'text-cyan-800', subBorder: 'border-cyan-400' },
  { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600', subBg: 'bg-indigo-200', subText: 'text-indigo-800', subBorder: 'border-indigo-400' },
  { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600', subBg: 'bg-orange-200', subText: 'text-orange-800', subBorder: 'border-orange-400' },
  { bg: 'bg-teal-500', text: 'text-white', border: 'border-teal-600', subBg: 'bg-teal-200', subText: 'text-teal-800', subBorder: 'border-teal-400' },
  { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600', subBg: 'bg-pink-200', subText: 'text-pink-800', subBorder: 'border-pink-400' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EVENT_HEIGHT = 26;
const EVENT_GAP = 2;

export function RouteTimeline({ legs, tripStartDate, tripEndDate, onUpdateLeg, onUpdateDayTrip, onSelectLeg }: RouteTimelineProps) {
  const locationLegs = legs.filter((l) => l.type === 'location');
  const tripStart = parseISO(tripStartDate);
  const tripEnd = parseISO(tripEndDate);

  const calendarStart = startOfWeek(tripStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(tripEnd, { weekStartsOn: 1 });

  const weeks = eachWeekOfInterval({ start: calendarStart, end: calendarEnd }, { weekStartsOn: 1 });

  // Build leg display data with stable color assignment
  const legItems = useMemo(() => {
    return locationLegs.map((leg, i) => {
      const start = leg.start_date ? parseISO(leg.start_date) : tripStart;
      const end = leg.end_date ? parseISO(leg.end_date) : start;
      return { leg, start, end, colorIndex: i };
    });
  }, [locationLegs, tripStart]);

  // Build day trip items — single-day events tied to parent location color
  const dayTripItems = useMemo(() => {
    const items: { id: string; name: string; date: Date; colorIndex: number; parentLegId: string; parentStart: Date; parentEnd: Date }[] = [];
    locationLegs.forEach((leg, i) => {
      const parentStart = leg.start_date ? parseISO(leg.start_date) : tripStart;
      const parentEnd = leg.end_date ? parseISO(leg.end_date) : parentStart;
      for (const dt of leg.day_trips ?? []) {
        const date = dt.date ? parseISO(dt.date) : parentStart;
        items.push({ id: dt.id, name: dt.destination_name, date, colorIndex: i, parentLegId: leg.id, parentStart, parentEnd });
      }
    });
    return items;
  }, [locationLegs, tripStart]);

  // Drag state — supports both legs and day trips
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    type: 'leg' | 'daytrip';
    id: string;
    mode: 'move' | 'resize-end' | 'resize-start';
    startX: number;
    startY: number;
    origStart: Date;
    origEnd: Date;
    cellWidth: number;
    cellHeight: number;
    // Day trip constraints
    parentStart?: Date;
    parentEnd?: Date;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState({ dx: 0, dy: 0 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      setDragDelta({ dx: e.clientX - dragging.startX, dy: e.clientY - dragging.startY });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(async () => {
    if (!dragging) return;
    const colDelta = Math.round(dragDelta.dx / dragging.cellWidth);
    const rowDelta = Math.round(dragDelta.dy / dragging.cellHeight);
    const daysDelta = rowDelta * 7 + colDelta;

    setDragging(null);
    setDragDelta({ dx: 0, dy: 0 });

    if (daysDelta === 0) return;

    if (dragging.type === 'daytrip') {
      const newDate = addDays(dragging.origStart, daysDelta);
      // Clamp to parent bounds
      if (dragging.parentStart && newDate < dragging.parentStart) return;
      if (dragging.parentEnd && newDate > dragging.parentEnd) return;
      await onUpdateDayTrip?.(dragging.id, format(newDate, 'yyyy-MM-dd'));
      return;
    }

    let newStart: Date;
    let newEnd: Date;

    if (dragging.mode === 'move') {
      newStart = addDays(dragging.origStart, daysDelta);
      newEnd = addDays(dragging.origEnd, daysDelta);
    } else if (dragging.mode === 'resize-end') {
      newStart = dragging.origStart;
      newEnd = addDays(dragging.origEnd, daysDelta);
      if (newEnd < newStart) newEnd = newStart;
    } else {
      newStart = addDays(dragging.origStart, daysDelta);
      newEnd = dragging.origEnd;
      if (newStart > newEnd) newStart = newEnd;
    }

    await onUpdateLeg(dragging.id, format(newStart, 'yyyy-MM-dd'), format(newEnd, 'yyyy-MM-dd'));
  }, [dragging, dragDelta, onUpdateLeg, onUpdateDayTrip]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // For each week-row, compute which events are visible and their vertical slot
  const weekRows = useMemo(() => {
    return weeks.map((weekStart) => {
      const weekEnd = addDays(weekStart, 6);
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

      // Find location events that overlap this week
      const visibleEvents: {
        item: (typeof legItems)[0];
        startCol: number;
        endCol: number;
        continues_before: boolean;
        continues_after: boolean;
      }[] = [];

      for (const item of legItems) {
        if (item.end < weekStart || item.start > weekEnd) continue;
        const clippedStart = item.start < weekStart ? weekStart : item.start;
        const clippedEnd = item.end > weekEnd ? weekEnd : item.end;
        const startCol = differenceInDays(clippedStart, weekStart);
        const endCol = differenceInDays(clippedEnd, weekStart);
        visibleEvents.push({
          item,
          startCol,
          endCol,
          continues_before: item.start < weekStart,
          continues_after: item.end > weekEnd,
        });
      }

      // Find day trips that fall in this week
      const visibleDayTrips: {
        dayTrip: (typeof dayTripItems)[0];
        col: number;
      }[] = [];

      for (const dt of dayTripItems) {
        if (dt.date < weekStart || dt.date > weekEnd) continue;
        visibleDayTrips.push({ dayTrip: dt, col: differenceInDays(dt.date, weekStart) });
      }

      // Sort locations by start, then wider first
      visibleEvents.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

      // Assign vertical slots — locations first, then day trips
      const slotEnds: number[] = [];
      const assignSlot = (startCol: number, endCol: number) => {
        for (let s = 0; s < slotEnds.length; s++) {
          if (startCol >= slotEnds[s]) {
            slotEnds[s] = endCol + 1;
            return s;
          }
        }
        const slot = slotEnds.length;
        slotEnds.push(endCol + 1);
        return slot;
      };

      const slottedEvents = visibleEvents.map((ev) => ({ ...ev, slot: assignSlot(ev.startCol, ev.endCol) }));
      const slottedDayTrips = visibleDayTrips.map((dt) => ({ ...dt, slot: assignSlot(dt.col, dt.col) }));

      const maxSlots = slotEnds.length;

      return { weekStart, weekDays, events: slottedEvents, dayTrips: slottedDayTrips, maxSlots };
    });
  }, [weeks, legItems, dayTripItems]);

  // Compute drag-adjusted position for an event
  const getDragAdjusted = (itemId: string, startCol: number, endCol: number) => {
    if (!dragging || dragging.id !== itemId) return { startCol, endCol };
    const colDelta = Math.round(dragDelta.dx / dragging.cellWidth);
    const rowDelta = Math.round(dragDelta.dy / dragging.cellHeight);
    const daysDelta = rowDelta * 7 + colDelta;

    if (dragging.mode === 'move') {
      return { startCol: startCol + daysDelta, endCol: endCol + daysDelta };
    } else if (dragging.mode === 'resize-end') {
      return { startCol, endCol: Math.max(startCol, endCol + daysDelta) };
    } else {
      return { startCol: Math.min(endCol, startCol + daysDelta), endCol };
    }
  };

  // Compute month spans per week row for split month headers
  const weekMonthSpans = useMemo(() => {
    const seen = new Set<string>();
    return weekRows.map(({ weekDays }) => {
      const spans: { label: string; startCol: number; endCol: number }[] = [];
      for (let i = 0; i < weekDays.length; i++) {
        const day = weekDays[i];
        const key = `${getYear(day)}-${getMonth(day)}`;
        if (!seen.has(key) && day >= tripStart && day <= tripEnd) {
          seen.add(key);
          const label = format(day, 'MMMM yyyy');
          // Find how far this month extends in this week
          let endCol = i;
          for (let j = i + 1; j < weekDays.length; j++) {
            if (getMonth(weekDays[j]) === getMonth(day) && getYear(weekDays[j]) === getYear(day)) {
              endCol = j;
            } else break;
          }
          spans.push({ label, startCol: i, endCol });
        }
      }
      return spans;
    });
  }, [weekRows, tripStart, tripEnd]);

  return (
    <div className="select-none" ref={containerRef} style={{ cursor: dragging ? 'grabbing' : undefined }}>
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-semibold py-2 text-muted-foreground',
              (i === 5 || i === 6) && 'text-muted-foreground/60',
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weekRows.map(({ weekStart, weekDays, events, dayTrips, maxSlots }, weekIdx) => {
        const eventAreaHeight = Math.max(0, maxSlots) * (EVENT_HEIGHT + EVENT_GAP);
        const minCellHeight = 64 + eventAreaHeight;
        const spans = weekMonthSpans[weekIdx];
        const hasMonthHeader = spans.length > 0;

        return (
          <div key={weekStart.toISOString()}>
            {hasMonthHeader && (
              <div className="grid grid-cols-7 border-b border-border">
                {spans.map((span) => (
                  <div
                    key={span.label}
                    className="px-2 py-1 text-sm font-semibold text-foreground bg-muted/50"
                    style={{
                      gridColumn: `${span.startCol + 1} / ${span.endCol + 2}`,
                    }}
                  >
                    {span.label}
                  </div>
                ))}
              </div>
            )}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day, colIndex) => {
              const weekend = isWeekend(day);
              const isToday = isSameDay(day, new Date());
              const inTripRange = day >= tripStart && day <= tripEnd;
              return (
                <div
                  key={colIndex}
                  className={cn(
                    'relative border-r border-border/50',
                    weekend && 'bg-muted/30',
                    !inTripRange && 'opacity-40',
                  )}
                  style={{ minHeight: minCellHeight }}
                >
                  {/* Date number */}
                  <div className="px-1.5 pt-1">
                    <span
                      className={cn(
                        'text-xs',
                        isToday && 'bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold',
                        !isToday && weekend && 'text-muted-foreground/70',
                        !isToday && !weekend && 'text-muted-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Event bars overlaid on this week row */}
            <div
              className="col-span-7 relative pointer-events-none"
              style={{ height: 0, marginTop: -eventAreaHeight - 4 }}
            >
              {events.map((ev) => {
                const isDraggingThis = dragging?.legId === ev.item.leg.id;
                const color = COLORS[ev.item.colorIndex % COLORS.length];
                const adjusted = getDragAdjusted(ev.item.leg.id, ev.startCol, ev.endCol);

                // Skip if adjusted position puts the bar entirely outside this week
                if (adjusted.endCol < 0 || adjusted.startCol > 6) return null;

                const clippedStart = Math.max(0, adjusted.startCol);
                const clippedEnd = Math.min(6, adjusted.endCol);
                const leftPct = (clippedStart / 7) * 100;
                const widthPct = ((clippedEnd - clippedStart + 1) / 7) * 100;

                return (
                  <div
                    key={ev.item.leg.id}
                    className={cn(
                      'absolute flex items-center text-xs font-medium pointer-events-auto',
                      color.bg,
                      color.text,
                      isDraggingThis ? 'opacity-90 shadow-lg ring-2 ring-white/50 z-30' : 'z-10 hover:brightness-110',
                      ev.continues_before && !isDraggingThis ? 'rounded-l-none' : 'rounded-l-md',
                      ev.continues_after && !isDraggingThis ? 'rounded-r-none' : 'rounded-r-md',
                    )}
                    style={{
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      top: ev.slot * (EVENT_HEIGHT + EVENT_GAP),
                      height: EVENT_HEIGHT,
                      cursor: dragging ? 'grabbing' : 'grab',
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectLeg?.(ev.item.leg.id);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const cell = containerRef.current?.querySelector('.grid.grid-cols-7 + .grid > div') as HTMLElement;
                      const cellWidth = cell ? cell.offsetWidth : 100;
                      const weekRow = (e.currentTarget.closest('.grid.grid-cols-7') as HTMLElement);
                      const cellHeight = weekRow ? weekRow.offsetHeight : 100;
                      setDragging({
                        type: 'leg',
                        id: ev.item.leg.id,
                        mode: 'move',
                        startX: e.clientX,
                        startY: e.clientY,
                        origStart: ev.item.start,
                        origEnd: ev.item.end,
                        cellWidth,
                        cellHeight,
                      });
                    }}
                  >
                    {/* Resize handle left */}
                    {!ev.continues_before && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20 rounded-l-md"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const cell = containerRef.current?.querySelector('.grid.grid-cols-7 + .grid > div') as HTMLElement;
                          const cellWidth = cell ? cell.offsetWidth : 100;
                          const weekRow = (e.currentTarget.closest('.grid.grid-cols-7') as HTMLElement);
                          const cellHeight = weekRow ? weekRow.offsetHeight : 100;
                          setDragging({
                            type: 'leg',
                            id: ev.item.leg.id,
                            mode: 'resize-start',
                            startX: e.clientX,
                            startY: e.clientY,
                            origStart: ev.item.start,
                            origEnd: ev.item.end,
                            cellWidth,
                            cellHeight,
                          });
                        }}
                      />
                    )}
                    <span className="truncate px-1.5">{ev.item.leg.name || 'Unnamed'}</span>
                    {/* Resize handle right */}
                    {!ev.continues_after && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20 rounded-r-md"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const cell = containerRef.current?.querySelector('.grid.grid-cols-7 + .grid > div') as HTMLElement;
                          const cellWidth = cell ? cell.offsetWidth : 100;
                          const weekRow = (e.currentTarget.closest('.grid.grid-cols-7') as HTMLElement);
                          const cellHeight = weekRow ? weekRow.offsetHeight : 100;
                          setDragging({
                            type: 'leg',
                            id: ev.item.leg.id,
                            mode: 'resize-end',
                            startX: e.clientX,
                            startY: e.clientY,
                            origStart: ev.item.start,
                            origEnd: ev.item.end,
                            cellWidth,
                            cellHeight,
                          });
                        }}
                      />
                    )}
                  </div>
                );
              })}
              {/* Day trip bars */}
              {dayTrips.map((dt) => {
                const isDraggingThis = dragging?.id === dt.dayTrip.id;
                const color = COLORS[dt.dayTrip.colorIndex % COLORS.length];
                const adjusted = getDragAdjusted(dt.dayTrip.id, dt.col, dt.col);
                const adjustedCol = adjusted.startCol;

                if (adjustedCol < 0 || adjustedCol > 6) return null;

                const clippedCol = Math.max(0, Math.min(6, adjustedCol));
                const leftPct = (clippedCol / 7) * 100;
                const widthPct = (1 / 7) * 100;

                return (
                  <div
                    key={dt.dayTrip.id}
                    className={cn(
                      'absolute flex items-center text-[10px] font-medium pointer-events-auto rounded-md border',
                      color.subBg,
                      color.subText,
                      color.subBorder,
                      isDraggingThis ? 'opacity-90 shadow-lg ring-2 ring-white/50 z-30' : 'z-10 hover:brightness-95',
                    )}
                    style={{
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      top: dt.slot * (EVENT_HEIGHT + EVENT_GAP),
                      height: EVENT_HEIGHT - 2,
                      cursor: dragging ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const cell = containerRef.current?.querySelector('.grid.grid-cols-7 + .grid > div') as HTMLElement;
                      const cellWidth = cell ? cell.offsetWidth : 100;
                      const weekRow = (e.currentTarget.closest('.grid.grid-cols-7') as HTMLElement);
                      const cellHeight = weekRow ? weekRow.offsetHeight : 100;
                      setDragging({
                        type: 'daytrip',
                        id: dt.dayTrip.id,
                        mode: 'move',
                        startX: e.clientX,
                        startY: e.clientY,
                        origStart: dt.dayTrip.date,
                        origEnd: dt.dayTrip.date,
                        cellWidth,
                        cellHeight,
                        parentStart: dt.dayTrip.parentStart,
                        parentEnd: dt.dayTrip.parentEnd,
                      });
                    }}
                  >
                    <span className="truncate px-1.5">{dt.dayTrip.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        );
      })}
    </div>
  );
}
