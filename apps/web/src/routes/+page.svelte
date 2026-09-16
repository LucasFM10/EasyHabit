<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/pocketbase';
	import { auth } from '$lib/auth.svelte';
	import { type Tag, type Appointment, type Task, PRESET_TAG_COLORS } from '$lib/types';

	type AuthTab = 'login' | 'register';
	type ResetState = 'none' | 'phone' | 'code';
	type AgendaView = 'calendar' | 'list';
	type AgendaFilter = 'all' | 'appointments' | 'tasks';
	type AgendaListItem =
		| { kind: 'appointment'; sortTime: number; appointment: Appointment }
		| { kind: 'task'; sortTime: number; task: Task };

	const monthNames = [
		'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
		'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
	];
	const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

	// Estado de Autenticação Tradicional
	let authTab = $state<AuthTab>('login');
	let email = $state('');
	let password = $state('');
	let accessCode = $state('');
	let authLoading = $state(false);
	let authError = $state('');
	let authSuccess = $state('');
	let showPassword = $state(false);

	// Estado do Cadastro / Login via WhatsApp
	let whatsappUsername = $state('');
	let whatsappEmail = $state('');
	let whatsappPhone = $state('');
	let whatsappPassword = $state('');
	let whatsappPasswordConfirm = $state('');
	let whatsappOtp = $state('');
	let whatsappStep = $state<'phone' | 'code'>('phone');

	// Estado da Recuperação de Senha via WhatsApp
	let resetState = $state<ResetState>('none');
	let resetPhone = $state('');
	let resetOtp = $state('');
	let resetNewPassword = $state('');

	// Estado Principal dos Dados
	let appointments = $state<Appointment[]>([]);
	let tasks = $state<Task[]>([]);
	let tags = $state<Tag[]>([]);
	let loading = $state(false);
	let pageError = $state('');
	let agendaView = $state<AgendaView>('calendar');
	let agendaFilter = $state<AgendaFilter>('all');
	let listStartDate = $state('');
	let listEndDate = $state('');

	// Calendário e Seleção
	let viewDate = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	let selectedDate = $state(dateKey(new Date()));

	// Controle de Modais
	let showQuickCreateModal = $state(false);
	let showEventModal = $state(false);
	let showTaskModal = $state(false);
	let showTagManagerModal = $state(false);
	let saving = $state(false);
	let formError = $state('');

	// Formulário de Evento
	let editingEventId = $state<string | null>(null);
	let eventForm = $state({
		title: '',
		description: '',
		allDay: false,
		startDate: dateKey(new Date()),
		startTime: '09:00',
		endDate: dateKey(new Date()),
		endTime: '10:00',
		tagId: ''
	});

	// Formulário de Tarefa
	let editingTaskId = $state<string | null>(null);
	let taskForm = $state({
		title: '',
		description: '',
		dueDate: dateKey(new Date()),
		tagId: ''
	});

	// Formulário de Tag
	let editingTagId = $state<string | null>(null);
	let tagForm = $state({
		name: '',
		color: '#3B82F6'
	});

	// Derivados
	let tagMap = $derived(new Map(tags.map((t) => [t.id, t])));
	let calendarDays = $derived(buildCalendar(viewDate));

	let monthLabel = $derived(`${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`);
	let selectedDateLabel = $derived(formatLongDate(selectedDate));
	let showAppointments = $derived(agendaFilter !== 'tasks');
	let showTasks = $derived(agendaFilter !== 'appointments');
	let listRangeInvalid = $derived(!!listStartDate && !!listEndDate && listStartDate > listEndDate);
	let chronologicalItems = $derived(buildChronologicalItems());

	// Filtragem para o Painel do Dia Selecionado
	let selectedAllDayAppointments = $derived(
		showAppointments
			? appointments.filter((app) => isAppointmentOnDay(app, selectedDate) && isMultiDayOrAllDay(app))
			: []
	);

	let selectedTimedAppointments = $derived(
		showAppointments
			? appointments
			.filter((app) => isAppointmentOnDay(app, selectedDate) && !isMultiDayOrAllDay(app))
			.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
			: []
	);

	let selectedDayTasks = $derived(
		showTasks
			? tasks
			.filter((task) => isTaskOnDay(task, selectedDate))
			.sort((a, b) => Number(a.completed) - Number(b.completed))
			: []
	);

	// Helpers de Data
	function dateKey(date: Date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function isAppointmentOnDay(appointment: Appointment, key: string) {
		const startKey = appointment.starts_at.substring(0, 10);
		const endKey = appointment.ends_at.substring(0, 10);
		return key >= startKey && key <= endKey;
	}

	function isMultiDayOrAllDay(appointment: Appointment) {
		if (appointment.all_day) return true;
		const startKey = appointment.starts_at.substring(0, 10);
		const endKey = appointment.ends_at.substring(0, 10);
		return startKey !== endKey;
	}

	function isTaskOnDay(task: Task, key: string) {
		if (!task.due_date) return false;
		return task.due_date.substring(0, 10) === key;
	}

	function buildCalendar(month: Date) {
		const first = new Date(month.getFullYear(), month.getMonth(), 1);
		const gridStart = new Date(first);
		gridStart.setDate(first.getDate() - first.getDay());

		return Array.from({ length: 42 }, (_, index) => {
			const day = new Date(gridStart);
			day.setDate(gridStart.getDate() + index);
			return {
				date: day,
				key: dateKey(day),
				currentMonth: day.getMonth() === month.getMonth()
			};
		});
	}

	function formatLongDate(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Intl.DateTimeFormat('pt-BR', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(year, month - 1, day));
	}

	function formatTime(isoString: string) {
		const date = new Date(isoString);
		if (!Number.isFinite(date.getTime())) return '--:--';

		return new Intl.DateTimeFormat('pt-BR', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(date);
	}

	function formatListDate(isoString: string) {
		const dateKeyValue = isoString?.substring(0, 10) || '';
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKeyValue)) return 'Data não informada';

		const [year, month, day] = dateKeyValue.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		if (!Number.isFinite(date.getTime())) return 'Data não informada';

		return new Intl.DateTimeFormat('pt-BR', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	function sortableTimestamp(value: string) {
		const timestamp = new Date(value).getTime();
		return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
	}

	function isWithinListRange(value: string) {
		const itemDate = value?.substring(0, 10) || '';
		if (!/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) return false;
		if (listStartDate && itemDate < listStartDate) return false;
		if (listEndDate && itemDate > listEndDate) return false;
		return true;
	}

	function clearListRange() {
		listStartDate = '';
		listEndDate = '';
	}

	function buildChronologicalItems(): AgendaListItem[] {
		if (listRangeInvalid) return [];

		const items: AgendaListItem[] = [];

		if (agendaFilter !== 'tasks') {
			for (const appointment of appointments) {
				if (!isWithinListRange(appointment.starts_at)) continue;
				items.push({
					kind: 'appointment',
					sortTime: sortableTimestamp(appointment.starts_at),
					appointment
				});
			}
		}

		if (agendaFilter !== 'appointments') {
			for (const task of tasks) {
				if (!isWithinListRange(task.due_date)) continue;
				items.push({
					kind: 'task',
					sortTime: sortableTimestamp(task.due_date),
					task
				});
			}
		}

		return items.sort((a, b) => a.sortTime - b.sortTime);
	}

	function getDaySummary(key: string) {
		const dayApps = showAppointments ? appointments.filter((app) => isAppointmentOnDay(app, key)) : [];
		const dayTasks = showTasks ? tasks.filter((task) => isTaskOnDay(task, key)) : [];
		return {
			allDay: dayApps.filter((a) => isMultiDayOrAllDay(a)),
			timed: dayApps.filter((a) => !isMultiDayOrAllDay(a)),
			tasks: dayTasks
		};
	}

	// Autenticação Tradicional
	async function handleAuthLogin(event: SubmitEvent) {
		event.preventDefault();
		authError = '';
		authSuccess = '';
		authLoading = true;

		try {
			await auth.login(email, password);
			password = '';
			await loadAllData();
		} catch (error: any) {
			authError = 'E-mail ou senha incorretos.';
		} finally {
			authLoading = false;
		}
	}

	// Fluxo de Cadastro via WhatsApp
	async function handleRegisterWhatsAppRequest(event: SubmitEvent) {
		event.preventDefault();
		authError = '';
		authSuccess = '';
		authLoading = true;

		try {
			const normalizedUsername = whatsappUsername.trim().toLowerCase();
			if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
				throw new Error(
					'O nome de usuário deve ter de 3 a 30 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou sublinhado.'
				);
			}
			if (whatsappPassword.length < 8) {
				throw new Error('A senha deve ter no mínimo 8 caracteres.');
			}
			if (whatsappPassword !== whatsappPasswordConfirm) {
				throw new Error('A senha e a confirmação não coincidem.');
			}

			whatsappUsername = normalizedUsername;
			const res = await auth.requestWhatsAppOtp(whatsappPhone, {
				username: normalizedUsername,
				email: whatsappEmail.trim().toLowerCase(),
				inviteCode: accessCode.trim()
			});
			authSuccess = res.message || 'Código enviado via WhatsApp!';
			whatsappStep = 'code';
		} catch (error: any) {
			authError = error.message || 'Não foi possível enviar o código via WhatsApp.';
		} finally {
			authLoading = false;
		}
	}

	async function handleRegisterWhatsAppVerify(event: SubmitEvent) {
		event.preventDefault();
		authError = '';
		authSuccess = '';
		authLoading = true;

		try {
			await auth.verifyWhatsAppOtp({
				phone: whatsappPhone,
				code: whatsappOtp,
				username: whatsappUsername,
				email: whatsappEmail.trim().toLowerCase(),
				password: whatsappPassword,
				passwordConfirm: whatsappPasswordConfirm,
				inviteCode: accessCode.trim()
			});
			whatsappPassword = '';
			whatsappPasswordConfirm = '';
			accessCode = '';
			await loadAllData();
		} catch (error: any) {
			authError = error.message || 'Código incorreto ou expirado.';
		} finally {
			authLoading = false;
		}
	}

	// Fluxo de Recuperação de Senha via WhatsApp
	async function handleResetRequestOtp(event: SubmitEvent) {
		event.preventDefault();
		authError = '';
		authSuccess = '';
		authLoading = true;

		try {
			const res = await auth.requestWhatsAppOtp(resetPhone);
			authSuccess = res.message || 'Código de redefinição enviado via WhatsApp!';
			resetState = 'code';
		} catch (error: any) {
			authError = error.message || 'Não foi possível enviar o código via WhatsApp.';
		} finally {
			authLoading = false;
		}
	}

	async function handleResetPassword(event: SubmitEvent) {
		event.preventDefault();
		authError = '';
		authSuccess = '';
		authLoading = true;

		try {
			await auth.resetPasswordWhatsApp(resetPhone, resetOtp, resetNewPassword);
			await loadAllData();
		} catch (error: any) {
			authError = error.message || 'Erro ao redefinir senha.';
		} finally {
			authLoading = false;
		}
	}

	function switchTab(tab: AuthTab) {
		authTab = tab;
		authError = '';
		authSuccess = '';
		resetState = 'none';
		whatsappStep = 'phone';
		whatsappOtp = '';
		resetOtp = '';
		accessCode = '';
	}

	function logout() {
		auth.logout();
		appointments = [];
		tasks = [];
		tags = [];
		email = '';
		authTab = 'login';
		resetState = 'none';
	}

	// Carregamento de Dados
	async function loadAllData() {
		if (!auth.isValid || !auth.user) return;
		loading = true;
		pageError = '';

		try {
			const [fetchedTags, fetchedApps, fetchedTasks] = await Promise.all([
				pb.collection('tags').getFullList<Tag>({ sort: 'name' }),
				pb.collection('appointments').getFullList<Appointment>({ sort: 'starts_at', expand: 'tag' }),
				pb.collection('tasks').getFullList<Task>({ sort: '-created', expand: 'tag' })
			]);

			tags = fetchedTags;
			appointments = fetchedApps;
			tasks = fetchedTasks;
		} catch (error) {
			console.error(error);
			pageError = 'Não foi possível carregar seus dados. Tente atualizar a página.';
		} finally {
			loading = false;
		}
	}

	// Controles do Calendário
	function changeMonth(offset: number) {
		viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
	}

	function goToday() {
		const today = new Date();
		viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
		selectedDate = dateKey(today);
	}

	function selectDay(day: Date) {
		selectedDate = dateKey(day);
		if (day.getMonth() !== viewDate.getMonth()) {
			viewDate = new Date(day.getFullYear(), day.getMonth(), 1);
		}
	}

	// Ações de Compromisso
	function openNewEvent(date = selectedDate) {
		editingEventId = null;
		formError = '';
		eventForm = {
			title: '',
			description: '',
			allDay: false,
			startDate: date,
			startTime: '09:00',
			endDate: date,
			endTime: '10:00',
			tagId: tags.length > 0 ? tags[0].id : ''
		};
		showQuickCreateModal = false;
		showEventModal = true;
	}

	function openEditEvent(appointment: Appointment) {
		const starts = new Date(appointment.starts_at);
		const ends = new Date(appointment.ends_at);

		editingEventId = appointment.id;
		formError = '';
		eventForm = {
			title: appointment.title,
			description: appointment.description || '',
			allDay: !!appointment.all_day,
			startDate: dateKey(starts),
			startTime: `${String(starts.getHours()).padStart(2, '0')}:${String(starts.getMinutes()).padStart(2, '0')}`,
			endDate: dateKey(ends),
			endTime: `${String(ends.getHours()).padStart(2, '0')}:${String(ends.getMinutes()).padStart(2, '0')}`,
			tagId: appointment.tag || ''
		};
		showEventModal = true;
	}

	async function saveEvent(event: SubmitEvent) {
		event.preventDefault();
		if (!auth.user) return;

		let startsAtStr: string;
		let endsAtStr: string;

		if (eventForm.allDay) {
			startsAtStr = `${eventForm.startDate}T00:00:00.000Z`;
			endsAtStr = `${eventForm.endDate}T23:59:59.999Z`;
		} else {
			const starts = new Date(`${eventForm.startDate}T${eventForm.startTime}:00`);
			const ends = new Date(`${eventForm.endDate}T${eventForm.endTime}:00`);

			if (ends <= starts) {
				formError = 'O horário ou data de término deve ser posterior ao início.';
				return;
			}
			startsAtStr = starts.toISOString();
			endsAtStr = ends.toISOString();
		}

		saving = true;
		formError = '';

		const payload = {
			user: auth.user.id,
			title: eventForm.title.trim(),
			description: eventForm.description.trim(),
			starts_at: startsAtStr,
			ends_at: endsAtStr,
			all_day: eventForm.allDay,
			tag: eventForm.tagId || null
		};

		try {
			if (editingEventId) {
				await pb.collection('appointments').update(editingEventId, payload);
			} else {
				await pb.collection('appointments').create(payload);
			}
			selectedDate = eventForm.startDate;
			showEventModal = false;
			await loadAllData();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível salvar o compromisso.';
		} finally {
			saving = false;
		}
	}

	async function deleteEvent() {
		if (!editingEventId || !confirm('Excluir este compromisso?')) return;
		saving = true;
		try {
			await pb.collection('appointments').delete(editingEventId);
			showEventModal = false;
			await loadAllData();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível excluir o compromisso.';
		} finally {
			saving = false;
		}
	}

	// Ações de Tarefa
	function openNewTask(date = selectedDate) {
		editingTaskId = null;
		formError = '';
		taskForm = {
			title: '',
			description: '',
			dueDate: date,
			tagId: tags.length > 0 ? tags[0].id : ''
		};
		showQuickCreateModal = false;
		showTaskModal = true;
	}

	function openEditTask(task: Task) {
		editingTaskId = task.id;
		formError = '';
		taskForm = {
			title: task.title,
			description: task.description || '',
			dueDate: task.due_date ? task.due_date.substring(0, 10) : dateKey(new Date()),
			tagId: task.tag || ''
		};
		showTaskModal = true;
	}

	async function saveTask(event: SubmitEvent) {
		event.preventDefault();
		if (!auth.user) return;
		if (!taskForm.dueDate) {
			formError = 'Informe a data de prazo da tarefa.';
			return;
		}

		saving = true;
		formError = '';

		const payload = {
			user: auth.user.id,
			title: taskForm.title.trim(),
			description: taskForm.description.trim(),
			due_date: `${taskForm.dueDate}T12:00:00.000Z`,
			tag: taskForm.tagId || null
		};

		try {
			if (editingTaskId) {
				await pb.collection('tasks').update(editingTaskId, payload);
			} else {
				await pb.collection('tasks').create({ ...payload, completed: false });
			}
			selectedDate = taskForm.dueDate;
			showTaskModal = false;
			await loadAllData();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível salvar a tarefa.';
		} finally {
			saving = false;
		}
	}

	async function toggleTaskComplete(task: Task) {
		const newCompleted = !task.completed;
		task.completed = newCompleted;

		try {
			await pb.collection('tasks').update(task.id, {
				completed: newCompleted,
				completed_at: newCompleted ? new Date().toISOString() : null
			});
		} catch (error) {
			console.error(error);
			task.completed = !newCompleted;
		}
	}

	async function deleteTask() {
		if (!editingTaskId || !confirm('Excluir esta tarefa?')) return;
		saving = true;
		try {
			await pb.collection('tasks').delete(editingTaskId);
			showTaskModal = false;
			await loadAllData();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível excluir a tarefa.';
		} finally {
			saving = false;
		}
	}

	// Gestão de Tags
	function openTagManager() {
		editingTagId = null;
		tagForm = { name: '', color: '#3B82F6' };
		formError = '';
		showTagManagerModal = true;
	}

	function selectTagForEdit(tag: Tag) {
		editingTagId = tag.id;
		tagForm = { name: tag.name, color: tag.color };
	}

	function resetTagForm() {
		editingTagId = null;
		tagForm = { name: '', color: '#3B82F6' };
	}

	async function saveTag(event: SubmitEvent) {
		event.preventDefault();
		if (!auth.user) return;

		saving = true;
		formError = '';

		const payload = {
			user: auth.user.id,
			name: tagForm.name.trim(),
			color: tagForm.color.trim()
		};

		try {
			if (editingTagId) {
				await pb.collection('tags').update(editingTagId, payload);
			} else {
				await pb.collection('tags').create(payload);
			}
			resetTagForm();
			await loadAllData();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível salvar a tag.';
		} finally {
			saving = false;
		}
	}

	async function deleteTag(tagId: string) {
		if (!confirm('Excluir esta tag? As associações existentes serão removidas.')) return;
		saving = true;
		try {
			await pb.collection('tags').delete(tagId);
			if (editingTagId === tagId) resetTagForm();
			await loadAllData();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível excluir a tag.';
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		if (auth.isValid) loadAllData();
	});
</script>

<svelte:head>
	<title>EasyHabit — Agenda & Tarefas</title>
	<meta name="description" content="Agenda pessoal simples e moderna para organizar seus compromissos e tarefas." />
</svelte:head>

{#if !auth.isValid || !auth.user}
	<div class="auth-page">
		<section class="auth-story">
			<a class="brand brand-light" href="/" aria-label="EasyHabit, início">
				<span class="brand-mark">✓</span>
				<span>EasyHabit</span>
			</a>
			<div class="story-copy">
				<span class="eyebrow">SUA ROTINA, MAIS LEVE</span>
				<h1>Tempo para o que<br />realmente importa.</h1>
				<p>Organize compromissos, tarefas e categorias em um só lugar com extrema praticidade.</p>
			</div>
			<p class="story-footer">© {new Date().getFullYear()} EasyHabit</p>
		</section>

		<section class="auth-panel">
			<div class="auth-card">
				<div class="mobile-brand">
					<span class="brand-mark">✓</span><strong>EasyHabit</strong>
				</div>
				<p class="welcome">BEM-VINDO</p>
				<h2>
					{resetState !== 'none'
						? 'Recuperar acesso'
						: authTab === 'login'
						? 'Entre na sua agenda'
						: 'Crie sua conta'}
				</h2>
				<p class="auth-subtitle">
					{resetState !== 'none'
						? 'Redefina sua senha usando o código enviado no seu WhatsApp.'
						: authTab === 'login'
						? 'Seus compromissos e tarefas esperam por você.'
						: 'Comece a organizar seus dias em poucos instantes.'}
				</p>

				<!-- Abas Principais (Somente Entrar / Criar Conta) -->
				<div class="auth-tabs" role="tablist" aria-label="Acesso">
					<button class:active={authTab === 'login' && resetState === 'none'} onclick={() => switchTab('login')}>Entrar</button>
					<button class:active={authTab === 'register' && resetState === 'none'} onclick={() => switchTab('register')}>Criar conta</button>
				</div>

				<!-- FLUXO 1: Recuperação de Senha por WhatsApp (dentro de Entrar) -->
				{#if resetState === 'phone'}
					<form onsubmit={handleResetRequestOtp} class="auth-form">
						<label>Seu telefone / WhatsApp
							<input type="tel" bind:value={resetPhone} placeholder="(83) 99999-9999" autocomplete="tel" required />
							<small class="field-hint">Enviaremos um código no seu WhatsApp para redefinir a senha.</small>
						</label>

						{#if authError}<p class="form-message error" role="alert">{authError}</p>{/if}

						<button class="auth-submit whatsapp-btn" type="submit" disabled={authLoading}>
							{authLoading ? 'Enviando código...' : 'Enviar código no WhatsApp 💬'}
						</button>
						<button type="button" class="back-link" onclick={() => (resetState = 'none')}>← Voltar para o login</button>
					</form>

				{:else if resetState === 'code'}
					<form onsubmit={handleResetPassword} class="auth-form">
						<p class="step-info">
							Código enviado para <strong>{resetPhone}</strong>.
							<button type="button" class="link-btn" onclick={() => (resetState = 'phone')}>Alterar número</button>
						</p>

						<label>Código de 6 dígitos
							<input type="text" bind:value={resetOtp} placeholder="Ex.: 123456" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required />
						</label>

						<label>Nova Senha
							<input type="password" bind:value={resetNewPassword} placeholder="Mínimo de 8 caracteres" minlength="8" required />
						</label>

						{#if authSuccess}<p class="form-message success" role="status">{authSuccess}</p>{/if}
						{#if authError}<p class="form-message error" role="alert">{authError}</p>{/if}

						<button class="auth-submit" type="submit" disabled={authLoading}>
							{authLoading ? 'Redefinindo...' : 'Redefinir senha e Entrar'}
						</button>
						<button type="button" class="back-link" onclick={() => (resetState = 'none')}>← Voltar para o login</button>
					</form>

				<!-- FLUXO 2: Aba Entrar (Login Tradicional) -->
				{:else if authTab === 'login'}
					<form onsubmit={handleAuthLogin} class="auth-form">
						<label>E-mail, usuário ou telefone
							<input type="text" bind:value={email} placeholder="voce@email.com" autocomplete="username" required />
						</label>

						<label>Senha
							<div class="password-field">
								<input type={showPassword ? 'text' : 'password'} bind:value={password} placeholder="Sua senha de acesso" minlength="8" autocomplete="current-password" required />
								<button type="button" onclick={() => (showPassword = !showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? '◐' : '◉'}</button>
							</div>
						</label>

						<div class="forgot-wrapper">
							<button type="button" class="forgot-btn" onclick={() => (resetState = 'phone')}>Esqueceu a senha? Redefinir via WhatsApp 💬</button>
						</div>

						{#if authError}<p class="form-message error" role="alert">{authError}</p>{/if}

						<button class="auth-submit" type="submit" disabled={authLoading}>
							{authLoading ? 'Aguarde...' : 'Entrar na agenda'}
						</button>
					</form>

				<!-- FLUXO 3: Cadastro protegido via WhatsApp -->
				{:else if authTab === 'register'}
					{#if whatsappStep === 'phone'}
							<form onsubmit={handleRegisterWhatsAppRequest} class="auth-form">
								<label>Nome de usuário
									<input type="text" bind:value={whatsappUsername} placeholder="ex.: joao.silva" minlength="3" maxlength="30" pattern="[a-z0-9._\-]+" autocomplete="username" autocapitalize="none" required />
									<small class="field-hint">Use letras minúsculas, números, ponto, hífen ou sublinhado.</small>
								</label>

								<label>E-mail <span class="optional-label">(opcional)</span>
									<input type="email" bind:value={whatsappEmail} placeholder="voce@email.com" autocomplete="email" />
								</label>

								<label>Seu número / WhatsApp
									<input type="tel" bind:value={whatsappPhone} placeholder="(83) 99999-9999" autocomplete="tel" required />
									<small class="field-hint">Enviaremos um código de 6 dígitos no seu celular para criar a conta.</small>
								</label>

								<label>Senha
									<div class="password-field">
										<input type={showPassword ? 'text' : 'password'} bind:value={whatsappPassword} placeholder="Mínimo de 8 caracteres" minlength="8" autocomplete="new-password" required />
										<button type="button" onclick={() => (showPassword = !showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? '◐' : '◉'}</button>
									</div>
								</label>

								<label>Confirmar senha
									<input type={showPassword ? 'text' : 'password'} bind:value={whatsappPasswordConfirm} placeholder="Digite a senha novamente" minlength="8" autocomplete="new-password" required />
								</label>

								<label>Código de acesso
									<input type="password" bind:value={accessCode} placeholder="Digite o código de convite" autocomplete="off" required />
									<small class="field-hint">Necessário para solicitar o código de verificação no WhatsApp.</small>
								</label>

								{#if authError}<p class="form-message error" role="alert">{authError}</p>{/if}

								<button class="auth-submit whatsapp-btn" type="submit" disabled={authLoading}>
									{authLoading ? 'Enviando código...' : 'Criar conta via WhatsApp 💬'}
								</button>
							</form>
						{:else}
							<form onsubmit={handleRegisterWhatsAppVerify} class="auth-form">
								<p class="step-info">
									Código enviado para <strong>{whatsappPhone}</strong>.
									<button type="button" class="link-btn" onclick={() => (whatsappStep = 'phone')}>Alterar número</button>
								</p>

								<label>Código de 6 dígitos
									<input type="text" bind:value={whatsappOtp} placeholder="Ex.: 123456" maxlength="6" inputmode="numeric" autocomplete="one-time-code" required />
								</label>

								{#if authSuccess}<p class="form-message success" role="status">{authSuccess}</p>{/if}
								{#if authError}<p class="form-message error" role="alert">{authError}</p>{/if}

								<button class="auth-submit" type="submit" disabled={authLoading}>
									{authLoading ? 'Criando conta...' : 'Confirmar código e Entrar'}
								</button>
							</form>
					{/if}
				{/if}
			</div>
		</section>
	</div>
{:else}
	<div class="app-shell">
		<header class="topbar">
			<a class="brand" href="/" aria-label="EasyHabit, início"><span class="brand-mark">✓</span><span>EasyHabit</span></a>
			<div class="top-actions">
				<button class="tag-manager-btn" onclick={openTagManager} title="Gerenciar Tags">
					<span class="icon">🏷️</span> <span class="btn-label">Tags</span>
				</button>
				<div class="user-copy"><strong>{auth.user.name || 'Minha agenda'}</strong><small>{auth.user.email}</small></div>
				<span class="avatar">{(auth.user.name || auth.user.email || 'U').charAt(0).toUpperCase()}</span>
				<button class="logout-button" onclick={logout} title="Sair" aria-label="Sair da conta">→</button>
			</div>
		</header>

		<div class="workspace" class:list-view={agendaView === 'list'}>
			<!-- Calendário Principal -->
			<section class="calendar-panel">
				<div class="calendar-heading">
					<div>
						<span class="eyebrow dark">MINHA AGENDA</span>
						<h1>{agendaView === 'calendar' ? monthLabel : 'Lista completa'}</h1>
					</div>
					<div class="calendar-actions">
						{#if agendaView === 'calendar'}
							<button class="today-button" onclick={goToday}>Hoje</button>
							<div class="month-controls">
								<button onclick={() => changeMonth(-1)} aria-label="Mês anterior">‹</button>
								<button onclick={() => changeMonth(1)} aria-label="Próximo mês">›</button>
							</div>
						{/if}
						<button class="new-button" onclick={() => (showQuickCreateModal = true)}><span>+</span> Novo</button>
					</div>
				</div>

				<div class="agenda-toolbar">
					<div class="segmented-control" aria-label="Modo de visualização">
						<button class:active={agendaView === 'calendar'} onclick={() => (agendaView = 'calendar')}>Calendário</button>
						<button class:active={agendaView === 'list'} onclick={() => (agendaView = 'list')}>Lista</button>
					</div>
					<div class="segmented-control filter-control" aria-label="Filtrar agenda">
						<button class:active={agendaFilter === 'all'} onclick={() => (agendaFilter = 'all')}>Tudo</button>
						<button class:active={agendaFilter === 'appointments'} onclick={() => (agendaFilter = 'appointments')}>Compromissos</button>
						<button class:active={agendaFilter === 'tasks'} onclick={() => (agendaFilter = 'tasks')}>Tarefas</button>
					</div>
				</div>

				{#if agendaView === 'list'}
					<div class="list-range-controls">
						<strong>Período da listagem</strong>
						<label>De
							<input type="date" bind:value={listStartDate} max={listEndDate || undefined} />
						</label>
						<label>Até
							<input type="date" bind:value={listEndDate} min={listStartDate || undefined} />
						</label>
						<button class="clear-range-button" onclick={clearListRange} disabled={!listStartDate && !listEndDate}>Limpar período</button>
					</div>
				{/if}

				{#if pageError}<p class="page-alert" role="alert">{pageError}</p>{/if}

				{#if agendaView === 'calendar'}
				<div class="calendar" class:is-loading={loading}>
					<div class="weekdays">
						{#each weekDays as weekDay}<div>{weekDay}</div>{/each}
					</div>
					<div class="days-grid">
						{#each calendarDays as day (day.key)}
							{@const summary = getDaySummary(day.key)}
							{@const totalItems = summary.allDay.length + summary.timed.length + summary.tasks.length}
							<button
								class="day-cell"
								class:outside={!day.currentMonth}
								class:selected={day.key === selectedDate}
								class:today={day.key === dateKey(new Date())}
								onclick={() => selectDay(day.date)}
								ondblclick={() => openNewEvent(day.key)}
								aria-label={`${day.date.getDate()} de ${monthNames[day.date.getMonth()]}, ${totalItems} itens`}
							>
								<div class="day-cell-head">
									<span class="day-number">{day.date.getDate()}</span>
								</div>

								<div class="day-events">
									<!-- Eventos de dia inteiro / multi-dias -->
									{#each summary.allDay as app (app.id)}
										{@const tag = app.tag ? tagMap.get(app.tag) : null}
										<span
											class="mini-event all-day-chip"
											style="--chip-color: {tag ? tag.color : '#7555D9'}"
										>
											{app.title}
										</span>
									{/each}

									<!-- Compromissos com horário -->
									{#each summary.timed as app (app.id)}
										{@const tag = app.tag ? tagMap.get(app.tag) : null}
										<span class="mini-event">
											<i style="background: {tag ? tag.color : '#7555D9'}"></i>
											<span class="time-label">{formatTime(app.starts_at)}</span> {app.title}
										</span>
									{/each}

									<!-- Tarefas com vencimento nesta data -->
									{#each summary.tasks as task (task.id)}
										{@const tag = task.tag ? tagMap.get(task.tag) : null}
										<span class="mini-event task-chip" class:completed={task.completed}>
											<i style="background: {tag ? tag.color : '#7555D9'}"></i>
											<span class="mini-task-check">{task.completed ? '✓' : '□'}</span>
											{task.title}
										</span>
									{/each}
								</div>
							</button>
						{/each}
					</div>
				</div>
				{:else}
					<div class="agenda-list-view" class:is-loading={loading}>
						{#if listRangeInvalid}
							<div class="empty-state list-empty-state">
								<span>!</span>
								<h3>Intervalo inválido</h3>
								<p>A data inicial precisa ser anterior ou igual à data final.</p>
							</div>
						{:else if loading}
							<p class="empty-day">Carregando sua agenda...</p>
						{:else if chronologicalItems.length === 0}
							<div class="empty-state list-empty-state">
								<span>◌</span>
								<h3>Nenhum item encontrado</h3>
								<p>Não há compromissos ou tarefas para o filtro selecionado.</p>
								<button onclick={() => (showQuickCreateModal = true)}>+ Adicionar item</button>
							</div>
						{:else}
							<div class="agenda-list-head" aria-hidden="true">
								<span>Data</span><span></span><span>Item</span><span>Tipo</span>
							</div>
							<div class="agenda-list-items">
								{#each chronologicalItems as item (`${item.kind}-${item.kind === 'appointment' ? item.appointment.id : item.task.id}`)}
									{#if item.kind === 'appointment'}
										{@const app = item.appointment}
										{@const tag = app.tag ? tagMap.get(app.tag) : null}
										<div class="agenda-list-row">
											<span class="list-date">{formatListDate(app.starts_at)}<small>{app.all_day ? 'Dia inteiro' : `${formatTime(app.starts_at)} – ${formatTime(app.ends_at)}`}</small></span>
											<span class="list-kind-marker" style="background: {tag ? tag.color : '#7555D9'}"></span>
											<button class="list-item-main" onclick={() => openEditEvent(app)}>
												<strong>{app.title}</strong>
												{#if app.description}<small>{app.description}</small>{/if}
											</button>
											<span class="list-type">Compromisso</span>
										</div>
									{:else}
										{@const task = item.task}
										{@const tag = task.tag ? tagMap.get(task.tag) : null}
										<div class="agenda-list-row" class:completed={task.completed}>
											<span class="list-date">{formatListDate(task.due_date)}<small>Prazo</small></span>
											<button class="task-checkbox" onclick={() => toggleTaskComplete(task)} aria-label="Marcar como concluída">{task.completed ? '✓' : ''}</button>
											<button class="list-item-main" onclick={() => openEditTask(task)}>
												<strong>{task.title}</strong>
												{#if task.description}<small>{task.description}</small>{/if}
											</button>
											<span class="list-type" style="--type-color: {tag ? tag.color : '#7555D9'}">Tarefa</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Painel Lateral do Dia Selecionado -->
			{#if agendaView === 'calendar'}
			<aside class="day-panel">
				<div class="day-panel-head">
					<div><span class="eyebrow dark">DIA SELECIONADO</span><h2>{selectedDateLabel}</h2></div>
					<button onclick={() => (showQuickCreateModal = true)} aria-label="Criar novo item" title="Adicionar">+</button>
				</div>

				<div class="day-list">
					{#if loading}
						<p class="empty-day">Carregando sua rotina...</p>
					{:else if selectedAllDayAppointments.length === 0 && selectedTimedAppointments.length === 0 && selectedDayTasks.length === 0}
						<div class="empty-state">
							<span>◌</span>
							<h3>Um dia livre</h3>
							<p>Nenhum compromisso ou tarefa para esta data.</p>
							<button onclick={() => (showQuickCreateModal = true)}>+ Adicionar item</button>
						</div>
					{:else}
						<!-- Seção 1: Dia inteiro / Multi-dias -->
						{#if selectedAllDayAppointments.length > 0}
							<div class="section-group">
								<h3 class="section-title"><span>☀️</span> Dia inteiro</h3>
								<div class="group-items">
									{#each selectedAllDayAppointments as app (app.id)}
										{@const tag = app.tag ? tagMap.get(app.tag) : null}
										<button class="agenda-item all-day-item" onclick={() => openEditEvent(app)}>
											<span class="event-bar" style="background: {tag ? tag.color : '#7555D9'}"></span>
											<span class="event-copy">
												<div class="title-row">
													<strong>{app.title}</strong>
													{#if tag}
														<span class="tag-badge" style="background: {tag.color}1c; color: {tag.color}">
															{tag.name}
														</span>
													{/if}
												</div>
												{#if app.description}<small>{app.description}</small>{/if}
											</span>
											<span class="event-more">···</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Seção 2: Compromissos com horário -->
						{#if selectedTimedAppointments.length > 0}
							<div class="section-group">
								<h3 class="section-title"><span>⏰</span> Compromissos</h3>
								<div class="group-items">
									{#each selectedTimedAppointments as app (app.id)}
										{@const tag = app.tag ? tagMap.get(app.tag) : null}
										<button class="agenda-item" onclick={() => openEditEvent(app)}>
											<span class="event-bar" style="background: {tag ? tag.color : '#7555D9'}"></span>
											<span class="event-time">
												{formatTime(app.starts_at)}
												<small>{formatTime(app.ends_at)}</small>
											</span>
											<span class="event-copy">
												<div class="title-row">
													<strong>{app.title}</strong>
													{#if tag}
														<span class="tag-badge" style="background: {tag.color}1c; color: {tag.color}">
															{tag.name}
														</span>
													{/if}
												</div>
												{#if app.description}<small>{app.description}</small>{/if}
											</span>
											<span class="event-more">···</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Seção 3: Tarefas -->
						{#if selectedDayTasks.length > 0}
							<div class="section-group">
								<h3 class="section-title"><span>☑️</span> {selectedDate === dateKey(new Date()) ? 'Tarefas vencendo hoje' : 'Tarefas com vencimento nesta data'}</h3>
								<div class="group-items">
									{#each selectedDayTasks as task (task.id)}
										{@const tag = task.tag ? tagMap.get(task.tag) : null}
										<div class="task-item" class:completed={task.completed}>
											<button class="task-checkbox" onclick={() => toggleTaskComplete(task)} aria-label="Marcar como concluída">
												{task.completed ? '✓' : ''}
											</button>
											<div class="task-body" onclick={() => openEditTask(task)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openEditTask(task)} role="button" tabindex="0">
												<div class="title-row">
													<span class="task-title">{task.title}</span>
													{#if tag}
														<span class="tag-badge" style="background: {tag.color}1c; color: {tag.color}">
															{tag.name}
														</span>
													{/if}
												</div>
												{#if task.description}<small>{task.description}</small>{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}
				</div>

				<p class="day-tip">Dica: clique no + para adicionar compromissos ou tarefas rapidamente.</p>
			</aside>
			{/if}
		</div>

		<!-- Botão Flutuante (FAB) para Mobile -->
		<button class="fab-button" onclick={() => (showQuickCreateModal = true)} aria-label="Adicionar item">+</button>
	</div>
{/if}

<!-- Modal de Seleção Rápida (Criar Compromisso x Tarefa) -->
{#if showQuickCreateModal}
	<div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (showQuickCreateModal = false)}>
		<div class="modal quick-create-modal" role="dialog" aria-modal="true">
			<div class="modal-head">
				<h2>O que deseja criar?</h2>
				<button onclick={() => (showQuickCreateModal = false)}>×</button>
			</div>
			<div class="quick-options">
				<button class="quick-option-btn" onclick={() => openNewEvent()}>
					<span class="opt-icon">📅</span>
					<div>
						<strong>Compromisso / Evento</strong>
						<small>Reuniões, viagens, eventos com ou sem horário</small>
					</div>
				</button>
				<button class="quick-option-btn" onclick={() => openNewTask()}>
					<span class="opt-icon">☑️</span>
					<div>
						<strong>Tarefa</strong>
						<small>Entregas, lembretes e itens com data para concluir</small>
					</div>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de Compromisso -->
{#if showEventModal}
	<div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (showEventModal = false)}>
		<div class="modal" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div>
					<span class="eyebrow dark">{editingEventId ? 'EDITAR' : 'NOVO'}</span>
					<h2>{editingEventId ? 'Editar compromisso' : 'Novo compromisso'}</h2>
				</div>
				<button onclick={() => (showEventModal = false)}>×</button>
			</div>

			<form onsubmit={saveEvent}>
				<label>Título
					<input type="text" bind:value={eventForm.title} placeholder="Ex.: Reunião de alinhamento, viagem..." maxlength="140" required />
				</label>

				{#if tags.length > 0}
					<label>Tag / Categoria
						<select bind:value={eventForm.tagId}>
							<option value="">Sem tag</option>
							{#each tags as tag (tag.id)}
								<option value={tag.id}>{tag.name}</option>
							{/each}
						</select>
					</label>
				{/if}

				<div class="checkbox-row">
					<input type="checkbox" id="allDayToggle" bind:checked={eventForm.allDay} />
					<label for="allDayToggle">Evento de dia inteiro</label>
				</div>

				<div class="form-row">
					<label>Data Inicial
						<input type="date" bind:value={eventForm.startDate} required />
					</label>
					{#if !eventForm.allDay}
						<label>Hora Início
							<input type="time" bind:value={eventForm.startTime} required />
						</label>
					{/if}
				</div>

				<div class="form-row">
					<label>Data Término
						<input type="date" bind:value={eventForm.endDate} required />
					</label>
					{#if !eventForm.allDay}
						<label>Hora Término
							<input type="time" bind:value={eventForm.endTime} required />
						</label>
					{/if}
				</div>

				<label>Notas <span class="optional">opcional</span>
					<textarea bind:value={eventForm.description} placeholder="Adicione observações importantes..." maxlength="2000" rows="3"></textarea>
				</label>

				{#if formError}<p class="form-message error" role="alert">{formError}</p>{/if}

				<div class="modal-actions">
					{#if editingEventId}
						<button class="delete-button" type="button" onclick={deleteEvent} disabled={saving}>Excluir</button>
					{/if}
					<span></span>
					<button class="cancel-button" type="button" onclick={() => (showEventModal = false)}>Cancelar</button>
					<button class="save-button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar compromisso'}</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal de Tarefa -->
{#if showTaskModal}
	<div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (showTaskModal = false)}>
		<div class="modal" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div>
					<span class="eyebrow dark">{editingTaskId ? 'EDITAR' : 'NOVA'}</span>
					<h2>{editingTaskId ? 'Editar tarefa' : 'Nova tarefa'}</h2>
				</div>
				<button onclick={() => (showTaskModal = false)}>×</button>
			</div>

			<form onsubmit={saveTask}>
				<label>Título da tarefa
					<input type="text" bind:value={taskForm.title} placeholder="Ex.: Entregar relatório, comprar presente..." maxlength="140" required />
				</label>

				{#if tags.length > 0}
					<label>Tag / Categoria
						<select bind:value={taskForm.tagId}>
							<option value="">Sem tag</option>
							{#each tags as tag (tag.id)}
								<option value={tag.id}>{tag.name}</option>
							{/each}
						</select>
					</label>
				{/if}

				<label>Prazo final
					<input type="date" bind:value={taskForm.dueDate} required />
					<small class="field-hint">Toda tarefa precisa de uma data de vencimento.</small>
				</label>

				<label>Descrição <span class="optional">opcional</span>
					<textarea bind:value={taskForm.description} placeholder="Detalhes da tarefa..." maxlength="2000" rows="3"></textarea>
				</label>

				{#if formError}<p class="form-message error" role="alert">{formError}</p>{/if}

				<div class="modal-actions">
					{#if editingTaskId}
						<button class="delete-button" type="button" onclick={deleteTask} disabled={saving}>Excluir</button>
					{/if}
					<span></span>
					<button class="cancel-button" type="button" onclick={() => (showTaskModal = false)}>Cancelar</button>
					<button class="save-button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar tarefa'}</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal de Gerenciamento de Tags -->
{#if showTagManagerModal}
	<div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (showTagManagerModal = false)}>
		<div class="modal tag-manager-modal" role="dialog" aria-modal="true">
			<div class="modal-head">
				<div>
					<span class="eyebrow dark">CATEGORIAS</span>
					<h2>Gerenciar Tags</h2>
				</div>
				<button onclick={() => (showTagManagerModal = false)}>×</button>
			</div>

			<div class="tags-list">
				{#if tags.length === 0}
					<p class="empty-tags">Nenhuma tag cadastrada ainda.</p>
				{:else}
					{#each tags as tag (tag.id)}
						<div class="tag-row">
							<span class="tag-color-pill" style="background: {tag.color}"></span>
							<strong class="tag-name">{tag.name}</strong>
							<span class="tag-hex">{tag.color}</span>
							<button class="tag-edit-btn" onclick={() => selectTagForEdit(tag)}>Editar</button>
							<button class="tag-del-btn" onclick={() => deleteTag(tag.id)}>✕</button>
						</div>
					{/each}
				{/if}
			</div>

			<hr class="tag-divider" />

			<form onsubmit={saveTag} class="tag-form">
				<h3>{editingTagId ? 'Editar Tag' : 'Nova Tag'}</h3>
				<label>Nome da Tag
					<input type="text" bind:value={tagForm.name} placeholder="Ex.: Trabalho, Faculdade, Pessoal" maxlength="50" required />
				</label>

				<label>Cor (Color Picker ou HEX)
					<div class="color-picker-group">
						<input type="color" bind:value={tagForm.color} class="color-input-native" />
						<input type="text" bind:value={tagForm.color} placeholder="#3B82F6" maxlength="7" class="color-input-text" required />
					</div>
				</label>

				<div class="preset-colors">
					<small>Cores sugeridas:</small>
					<div class="preset-grid">
						{#each PRESET_TAG_COLORS as preset}
							<button
								type="button"
								class="preset-btn"
								style="background: {preset.hex}"
								title={preset.name}
								onclick={() => (tagForm.color = preset.hex)}
							></button>
						{/each}
					</div>
				</div>

				{#if formError}<p class="form-message error" role="alert">{formError}</p>{/if}

				<div class="modal-actions">
					{#if editingTagId}
						<button class="cancel-button" type="button" onclick={resetTagForm}>Cancelar edição</button>
					{/if}
					<span></span>
					<button class="save-button" type="submit" disabled={saving}>{saving ? 'Salvando...' : editingTagId ? 'Atualizar Tag' : 'Criar Tag'}</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	:global(:root) { color-scheme: light; --ink: #241b36; --muted: #776f83; --violet: #7555d9; --violet-dark: #5335aa; --line: #e9e4f0; --surface: #ffffff; }
	button { border: 0; cursor: pointer; }
	.brand { display: inline-flex; align-items: center; gap: .65rem; color: var(--ink); text-decoration: none; font-size: 1.08rem; font-weight: 760; letter-spacing: -.02em; }
	.brand-mark { display: grid; place-items: center; width: 2.05rem; height: 2.05rem; color: white; background: var(--violet); border-radius: .65rem; font-size: 1.05rem; box-shadow: 0 7px 18px rgba(117,85,217,.24); }
	.brand-light { color: white; }
	.brand-light .brand-mark { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.28); }
	.eyebrow { display: block; color: #b8a7ed; font-size: .68rem; font-weight: 800; letter-spacing: .16em; }
	.eyebrow.dark { color: var(--violet); }

	.auth-page { min-height: 100vh; display: grid; grid-template-columns: minmax(420px, 45%) 1fr; background: white; }
	.auth-story { position: relative; overflow: hidden; display: flex; flex-direction: column; padding: 3rem clamp(2.5rem, 5vw, 5.5rem); color: white; background: radial-gradient(circle at 80% 16%, rgba(178,153,255,.25), transparent 30%), linear-gradient(145deg, #3d267d 0%, #5f42b5 56%, #8062dc 100%); }
	.story-copy { position: relative; z-index: 1; margin: auto 0 2.3rem; max-width: 520px; }
	.story-copy h1 { margin: .85rem 0 1rem; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2.8rem, 4vw, 4.7rem); line-height: 1.02; letter-spacing: -.045em; font-weight: 500; }
	.story-copy p { max-width: 430px; margin: 0; color: #ded6f6; font-size: 1.02rem; line-height: 1.7; }
	.story-footer { position: relative; z-index: 1; margin: 1.6rem 0 0; color: rgba(255,255,255,.54); font-size: .68rem; }
	.auth-panel { display: grid; place-items: center; padding: 3rem 1.5rem; background: linear-gradient(140deg,#fff 0%,#fbfaff 100%); }
	.auth-card { width: min(420px,100%); }
	.mobile-brand { display: none; }
	.welcome { margin: 0 0 .65rem; color: var(--violet); font-size: .7rem; font-weight: 800; letter-spacing: .17em; }
	.auth-card h2 { margin: 0; color: var(--ink); font-family: Georgia, 'Times New Roman', serif; font-size: 2.25rem; font-weight: 500; letter-spacing: -.035em; }
	.auth-subtitle { margin: .75rem 0 2rem; color: var(--muted); line-height: 1.55; }
	.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; padding: .25rem; margin-bottom: 1.5rem; background: #f1eef7; border-radius: .75rem; }
	.auth-tabs button { padding: .68rem; color: #857d91; background: transparent; border-radius: .58rem; font-size: .84rem; font-weight: 700; }
	.auth-tabs button.active { color: var(--violet-dark); background: white; box-shadow: 0 3px 10px rgba(52,35,84,.08); }

	.auth-form, .modal form { display: grid; gap: 1rem; }
	.auth-form label, .modal label { display: grid; gap: .45rem; color: #51495e; font-size: .75rem; font-weight: 750; }
	.auth-form input, .modal input, .modal textarea, .modal select { width: 100%; min-width: 0; padding: .83rem .9rem; color: var(--ink); background: white; border: 1px solid #ddd7e7; border-radius: .68rem; outline: none; transition: border-color .2s, box-shadow .2s; }
	.auth-form input:focus, .modal input:focus, .modal textarea:focus, .modal select:focus { border-color: #9b80ed; box-shadow: 0 0 0 3px rgba(117,85,217,.11); }
	.password-field { position: relative; }
	.password-field input { padding-right: 3rem; }
	.password-field button { position: absolute; right: .5rem; top: .42rem; width: 2.15rem; height: 2.15rem; color: #8b8397; background: transparent; }
	.field-hint { color: #92899f; font-weight: 450; }
	.optional-label { color: #92899f; font-weight: 500; }
	.forgot-wrapper { text-align: right; margin-top: -.3rem; }
	.forgot-btn { background: transparent; color: var(--violet); font-size: .72rem; font-weight: 700; text-decoration: underline; padding: 0; }
	.back-link { display: inline-block; text-align: center; margin-top: .5rem; background: transparent; color: var(--muted); font-size: .74rem; font-weight: 650; }
	.step-info { margin: 0; font-size: .8rem; color: var(--muted); }
	.link-btn { background: transparent; color: var(--violet); text-decoration: underline; font-size: .75rem; font-weight: 700; padding: 0; margin-left: .3rem; }
	.form-message { margin: 0; padding: .7rem .8rem; border-radius: .55rem; font-size: .78rem; }
	.form-message.error, .page-alert { color: #a5364c; background: #fff0f3; border: 1px solid #f4ccd4; }
	.form-message.success { color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; }
	.auth-submit { margin-top: .25rem; padding: .9rem 1rem; color: white; background: linear-gradient(135deg,var(--violet),#6241c4); border-radius: .7rem; font-weight: 750; box-shadow: 0 10px 24px rgba(94,62,190,.22); }
	.auth-submit.whatsapp-btn { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 10px 24px rgba(16,185,129,.22); }
	.auth-submit:disabled, .save-button:disabled { opacity: .65; cursor: wait; }

	.app-shell { min-height: 100vh; background: #f8f7fb; position: relative; }
	.topbar { height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(1rem,4vw,3.5rem); background: white; border-bottom: 1px solid var(--line); }
	.top-actions { display: flex; align-items: center; gap: .75rem; }
	.tag-manager-btn { display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .85rem; color: var(--violet-dark); background: #f0ebff; border-radius: .6rem; font-size: .78rem; font-weight: 750; }
	.user-copy { display: grid; text-align: right; }
	.user-copy strong { font-size: .76rem; }
	.user-copy small { color: var(--muted); font-size: .65rem; }
	.avatar { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; color: var(--violet-dark); background: #eee9ff; border-radius: 50%; font-size: .8rem; font-weight: 800; }
	.logout-button { width: 2rem; height: 2rem; color: #8a8195; background: transparent; font-size: 1.25rem; transform: rotate(180deg); }

	.workspace { display: grid; grid-template-columns: minmax(0,1fr) 360px; min-height: calc(100vh - 72px); }
	.workspace.list-view { grid-template-columns: minmax(0, 1fr); }
	.calendar-panel { padding: 2.4rem clamp(1rem,3vw,3.5rem) 3rem; min-width: 0; }
	.calendar-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1.6rem; }
	.calendar-heading h1 { margin: .25rem 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 2rem; font-weight: 500; letter-spacing: -.025em; text-transform: capitalize; }
	.calendar-actions { display: flex; align-items: center; gap: .55rem; }
	.today-button, .month-controls button { height: 2.35rem; color: #625a6e; background: white; border: 1px solid #ded8e7; font-size: .76rem; font-weight: 700; }
	.today-button { padding: 0 .9rem; border-radius: .55rem; }
	.month-controls { display: flex; }
	.month-controls button { width: 2.2rem; font-size: 1.25rem; }
	.month-controls button:first-child { border-radius: .55rem 0 0 .55rem; }
	.month-controls button:last-child { margin-left: -1px; border-radius: 0 .55rem .55rem 0; }
	.new-button { height: 2.45rem; padding: 0 1rem; color: white; background: var(--violet); border-radius: .58rem; font-size: .76rem; font-weight: 750; box-shadow: 0 7px 16px rgba(117,85,217,.18); }
	.new-button span { margin-right: .3rem; font-size: 1.1rem; }
	.agenda-toolbar { display: flex; align-items: center; justify-content: space-between; gap: .8rem; margin: -0.6rem 0 1rem; }
	.segmented-control { display: inline-flex; padding: .2rem; background: #eeebf3; border-radius: .65rem; }
	.segmented-control button { min-height: 2rem; padding: .4rem .8rem; color: #716979; background: transparent; border-radius: .48rem; font-size: .7rem; font-weight: 750; }
	.segmented-control button.active { color: var(--violet-dark); background: white; box-shadow: 0 2px 7px rgba(62,45,88,.1); }
	.list-range-controls { display: flex; align-items: end; gap: .75rem; margin-bottom: 1rem; padding: .8rem 1rem; background: white; border: 1px solid var(--line); border-radius: .8rem; }
	.list-range-controls > strong { align-self: center; margin-right: auto; color: #51495e; font-size: .76rem; }
	.list-range-controls label { display: grid; gap: .3rem; color: #756d7e; font-size: .65rem; font-weight: 750; }
	.list-range-controls input { height: 2.25rem; min-width: 142px; padding: 0 .65rem; color: var(--ink); background: white; border: 1px solid #ddd7e7; border-radius: .55rem; outline: none; font: inherit; }
	.list-range-controls input:focus { border-color: #9b80ed; box-shadow: 0 0 0 3px rgba(117,85,217,.11); }
	.clear-range-button { height: 2.25rem; padding: 0 .75rem; color: var(--violet-dark); background: #f0ebff; border-radius: .55rem; font-size: .68rem; font-weight: 750; }
	.clear-range-button:disabled { color: #aaa3b3; background: #f4f2f6; cursor: default; }
	.page-alert { padding: .8rem; border-radius: .6rem; font-size: .8rem; }

	.calendar { overflow: hidden; background: white; border: 1px solid var(--line); border-radius: 1rem; box-shadow: 0 12px 36px rgba(50,34,76,.055); transition: opacity .2s; }
	.calendar.is-loading { opacity: .6; }
	.weekdays { display: grid; grid-template-columns: repeat(7,1fr); background: #faf9fc; border-bottom: 1px solid var(--line); }
	.weekdays div { padding: .78rem .65rem; color: #968da2; font-size: .61rem; font-weight: 800; letter-spacing: .1em; text-align: center; }
	.days-grid { display: grid; grid-template-columns: repeat(7,1fr); }
	.day-cell { position: relative; min-width: 0; min-height: 112px; padding: .65rem; color: var(--ink); background: white; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); text-align: left; }
	.day-cell:nth-child(7n) { border-right: 0; }
	.day-cell:nth-last-child(-n+7) { border-bottom: 0; }
	.day-cell:hover { background: #fbfaff; }
	.day-cell.selected { z-index: 1; background: #faf8ff; box-shadow: inset 0 0 0 2px #9b80ed; }
	.day-cell-head { display: flex; align-items: center; justify-content: space-between; }
	.day-number { display: grid; place-items: center; width: 1.65rem; height: 1.65rem; border-radius: 50%; font-size: .74rem; font-weight: 700; }
	.day-cell.today .day-number { color: white; background: var(--violet); }
	.day-cell.outside { color: #bbb4c2; background: #fcfbfd; }
	.day-events { display: grid; gap: .28rem; margin-top: .38rem; overflow: hidden; }

	.mini-event { display: flex; align-items: center; gap: .3rem; min-width: 0; padding: .24rem .35rem; overflow: hidden; border-radius: .35rem; font-size: .62rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; color: #374151; background: #f3f4f6; }
	.mini-event i { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; }
	.mini-event .time-label { color: #6b7280; font-weight: 700; font-size: .58rem; }
	.mini-event.all-day-chip { color: white; background: var(--chip-color, #7555D9); font-weight: 700; }
	.mini-event.task-chip { background: #f5f1ff; color: #4e3c77; }
	.mini-event.task-chip.completed { opacity: .6; text-decoration: line-through; }
	.mini-task-check { flex: 0 0 auto; font-size: .65rem; font-weight: 800; }

	.agenda-list-view { min-height: 420px; overflow: hidden; background: white; border: 1px solid var(--line); border-radius: 1rem; box-shadow: 0 12px 36px rgba(50,34,76,.055); transition: opacity .2s; }
	.agenda-list-view.is-loading { opacity: .6; }
	.agenda-list-head, .agenda-list-row { display: grid; grid-template-columns: 155px 28px minmax(0, 1fr) 105px; align-items: center; gap: .8rem; }
	.agenda-list-head { padding: .75rem 1rem; color: #968da2; background: #faf9fc; border-bottom: 1px solid var(--line); font-size: .62rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
	.agenda-list-items { display: grid; }
	.agenda-list-row { min-height: 72px; padding: .75rem 1rem; border-bottom: 1px solid var(--line); }
	.agenda-list-row:last-child { border-bottom: 0; }
	.agenda-list-row:hover { background: #fcfbfe; }
	.agenda-list-row.completed { background: #faf9fc; opacity: .72; }
	.list-date { display: grid; gap: .2rem; color: #3f3748; font-size: .72rem; font-weight: 750; text-transform: capitalize; }
	.list-date small { color: var(--muted); font-size: .64rem; font-weight: 550; text-transform: none; }
	.list-kind-marker { justify-self: center; width: .65rem; height: .65rem; border-radius: 50%; }
	.list-item-main { display: grid; min-width: 0; gap: .25rem; padding: .25rem 0; color: var(--ink); background: transparent; text-align: left; }
	.list-item-main strong { overflow: hidden; font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
	.list-item-main small { overflow: hidden; color: var(--muted); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
	.agenda-list-row.completed .list-item-main strong { color: #887f95; text-decoration: line-through; }
	.list-type { justify-self: end; padding: .25rem .5rem; color: #5f5670; background: #f1eef5; border-radius: 2rem; font-size: .62rem; font-weight: 750; }
	.list-type[style] { color: var(--type-color); background: color-mix(in srgb, var(--type-color) 12%, white); }
	.list-empty-state { padding: 5rem 1rem; }

	.day-panel { display: flex; flex-direction: column; padding: 2.5rem 1.7rem 1.3rem; background: white; border-left: 1px solid var(--line); }
	.day-panel-head { display: flex; justify-content: space-between; gap: .75rem; padding-bottom: 1.3rem; border-bottom: 1px solid var(--line); }
	.day-panel-head h2 { margin: .35rem 0 0; max-width: 230px; font-family: Georgia, 'Times New Roman', serif; font-size: 1.35rem; font-weight: 500; line-height: 1.2; text-transform: capitalize; }
	.day-panel-head button { flex: 0 0 auto; width: 2.15rem; height: 2.15rem; color: var(--violet); background: #f0ebff; border-radius: .58rem; font-size: 1.25rem; }
	.day-list { flex: 1; display: grid; align-content: start; gap: 1.2rem; padding: 1.2rem 0; }

	.section-group { display: grid; gap: .65rem; }
	.section-title { margin: 0; display: flex; align-items: center; gap: .4rem; font-size: .78rem; font-weight: 800; color: #524b61; text-transform: uppercase; letter-spacing: .05em; }
	.group-items { display: grid; gap: .55rem; }

	.agenda-item { display: grid; grid-template-columns: 4px 48px minmax(0,1fr) auto; align-items: start; gap: .65rem; width: 100%; padding: .85rem .6rem .85rem 0; color: var(--ink); background: white; border: 1px solid var(--line); border-radius: .7rem; text-align: left; }
	.agenda-item.all-day-item { grid-template-columns: 4px minmax(0,1fr) auto; padding-left: .6rem; }
	.agenda-item:hover { box-shadow: 0 7px 18px rgba(51,35,78,.08); transform: translateY(-1px); }
	.event-bar { align-self: stretch; margin: -.25rem 0; border-radius: 0 4px 4px 0; }
	.event-time { display: grid; padding-top: .05rem; font-size: .68rem; font-weight: 800; }.event-time small { margin-top: .12rem; color: #a39baa; font-size: .6rem; font-weight: 500; }
	.event-copy { display: grid; min-width: 0; gap: .25rem; }
	.title-row { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
	.title-row strong { overflow: hidden; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
	.event-copy small { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: .63rem; font-weight: 450; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
	.event-more { color: #ada5b5; font-weight: 800; letter-spacing: .08em; }

	.tag-badge { display: inline-flex; align-items: center; padding: .15rem .45rem; border-radius: 2rem; font-size: .62rem; font-weight: 750; white-space: nowrap; }

	.task-item { display: flex; align-items: flex-start; gap: .7rem; padding: .75rem .85rem; background: white; border: 1px solid var(--line); border-radius: .7rem; transition: background .15s; }
	.task-item.completed { background: #f9f8fc; opacity: .75; }
	.task-item.completed .task-title { text-decoration: line-through; color: #887f95; }
	.task-checkbox { flex: 0 0 auto; display: grid; place-items: center; width: 1.35rem; height: 1.35rem; margin-top: .1rem; color: white; background: white; border: 2px solid #cbd5e1; border-radius: .4rem; font-weight: 800; font-size: .8rem; }
	.task-item.completed .task-checkbox { background: #10b981; border-color: #10b981; }
	.task-body { flex: 1; min-width: 0; cursor: pointer; }
	.task-title { font-size: .78rem; font-weight: 650; color: var(--ink); }

	.empty-day { color: var(--muted); font-size: .8rem; }
	.empty-state { align-self: center; padding: 2rem .5rem; color: var(--muted); text-align: center; }
	.empty-state > span { display: grid; place-items: center; width: 3.2rem; height: 3.2rem; margin: 0 auto .9rem; color: var(--violet); background: #f0ebff; border-radius: 50%; font-size: 1.6rem; }
	.empty-state h3 { margin: 0; color: var(--ink); font-family: Georgia,serif; font-size: 1.1rem; font-weight: 500; }
	.empty-state p { margin: .45rem auto 1rem; max-width: 210px; font-size: .72rem; line-height: 1.5; }
	.empty-state button { padding: .62rem .85rem; color: var(--violet-dark); background: #f0ebff; border-radius: .5rem; font-size: .68rem; font-weight: 750; }
	.day-tip { margin: auto 0 0; color: #aaa2b2; font-size: .61rem; line-height: 1.45; text-align: center; }

	.fab-button { display: none; position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 15; width: 3.5rem; height: 3.5rem; color: white; background: var(--violet); border-radius: 50%; font-size: 2rem; font-weight: 300; box-shadow: 0 10px 25px rgba(117,85,217,.4); }

	/* Modais */
	.modal-backdrop { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(31,22,45,.48); backdrop-filter: blur(4px); }
	.modal { width: min(520px,100%); max-height: calc(100vh - 2rem); overflow-y: auto; padding: 1.6rem; background: white; border-radius: 1rem; box-shadow: 0 30px 80px rgba(30,18,48,.28); }
	.modal-head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.4rem; }
	.modal-head h2 { margin: .3rem 0 0; font-family: Georgia,serif; font-size: 1.65rem; font-weight: 500; }
	.modal-head > button { width: 2rem; height: 2rem; color: #817888; background: #f4f1f7; border-radius: .5rem; font-size: 1.25rem; }
	.checkbox-row { display: flex; align-items: center; gap: .55rem; font-size: .8rem; font-weight: 650; color: #374151; }
	.checkbox-row input[type="checkbox"] { width: 1.1rem; height: 1.1rem; accent-color: var(--violet); }
	.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
	.modal textarea { resize: vertical; }
	.optional { color: #9e96a6; font-weight: 450; }
	.modal-actions { display: flex; align-items: center; gap: .55rem; margin-top: .5rem; }.modal-actions > span { flex: 1; }
	.modal-actions button { padding: .72rem .9rem; border-radius: .55rem; font-size: .73rem; font-weight: 750; }
	.delete-button { color: #b23a52; background: #fff0f3; }.cancel-button { color: #665e70; background: #f2eff5; }.save-button { color: white; background: var(--violet); }

	/* Modal de Seleção Rápida */
	.quick-create-modal { width: min(420px, 100%); }
	.quick-options { display: grid; gap: .8rem; padding-top: .5rem; }
	.quick-option-btn { display: flex; align-items: center; gap: 1rem; padding: 1.1rem; background: #fdfcff; border: 1px solid var(--line); border-radius: .8rem; text-align: left; transition: border-color .15s, box-shadow .15s; }
	.quick-option-btn:hover { border-color: #9b80ed; box-shadow: 0 6px 16px rgba(117,85,217,.12); }
	.opt-icon { font-size: 1.8rem; }
	.quick-option-btn strong { display: block; font-size: .9rem; color: var(--ink); }
	.quick-option-btn small { color: var(--muted); font-size: .7rem; }

	/* Gerenciador de Tags */
	.tag-manager-modal { width: min(480px, 100%); }
	.tags-list { display: grid; gap: .5rem; max-height: 180px; overflow-y: auto; padding-right: .3rem; }
	.tag-row { display: flex; align-items: center; gap: .6rem; padding: .55rem .75rem; background: #f8f6fc; border-radius: .6rem; }
	.tag-color-pill { width: 1.1rem; height: 1.1rem; border-radius: 50%; flex: 0 0 auto; }
	.tag-name { flex: 1; font-size: .8rem; }
	.tag-hex { font-size: .7rem; color: #887f95; font-family: monospace; }
	.tag-edit-btn { padding: .25rem .5rem; background: #e5e0f0; border-radius: .4rem; font-size: .65rem; font-weight: 700; color: #433854; }
	.tag-del-btn { padding: .25rem .45rem; background: #fee2e2; color: #ef4444; border-radius: .4rem; font-size: .7rem; font-weight: 800; }
	.tag-divider { border: 0; border-top: 1px solid var(--line); margin: 1.2rem 0; }
	.tag-form h3 { margin: 0 0 .8rem; font-size: .95rem; }
	.color-picker-group { display: grid; grid-template-columns: 3rem minmax(0, 1fr); align-items: center; gap: .5rem; }
	.modal .color-input-native {
		width: 3rem;
		min-width: 3rem;
		height: 2.75rem;
		padding: .2rem;
		border: 1px solid #ddd7e7;
		border-radius: .68rem;
		cursor: pointer;
		background: white;
	}
	.modal .color-input-native::-webkit-color-swatch-wrapper { padding: 0; }
	.modal .color-input-native::-webkit-color-swatch { border: 0; border-radius: .45rem; }
	.modal .color-input-native::-moz-color-swatch { border: 0; border-radius: .45rem; }
	.modal .color-input-text { width: 100%; min-width: 0; }
	.preset-colors { display: grid; gap: .4rem; }
	.preset-colors small { font-size: .7rem; color: var(--muted); }
	.preset-grid { display: flex; gap: .45rem; flex-wrap: wrap; }
	.preset-btn { width: 1.8rem; height: 1.8rem; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,.15); }
	.empty-tags { font-size: .75rem; color: var(--muted); text-align: center; margin: .5rem 0; }

	@media (max-width: 1050px) {
		.workspace { grid-template-columns: 1fr; }
		.day-panel { border-top: 1px solid var(--line); border-left: 0; min-height: 360px; }
		.day-tip { display: none; }
	}
	@media (max-width: 780px) {
		.auth-page { grid-template-columns: 1fr; }
		.auth-story { display: none; }
		.auth-panel { min-height: 100vh; }
		.mobile-brand { display: flex; align-items: center; gap: .65rem; margin-bottom: 3rem; }
		.calendar-heading { align-items: start; flex-direction: column; }
		.calendar-actions { width: 100%; flex-wrap: wrap; }
		.agenda-toolbar { align-items: stretch; flex-direction: column; }
		.segmented-control { display: grid; grid-template-columns: repeat(2, 1fr); width: 100%; }
		.filter-control { grid-template-columns: repeat(3, 1fr); }
		.list-range-controls { align-items: stretch; flex-wrap: wrap; }
		.list-range-controls > strong { width: 100%; margin: 0 0 .15rem; }
		.list-range-controls label { flex: 1; }
		.list-range-controls input { width: 100%; min-width: 0; }
		.new-button { margin-left: auto; }
		.agenda-list-head { display: none; }
		.agenda-list-row { grid-template-columns: 105px 28px minmax(0, 1fr); gap: .6rem; }
		.list-type { display: none; }
		.day-cell { min-height: 86px; padding: .35rem; }
		.btn-label { display: none; }
		.fab-button { display: grid; place-items: center; }
	}
	@media (max-width: 520px) {
		.user-copy { display: none; }
		.calendar-panel { padding-inline: .6rem; }
		.calendar-heading { padding-inline: .4rem; }
		.new-button { width: 100%; order: 3; }
		.calendar-actions { display: grid; grid-template-columns: 1fr auto; }
		.day-cell { min-height: 68px; }
		.agenda-list-row { grid-template-columns: 82px 24px minmax(0, 1fr); padding-inline: .7rem; }
		.list-date { font-size: .64rem; }
		.list-range-controls label { flex-basis: calc(50% - .4rem); }
		.clear-range-button { width: 100%; }
		.day-events { display: flex; gap: 3px; flex-wrap: wrap; }
		.mini-event { width: 8px; height: 8px; border-radius: 50%; padding: 0; overflow: hidden; text-indent: -9999px; }
		.mini-event i, .mini-event .time-label { display: none; }
		.day-panel { padding-inline: 1rem; }
		.form-row { grid-template-columns: 1fr; }
		.modal-backdrop { padding: .5rem; align-items: flex-end; }
		.modal { border-radius: 1.2rem 1.2rem 0 0; max-height: 90vh; }
		.modal-actions { flex-wrap: wrap; }.modal-actions > span { display: none; }.modal-actions button { flex: 1; }.delete-button { flex-basis: 100% !important; }
	}
</style>
