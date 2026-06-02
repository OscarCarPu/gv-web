import type { Geometry, Feature, FeatureCollection } from 'geojson';
import type { RutasMark } from '../api/rutas.schemas';

export interface ConcelhoProperties {
	id: string;
	name: string;
	province: string;
	prov_code: string;
}

export type ConcelhoFeature = Feature<Geometry, ConcelhoProperties>;

export type GaliciaGeoJSON = FeatureCollection<Geometry, ConcelhoProperties>;

// Local mark state — derived from API response, keyed by concello name
export interface LocalMark {
	apiId: number;
	name: string;
	date: string; // YYYY-MM-DD, sliced from visited_on
	description: string;
}

export interface CreateMarkPayload {
	name: string;
	visited_on: string; // YYYY-MM-DD
	description: string;
}

export interface UpdateMarkPayload {
	visited_on: string; // YYYY-MM-DD
	description: string;
}

export type { RutasMark };
