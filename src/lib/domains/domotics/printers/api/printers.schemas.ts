import * as z from 'zod';

export const TelemetrySchema = z.object({
	configured: z.boolean(),
	online: z.boolean(),
	state: z.string().optional(),
	temps: z.object({
		nozzle: z.number().optional(),
		nozzleTarget: z.number().optional(),
		bed: z.number().optional(),
		bedTarget: z.number().optional(),
		chamber: z.number().optional(),
	}),
	fans: z.object({
		hotend: z.number().optional(),
		print: z.number().optional(),
	}),
	axisZ: z.number().optional(),
	speed: z.number().optional(),
	flow: z.number().optional(),
	job: z
		.object({
			progress: z.number().optional(),
			timeRemaining: z.number().optional(),
			timePrinting: z.number().optional(),
			fileName: z.string().optional(),
			material: z.string().optional(),
		})
		.optional(),
	error: z.string().optional(),
});

export type Telemetry = z.infer<typeof TelemetrySchema>;

export const PrinterFileSchema = z.object({
	name: z.string(),
	displayName: z.string(),
	size: z.number().optional(),
	readOnly: z.boolean().optional(),
});

export const PrinterStorageSchema = z.object({
	name: z.string(),
	available: z.boolean(),
	readOnly: z.boolean(),
	freeSpace: z.number().optional(),
	totalSpace: z.number().optional(),
});

export const PrinterFilesSchema = z.object({
	online: z.boolean(),
	storage: PrinterStorageSchema.optional(),
	files: z
		.array(PrinterFileSchema)
		.nullable()
		.transform((v) => v ?? []),
	error: z.string().optional(),
});

/** Progress + outcome of the gv-web → printer leg of an upload. */
export const UploadProgressSchema = z.object({
	status: z.enum(['forwarding', 'done', 'error', 'unknown']),
	sent: z.number(),
	total: z.number(),
	error: z.string().optional(),
	httpStatus: z.number().optional(),
});

export type UploadProgress = z.infer<typeof UploadProgressSchema>;

/** Uploads the server still knows about, so a reloaded page can re-attach to them. */
export const ActiveUploadsSchema = z.object({
	uploads: z
		.array(
			UploadProgressSchema.extend({
				uploadId: z.string(),
				name: z.string(),
			})
		)
		.nullable()
		.transform((v) => v ?? []),
});

export type ActiveUpload = z.infer<typeof ActiveUploadsSchema>['uploads'][number];

/** One camera recording on the server's disk. */
export const RecordingSchema = z.object({
	name: z.string(),
	startedAt: z.string(),
	/** Absent while it is still being written. */
	endedAt: z.string().optional(),
	durationMs: z.number(),
	sizeBytes: z.number(),
	recording: z.boolean(),
	poster: z.string().optional(),
});

export const RecordingsSchema = z.object({
	recordings: z
		.array(RecordingSchema)
		.nullable()
		.transform((v) => v ?? []),
	usedBytes: z.number(),
	maxBytes: z.number(),
});

export type Recording = z.infer<typeof RecordingSchema>;
export type Recordings = z.infer<typeof RecordingsSchema>;

export type PrinterFile = z.infer<typeof PrinterFileSchema>;
export type PrinterStorage = z.infer<typeof PrinterStorageSchema>;
export type PrinterFiles = z.infer<typeof PrinterFilesSchema>;
