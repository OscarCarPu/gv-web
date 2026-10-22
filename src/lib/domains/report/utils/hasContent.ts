import type { Report } from '../api/report.schemas';

/** Whether the report says anything: changes home made, or the comparison failing. */
export const hasContent = (report: Report | null): boolean =>
	!!report && (report.items.length > 0 || !!report.error);
