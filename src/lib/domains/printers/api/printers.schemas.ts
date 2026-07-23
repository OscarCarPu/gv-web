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
