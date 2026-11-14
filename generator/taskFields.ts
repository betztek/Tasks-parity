import type { Moment } from 'moment';
import type { Task } from '../vendor/obsidian-tasks/src/Task/Task';
import { PriorityTools } from '../vendor/obsidian-tasks/src/lib/PriorityTools';

/**
 * Language-neutral view of a parsed Task. Pure data extraction from Tasks' own
 * Task object: no behaviour is computed here. Schema: docs/CASE-FORMAT.md.
 */
export interface TaskFields {
    indentation: string;
    listMarker: string;
    status: { symbol: string; name: string; type: string; nextStatusSymbol: string };
    description: string;
    priority: string;
    dates: {
        created: string | null;
        start: string | null;
        scheduled: string | null;
        due: string | null;
        done: string | null;
        cancelled: string | null;
    };
    scheduledDateIsInferred: boolean;
    recurrence: string | null;
    onCompletion: string;
    id: string;
    dependsOn: string[];
    tags: string[];
    blockLink: string;
}

const day = (m: Moment | null) => (m ? m.format('YYYY-MM-DD') : null);

export function taskToFields(task: Task): TaskFields {
    return {
        indentation: task.indentation,
        listMarker: task.listMarker,
        status: {
            symbol: task.status.symbol,
            name: task.status.name,
            type: task.status.type,
            nextStatusSymbol: task.status.nextStatusSymbol,
        },
        description: task.description,
        priority: PriorityTools.priorityNameUsingNone(task.priority).toLowerCase(),
        dates: {
            created: day(task.createdDate),
            start: day(task.startDate),
            scheduled: day(task.scheduledDate),
            due: day(task.dueDate),
            done: day(task.doneDate),
            cancelled: day(task.cancelledDate),
        },
        scheduledDateIsInferred: task.scheduledDateIsInferred,
        recurrence: task.recurrence ? task.recurrence.toText() : null,
        onCompletion: task.onCompletion,
        id: task.id,
        dependsOn: [...task.dependsOn],
        tags: [...task.tags],
        blockLink: task.blockLink,
    };
}
