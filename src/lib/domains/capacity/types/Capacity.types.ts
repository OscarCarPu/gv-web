export interface DayFreeBusy {
	date: string;
	capacity_hours: string;
	busy_hours: string;
	free_hours: string;
}

export interface FreeBusyRangeResponse {
	from: string;
	to: string;
	days: DayFreeBusy[];
}
