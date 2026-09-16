export interface Tag {
	id: string;
	user: string;
	name: string;
	color: string; // Formato HEX (ex.: #3B82F6)
	created?: string;
	updated?: string;
}

export interface Appointment {
	id: string;
	user: string;
	title: string;
	description?: string;
	starts_at: string;
	ends_at: string;
	all_day?: boolean;
	tag?: string;
	expand?: {
		tag?: Tag;
	};
	created?: string;
	updated?: string;
}

export interface Task {
	id: string;
	user: string;
	title: string;
	description?: string;
	due_date: string;
	completed: boolean;
	completed_at?: string;
	tag?: string;
	expand?: {
		tag?: Tag;
	};
	created?: string;
	updated?: string;
}

// Preset de cores sugeridas para as tags
export const PRESET_TAG_COLORS = [
	{ hex: '#7555D9', name: 'Violeta' },
	{ hex: '#3B82F6', name: 'Azul' },
	{ hex: '#10B981', name: 'Verde' },
	{ hex: '#F59E0B', name: 'Amarelo' },
	{ hex: '#EC4899', name: 'Rosa' },
	{ hex: '#EF4444', name: 'Vermelho' },
	{ hex: '#6366F1', name: 'Índigo' },
	{ hex: '#14B8A6', name: 'Teal' },
	{ hex: '#64748B', name: 'Cinza' }
];
