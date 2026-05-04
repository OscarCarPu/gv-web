export interface Variety {
	id: number;
	name: string;
	scent: number;
	flavor: number;
	power: number;
	quality: number;
	score: number;
	price: number;
	comments: string | null;
	judge: string;
}

export interface CreateVarietyRequest {
	name: string;
	scent: number;
	flavor: number;
	power: number;
	quality: number;
	price: number;
	comments?: string | null;
	judge: string;
}

export type UpdateVarietyRequest = CreateVarietyRequest;
