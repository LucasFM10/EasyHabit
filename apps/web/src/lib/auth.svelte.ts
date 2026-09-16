import { pb } from './pocketbase';

type WhatsAppRegistration = {
	phone: string;
	username: string;
	email?: string;
	password: string;
	passwordConfirm: string;
	inviteCode: string;
};

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
		const rawIdentity = email.trim();
		const phoneDigits = rawIdentity.replace(/\D/g, '');
		const isPhone = /^[\d\s()+-]+$/.test(rawIdentity) && phoneDigits.length >= 10;
		const identity = isPhone
			? phoneDigits.length === 10 || phoneDigits.length === 11
				? `55${phoneDigits}`
				: phoneDigits
			: rawIdentity.toLowerCase();

		return await pb.collection('users').authWithPassword(identity, pass);
	}

	async requestWhatsAppOtp(
		phone: string,
		registration?: Pick<WhatsAppRegistration, 'username' | 'email' | 'inviteCode'>
	) {
		const response = await fetch(`${pb.baseUrl}/api/easyhabit/request-otp`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				phone,
				purpose: registration ? 'register' : 'reset',
				username: registration?.username,
				email: registration?.email,
				inviteCode: registration?.inviteCode
			})
		});

		const resData = await response.json();
		if (!response.ok) {
			throw new Error(resData.message || 'Erro ao solicitar código no WhatsApp.');
		}
		return resData;
	}

	async verifyWhatsAppOtp(registration: WhatsAppRegistration & { code: string }) {
		const response = await fetch(`${pb.baseUrl}/api/easyhabit/verify-otp`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(registration)
		});

		const resData = await response.json();
		if (!response.ok) {
			throw new Error(resData.message || 'Erro ao verificar código.');
		}

		pb.authStore.save(resData.token, resData.record);
		return resData;
	}

	async resetPasswordWhatsApp(phone: string, code: string, newPassword: string) {
		const response = await fetch(`${pb.baseUrl}/api/easyhabit/reset-password-otp`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ phone, code, newPassword })
		});

		const resData = await response.json();
		if (!response.ok) {
			throw new Error(resData.message || 'Erro ao redefinir a senha.');
		}

		pb.authStore.save(resData.token, resData.record);
		return resData;
	}

	logout() {
		pb.authStore.clear();
	}
}

export const auth = new AuthState();
