import { useCallback, useSyncExternalStore } from "react"

import type { PatientGender } from "@/client"

// The backend has no queue model yet, so the waiting room lives in
// localStorage and is shared between the Dashboard and Queue pages.
// Replace with a QueueService once a queue endpoint exists.

export type QueueStatus = "Waiting" | "InConsultation" | "Completed"
export type QueuePriority = "Routine" | "Urgent" | "Emergency"

export interface QueueEntry {
  id: string
  patientId: string
  patientName: string
  age: number
  gender?: PatientGender | null
  reason: string
  physicianName: string
  priority: QueuePriority
  status: QueueStatus
  arrivedAt: string
}

export const STATUS_LABEL: Record<QueueStatus, string> = {
  Waiting: "Waiting",
  InConsultation: "In Consultation",
  Completed: "Completed",
}

export const PRIORITY_RANK: Record<QueuePriority, number> = {
  Emergency: 0,
  Urgent: 1,
  Routine: 2,
}

export const PRIORITY_VARIANT = {
  Emergency: "destructive",
  Urgent: "default",
  Routine: "secondary",
} as const

export const minutesWaiting = (arrivedAt: string) =>
  Math.max(0, Math.round((Date.now() - new Date(arrivedAt).getTime()) / 60000))

const STORAGE_KEY = "patient-queue"
const EMPTY: QueueEntry[] = []
const listeners = new Set<() => void>()
let cache: QueueEntry[] | null = null

function read(): QueueEntry[] {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    cache = EMPTY
  }
  return cache ?? EMPTY
}

function write(next: QueueEntry[]) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: keep the in-memory copy for this session.
  }
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const useQueue = () => {
  const queue = useSyncExternalStore(subscribe, read)
  const updateQueue = useCallback(
    (fn: (q: QueueEntry[]) => QueueEntry[]) => write(fn(read())),
    [],
  )
  return { queue, updateQueue }
}

export default useQueue
