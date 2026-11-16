import type { AppStateSnapshot } from './types.js'

/** Legacy events may omit generation; native snapshots must always provide it. */
export function parseSnapshot(
    value: unknown,
    allowMissingGeneration = false
): AppStateSnapshot | undefined {
    if (typeof value !== 'object' || value === null || !('state' in value)) return undefined
    if (value.state !== 'active' && value.state !== 'background') return undefined
    const generation = 'generation' in value ? value.generation : undefined
    if (allowMissingGeneration && generation === undefined) {
        return { state: value.state, generation: -1 }
    }
    if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 0) {
        return undefined
    }
    return { state: value.state, generation }
}
