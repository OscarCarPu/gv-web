import * as z from 'zod';
import { fetchAPI } from '$shared/api/client';
import { RutasMarkSchema, RutasMarksSchema } from './rutas.schemas';
import type { CreateMarkPayload, UpdateMarkPayload } from '../types/Rutas.types';

export const rutasApi = {
	list: () => fetchAPI('/rutas/marks', RutasMarksSchema),

	create: (payload: CreateMarkPayload) =>
		fetchAPI('/rutas/marks', RutasMarkSchema, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),

	update: (id: number, payload: UpdateMarkPayload) =>
		fetchAPI(`/rutas/marks/${id}`, RutasMarkSchema, {
			method: 'PUT',
			body: JSON.stringify(payload),
		}),

	delete: (id: number) =>
		fetchAPI(`/rutas/marks/${id}`, z.void(), {
			method: 'DELETE',
		}),
};
