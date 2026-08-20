import * as z from 'zod';

export const CalendarSyncStateSchema = z.object({
	has_sync_token: z.boolean(),
	last_sync_at: z.string().nullable(),
	last_full_sync_at: z.string().nullable(),
	last_sync_error: z.string().nullable(),
	watch_active: z.boolean(),
	watch_expires_at: z.string().nullable(),
});

export const CalendarSchema = z.object({
	id: z.number(),
	account_id: z.number(),
	account_email: z.string(),
	account_status: z.string(),
	google_calendar_id: z.string(),
	summary: z.string(),
	description: z.string(),
	time_zone: z.string(),
	color: z.string(),
	foreground_color: z.string(),
	access_role: z.string(),
	writable: z.boolean(),
	is_primary: z.boolean(),
	sync_enabled: z.boolean(),
	visible: z.boolean(),
	deleted: z.boolean(),
	sync: CalendarSyncStateSchema,
});

export const CalendarListSchema = z
	.array(CalendarSchema)
	.nullable()
	.transform((v) => v ?? []);

export const AttendeeSchema = z.object({
	email: z.string(),
	display_name: z.string().optional(),
	optional: z.boolean().optional(),
	response_status: z.string().optional(),
	self: z.boolean().optional(),
	organizer: z.boolean().optional(),
});

export const RemindersSchema = z.object({
	use_default: z.boolean(),
	overrides: z
		.array(z.object({ method: z.string(), minutes: z.number() }))
		.nullable()
		.optional()
		.transform((v) => v ?? []),
});

export const CalendarEventSchema = z.object({
	instance_id: z.string(),
	event_id: z.number(),
	calendar_id: z.number(),
	account_id: z.number(),
	account_email: z.string(),
	calendar_name: z.string(),
	color: z.string(),
	google_event_id: z.string(),
	summary: z.string(),
	description: z.string(),
	location: z.string(),
	status: z.string(),
	event_type: z.string(),
	all_day: z.boolean(),
	starts_at: z.string(),
	ends_at: z.string(),
	time_zone: z.string(),
	recurring: z.boolean(),
	// The API omits these when empty, so they are optional rather than nullable.
	recurrence: z.array(z.string()).optional(),
	is_exception: z.boolean(),
	original_starts_at: z.string().optional(),
	editable: z.boolean(),
	organizer_email: z.string().optional(),
	attendees: z.array(AttendeeSchema).optional(),
	reminders: RemindersSchema.nullable().optional(),
	transparency: z.string().optional(),
	visibility: z.string().optional(),
	html_link: z.string().optional(),
	hangout_link: z.string().optional(),
	created_by_gv: z.boolean(),
	updated_at: z.string().optional(),
});

export const CalendarEventListSchema = z
	.array(CalendarEventSchema)
	.nullable()
	.transform((v) => v ?? []);

export const CalendarAccountSchema = z.object({
	id: z.number(),
	email: z.string(),
	label: z.string(),
	color: z.string(),
	status: z.string(),
	calendars: z.number(),
	last_sync_at: z.string().nullable(),
	last_sync_error: z.string().nullable(),
	created_at: z.string(),
});

export const CalendarAccountListSchema = z
	.array(CalendarAccountSchema)
	.nullable()
	.transform((v) => v ?? []);

export const AuthURLSchema = z.object({ url: z.string() });

export const SyncResultSchema = z.object({
	calendars: z.number(),
	upserted: z.number(),
	deleted: z.number(),
	errors: z
		.array(z.string())
		.nullable()
		.transform((v) => v ?? []),
});

export const MoveResultSchema = z.object({
	event: CalendarEventSchema,
	// True when the move crossed accounts: the event was recreated, so its id changed and the
	// old reference is dead.
	recreated: z.boolean(),
});

export const SyncStatusSchema = z.object({
	configured: z.boolean(),
	webhooks_active: z.boolean(),
	poll_interval: z.string(),
	accounts: CalendarAccountListSchema,
	calendars: z
		.array(
			z.object({
				calendar_id: z.number(),
				account_email: z.string(),
				summary: z.string(),
				sync_enabled: z.boolean(),
				events: z.number(),
				sync: CalendarSyncStateSchema,
			})
		)
		.nullable()
		.transform((v) => v ?? []),
	recent_runs: z
		.array(
			z.object({
				id: z.number(),
				calendar_id: z.number().nullable(),
				trigger: z.string(),
				kind: z.string(),
				started_at: z.string(),
				finished_at: z.string().nullable(),
				pages: z.number(),
				upserted: z.number(),
				deleted: z.number(),
				error: z.string().nullable(),
			})
		)
		.nullable()
		.transform((v) => v ?? []),
});
