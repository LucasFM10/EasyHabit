import { pb } from './pocketbase';

class AuthState {
	user = $state(pb.authStore.record);
	isValid = $state(pb.authStore.isValid);

	constructor() {
		if (typeof window !== 'undefined') {
			pb.authStore.onChange((_token, record) => {
				this.user = record;
				this.isValid = pb.authStore.isValid;
			}, true);
		}
	}

	async login(email: string, pass: string) {
		return await pb.collection('users').authWithPassword(email, pass);
	}

	logout() {
		pb.authStore.clear();
	}
}

export const auth = new AuthState();
