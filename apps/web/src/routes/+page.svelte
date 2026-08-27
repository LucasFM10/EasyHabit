<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/pocketbase';
	import { auth } from '$lib/auth.svelte';

	interface Appointment {
		id: string;
		user: string;
		title: string;
		description: string;
		starts_at: string;
		ends_at: string;
		color: EventColor;
	}

	type EventColor = 'violet' | 'blue' | 'green' | 'amber' | 'rose';
	type AuthMode = 'login' | 'register';

	const monthNames = [
		'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
		'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
	];
	const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
	const colorOptions: { value: EventColor; label: string }[] = [
		{ value: 'violet', label: 'Violeta' },
		{ value: 'blue', label: 'Azul' },
		{ value: 'green', label: 'Verde' },
		{ value: 'amber', label: 'Amarelo' },
		{ value: 'rose', label: 'Rosa' }
	];

	let authMode = $state<AuthMode>('login');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let accessCode = $state('');
	let authLoading = $state(false);
	let authError = $state('');
	let showPassword = $state(false);

	let appointments = $state<Appointment[]>([]);
	let loading = $state(false);
	let pageError = $state('');
	let viewDate = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	let selectedDate = $state(dateKey(new Date()));
	let showEventModal = $state(false);
	let saving = $state(false);
	let editingId = $state<string | null>(null);
	let formError = $state('');
	let eventForm = $state({
		title: '',
		description: '',
		date: dateKey(new Date()),
		start: '09:00',
		end: '10:00',
		color: 'violet' as EventColor
	});

	let calendarDays = $derived(buildCalendar(viewDate));
	let selectedAppointments = $derived(
		appointments
			.filter((appointment) => dateKey(new Date(appointment.starts_at)) === selectedDate)
			.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
	);
	let monthLabel = $derived(`${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`);
	let selectedDateLabel = $derived(formatLongDate(selectedDate));

	function dateKey(date: Date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
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

	function formatTime(value: string) {
		return new Intl.DateTimeFormat('pt-BR', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(new Date(value));
	}

	function eventsFor(key: string) {
		return appointments
			.filter((appointment) => dateKey(new Date(appointment.starts_at)) === key)
			.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
	}

	async function handleAuth(event: SubmitEvent) {
		event.preventDefault();
		authError = '';
		authLoading = true;

		try {
			if (authMode === 'register') {
				await auth.register(name, email, password, accessCode);
			} else {
				await auth.login(email, password);
			}
			password = '';
			accessCode = '';
			await loadAppointments();
		} catch (error: any) {
			if (authMode === 'register') {
				authError = 'Não foi possível criar a conta. Confira os dados e tente novamente.';
			} else {
				authError = 'E-mail ou senha incorretos.';
			}
		} finally {
			authLoading = false;
		}
	}

	function switchAuthMode(mode: AuthMode) {
		authMode = mode;
		authError = '';
		password = '';
	}

	async function loadAppointments() {
		if (!auth.isValid || !auth.user) return;
		loading = true;
		pageError = '';
		try {
			appointments = await pb.collection('appointments').getFullList<Appointment>({
				sort: 'starts_at'
			});
		} catch (error) {
			console.error(error);
			pageError = 'Não foi possível carregar sua agenda. Tente atualizar a página.';
		} finally {
			loading = false;
		}
	}

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

	function openNewEvent(date = selectedDate) {
		editingId = null;
		formError = '';
		eventForm = {
			title: '',
			description: '',
			date,
			start: '09:00',
			end: '10:00',
			color: 'violet'
		};
		showEventModal = true;
	}

	function openEditEvent(appointment: Appointment) {
		const starts = new Date(appointment.starts_at);
		const ends = new Date(appointment.ends_at);
		editingId = appointment.id;
		formError = '';
		eventForm = {
			title: appointment.title,
			description: appointment.description || '',
			date: dateKey(starts),
			start: `${String(starts.getHours()).padStart(2, '0')}:${String(starts.getMinutes()).padStart(2, '0')}`,
			end: `${String(ends.getHours()).padStart(2, '0')}:${String(ends.getMinutes()).padStart(2, '0')}`,
			color: appointment.color || 'violet'
		};
		showEventModal = true;
	}

	function closeModal() {
		if (saving) return;
		showEventModal = false;
		formError = '';
	}

	async function saveEvent(event: SubmitEvent) {
		event.preventDefault();
		if (!auth.user) return;

		const startsAt = new Date(`${eventForm.date}T${eventForm.start}:00`);
		const endsAt = new Date(`${eventForm.date}T${eventForm.end}:00`);
		if (endsAt <= startsAt) {
			formError = 'O horário de término deve ser depois do início.';
			return;
		}

		saving = true;
		formError = '';
		const payload = {
			user: auth.user.id,
			title: eventForm.title.trim(),
			description: eventForm.description.trim(),
			starts_at: startsAt.toISOString(),
			ends_at: endsAt.toISOString(),
			color: eventForm.color
		};

		try {
			if (editingId) {
				await pb.collection('appointments').update(editingId, payload);
			} else {
				await pb.collection('appointments').create(payload);
			}
			selectedDate = eventForm.date;
			viewDate = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
			showEventModal = false;
			await loadAppointments();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível salvar o compromisso.';
		} finally {
			saving = false;
		}
	}

	async function deleteEvent() {
		if (!editingId || !confirm('Excluir este compromisso?')) return;
		saving = true;
		try {
			await pb.collection('appointments').delete(editingId);
			showEventModal = false;
			await loadAppointments();
		} catch (error) {
			console.error(error);
			formError = 'Não foi possível excluir o compromisso.';
		} finally {
			saving = false;
		}
	}

	function logout() {
		auth.logout();
		appointments = [];
		email = '';
		authMode = 'login';
	}

	onMount(() => {
		if (auth.isValid) loadAppointments();
	});
</script>

<svelte:head>
	<title>EasyHabit — Sua agenda, no seu ritmo</title>
	<meta name="description" content="Uma agenda pessoal simples para organizar seus compromissos." />
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
				<p>Organize seus compromissos com clareza e tenha uma visão tranquila dos seus dias.</p>
			</div>
			<div class="week-preview" aria-hidden="true">
				<div class="preview-title"><span>Esta semana</span><strong>12 — 18 Ago</strong></div>
				<div class="preview-grid">
					{#each ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as day, index}
						<div class:active-preview={index === 2}>
							<small>{day}</small><span>{12 + index}</span>
						</div>
					{/each}
				</div>
				<div class="preview-event"><i></i><div><strong>Planejamento semanal</strong><small>09:30 — 10:15</small></div></div>
			</div>
			<p class="story-footer">© {new Date().getFullYear()} EasyHabit</p>
		</section>

		<section class="auth-panel">
			<div class="auth-card">
				<div class="mobile-brand">
					<span class="brand-mark">✓</span><strong>EasyHabit</strong>
				</div>
				<p class="welcome">BEM-VINDO</p>
				<h2>{authMode === 'login' ? 'Entre na sua agenda' : 'Crie sua conta'}</h2>
				<p class="auth-subtitle">
					{authMode === 'login' ? 'Seus compromissos estão esperando por você.' : 'Comece a organizar seus dias em poucos instantes.'}
				</p>

				<div class="auth-tabs" role="tablist" aria-label="Acesso">
					<button class:active={authMode === 'login'} onclick={() => switchAuthMode('login')}>Entrar</button>
					<button class:active={authMode === 'register'} onclick={() => switchAuthMode('register')}>Criar conta</button>
				</div>

				<form onsubmit={handleAuth} class="auth-form">
					{#if authMode === 'register'}
						<label>Seu nome
							<input type="text" bind:value={name} placeholder="Como podemos chamar você?" maxlength="80" autocomplete="name" required />
						</label>
					{/if}
					<label>E-mail
						<input type="email" bind:value={email} placeholder="voce@email.com" autocomplete="email" required />
					</label>
					<label>Senha
						<div class="password-field">
							<input type={showPassword ? 'text' : 'password'} bind:value={password} placeholder="Mínimo de 8 caracteres" minlength="8" autocomplete={authMode === 'login' ? 'current-password' : 'new-password'} required />
							<button type="button" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? '◐' : '◉'}</button>
						</div>
					</label>
					{#if authMode === 'register'}
						<label>Código de acesso
							<input type="text" bind:value={accessCode} placeholder="Digite o código de convite" autocomplete="off" required />
							<small class="field-hint">O cadastro está disponível apenas para convidados.</small>
						</label>
					{/if}

					{#if authError}<p class="form-message error" role="alert">{authError}</p>{/if}
					<button class="auth-submit" type="submit" disabled={authLoading}>
						{authLoading ? 'Aguarde...' : authMode === 'login' ? 'Entrar na agenda' : 'Criar minha conta'}
					</button>
				</form>
			</div>
		</section>
	</div>
{:else}
	<div class="app-shell">
		<header class="topbar">
			<a class="brand" href="/" aria-label="EasyHabit, início"><span class="brand-mark">✓</span><span>EasyHabit</span></a>
			<div class="top-actions">
				<div class="user-copy"><strong>{auth.user.name || 'Minha agenda'}</strong><small>{auth.user.email}</small></div>
				<span class="avatar">{(auth.user.name || auth.user.email || 'U').charAt(0).toUpperCase()}</span>
				<button class="logout-button" onclick={logout} title="Sair" aria-label="Sair da conta">→</button>
			</div>
		</header>

		<div class="workspace">
			<section class="calendar-panel">
				<div class="calendar-heading">
					<div><span class="eyebrow dark">MINHA AGENDA</span><h1>{monthLabel}</h1></div>
					<div class="calendar-actions">
						<button class="today-button" onclick={goToday}>Hoje</button>
						<div class="month-controls">
							<button onclick={() => changeMonth(-1)} aria-label="Mês anterior">‹</button>
							<button onclick={() => changeMonth(1)} aria-label="Próximo mês">›</button>
						</div>
						<button class="new-button" onclick={() => openNewEvent()}><span>+</span> Novo compromisso</button>
					</div>
				</div>

				{#if pageError}<p class="page-alert" role="alert">{pageError}</p>{/if}

				<div class="calendar" class:is-loading={loading}>
					<div class="weekdays">
						{#each weekDays as weekDay}<div>{weekDay}</div>{/each}
					</div>
					<div class="days-grid">
						{#each calendarDays as day (day.key)}
							{@const dayEvents = eventsFor(day.key)}
							<button
								class="day-cell"
								class:outside={!day.currentMonth}
								class:selected={day.key === selectedDate}
								class:today={day.key === dateKey(new Date())}
								onclick={() => selectDay(day.date)}
								ondblclick={() => openNewEvent(day.key)}
								aria-label={`${day.date.getDate()} de ${monthNames[day.date.getMonth()]}, ${dayEvents.length} compromissos`}
							>
								<span class="day-number">{day.date.getDate()}</span>
								<div class="day-events">
									{#each dayEvents.slice(0, 2) as appointment (appointment.id)}
										<span class="mini-event {appointment.color}"><i></i>{formatTime(appointment.starts_at)} {appointment.title}</span>
									{/each}
									{#if dayEvents.length > 2}<small>+{dayEvents.length - 2} mais</small>{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			</section>

			<aside class="day-panel">
				<div class="day-panel-head">
					<div><span class="eyebrow dark">DIA SELECIONADO</span><h2>{selectedDateLabel}</h2></div>
					<button onclick={() => openNewEvent()} aria-label="Adicionar compromisso">+</button>
				</div>
				<div class="day-list">
					{#if loading}
						<p class="empty-day">Carregando sua agenda...</p>
					{:else if selectedAppointments.length === 0}
						<div class="empty-state"><span>◌</span><h3>Um dia livre</h3><p>Nenhum compromisso marcado para esta data.</p><button onclick={() => openNewEvent()}>Adicionar compromisso</button></div>
					{:else}
						{#each selectedAppointments as appointment (appointment.id)}
							<button class="agenda-item" onclick={() => openEditEvent(appointment)}>
								<span class="event-bar {appointment.color}"></span>
								<span class="event-time">{formatTime(appointment.starts_at)}<small>{formatTime(appointment.ends_at)}</small></span>
								<span class="event-copy"><strong>{appointment.title}</strong>{#if appointment.description}<small>{appointment.description}</small>{/if}</span>
								<span class="event-more">···</span>
							</button>
						{/each}
					{/if}
				</div>
				<p class="day-tip">Dica: clique duas vezes em um dia para adicionar rapidamente.</p>
			</aside>
		</div>
	</div>
{/if}

{#if showEventModal}
	<div class="modal-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && closeModal()} onkeydown={(event) => event.key === 'Escape' && closeModal()}>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
			<div class="modal-head"><div><span class="eyebrow dark">{editingId ? 'EDITAR' : 'NOVO'}</span><h2 id="modal-title">{editingId ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button onclick={closeModal} aria-label="Fechar">×</button></div>
			<form onsubmit={saveEvent}>
				<label>Título<input type="text" bind:value={eventForm.title} placeholder="Ex.: Consulta, reunião, academia..." maxlength="140" required /></label>
				<div class="form-row">
					<label>Data<input type="date" bind:value={eventForm.date} required /></label>
					<label>Início<input type="time" bind:value={eventForm.start} required /></label>
					<label>Término<input type="time" bind:value={eventForm.end} required /></label>
				</div>
				<label>Cor<select bind:value={eventForm.color}>{#each colorOptions as option}<option value={option.value}>{option.label}</option>{/each}</select></label>
				<label>Notas <span class="optional">opcional</span><textarea bind:value={eventForm.description} placeholder="Adicione informações importantes..." maxlength="2000" rows="4"></textarea></label>
				{#if formError}<p class="form-message error" role="alert">{formError}</p>{/if}
				<div class="modal-actions">
					{#if editingId}<button class="delete-button" type="button" onclick={deleteEvent} disabled={saving}>Excluir</button>{/if}
					<span></span><button class="cancel-button" type="button" onclick={closeModal}>Cancelar</button><button class="save-button" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar compromisso'}</button>
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
	.auth-story::before, .auth-story::after { content: ''; position: absolute; border: 1px solid rgba(255,255,255,.11); border-radius: 50%; width: 440px; height: 440px; right: -280px; top: 23%; }
	.auth-story::after { width: 620px; height: 620px; right: -360px; top: 15%; }
	.story-copy { position: relative; z-index: 1; margin: auto 0 2.3rem; max-width: 520px; }
	.story-copy h1 { margin: .85rem 0 1rem; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2.8rem, 4vw, 4.7rem); line-height: 1.02; letter-spacing: -.045em; font-weight: 500; }
	.story-copy p { max-width: 430px; margin: 0; color: #ded6f6; font-size: 1.02rem; line-height: 1.7; }
	.week-preview { position: relative; z-index: 1; width: min(470px, 100%); padding: 1.2rem 1.3rem; background: rgba(255,255,255,.11); border: 1px solid rgba(255,255,255,.16); border-radius: 1.2rem; box-shadow: 0 22px 45px rgba(38,20,84,.22); backdrop-filter: blur(12px); }
	.preview-title { display: flex; justify-content: space-between; color: #eee9fb; font-size: .78rem; }
	.preview-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: .25rem; margin: .85rem 0; text-align: center; }
	.preview-grid div { display: grid; gap: .28rem; place-items: center; padding: .4rem 0; border-radius: .65rem; }
	.preview-grid small { color: #c8bae9; font-size: .59rem; }
	.preview-grid span { font-size: .82rem; font-weight: 700; }
	.preview-grid .active-preview { background: white; color: var(--violet-dark); }
	.preview-grid .active-preview small { color: var(--violet); }
	.preview-event { display: flex; align-items: center; gap: .7rem; margin-top: .4rem; padding: .75rem; background: rgba(255,255,255,.1); border-radius: .75rem; }
	.preview-event i { width: 3px; height: 2rem; background: #d8ccff; border-radius: 3px; }
	.preview-event div { display: grid; gap: .15rem; }
	.preview-event strong { font-size: .78rem; }
	.preview-event small { color: #cec2eb; font-size: .68rem; }
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
	.form-message { margin: 0; padding: .7rem .8rem; border-radius: .55rem; font-size: .78rem; }
	.form-message.error, .page-alert { color: #a5364c; background: #fff0f3; border: 1px solid #f4ccd4; }
	.auth-submit { margin-top: .25rem; padding: .9rem 1rem; color: white; background: linear-gradient(135deg,var(--violet),#6241c4); border-radius: .7rem; font-weight: 750; box-shadow: 0 10px 24px rgba(94,62,190,.22); }
	.auth-submit:disabled, .save-button:disabled { opacity: .65; cursor: wait; }

	.app-shell { min-height: 100vh; background: #f8f7fb; }
	.topbar { height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(1rem,4vw,3.5rem); background: white; border-bottom: 1px solid var(--line); }
	.top-actions { display: flex; align-items: center; gap: .75rem; }
	.user-copy { display: grid; text-align: right; }
	.user-copy strong { font-size: .76rem; }
	.user-copy small { color: var(--muted); font-size: .65rem; }
	.avatar { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; color: var(--violet-dark); background: #eee9ff; border-radius: 50%; font-size: .8rem; font-weight: 800; }
	.logout-button { width: 2rem; height: 2rem; color: #8a8195; background: transparent; font-size: 1.25rem; transform: rotate(180deg); }
	.workspace { display: grid; grid-template-columns: minmax(0,1fr) 340px; min-height: calc(100vh - 72px); }
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
	.day-number { display: grid; place-items: center; width: 1.65rem; height: 1.65rem; border-radius: 50%; font-size: .74rem; font-weight: 700; }
	.day-cell.today .day-number { color: white; background: var(--violet); }
	.day-cell.outside { color: #bbb4c2; background: #fcfbfd; }
	.day-events { display: grid; gap: .28rem; margin-top: .38rem; overflow: hidden; }
	.mini-event { display: flex; align-items: center; gap: .3rem; min-width: 0; padding: .28rem .35rem; overflow: hidden; border-radius: .35rem; font-size: .58rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
	.mini-event i { flex: 0 0 auto; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
	.mini-event.violet { color: #6443bd; background: #eee8ff; }.mini-event.blue { color: #3472a9; background: #e6f3ff; }.mini-event.green { color: #33775e; background: #e4f5ed; }.mini-event.amber { color: #9b6924; background: #fff2d9; }.mini-event.rose { color: #a74761; background: #ffe7ed; }
	.day-events > small { padding-left: .25rem; color: #8e8499; font-size: .56rem; }
	.day-panel { display: flex; flex-direction: column; padding: 2.5rem 1.7rem 1.3rem; background: white; border-left: 1px solid var(--line); }
	.day-panel-head { display: flex; justify-content: space-between; gap: .75rem; padding-bottom: 1.3rem; border-bottom: 1px solid var(--line); }
	.day-panel-head h2 { margin: .35rem 0 0; max-width: 230px; font-family: Georgia, 'Times New Roman', serif; font-size: 1.35rem; font-weight: 500; line-height: 1.2; text-transform: capitalize; }
	.day-panel-head button { flex: 0 0 auto; width: 2.15rem; height: 2.15rem; color: var(--violet); background: #f0ebff; border-radius: .58rem; font-size: 1.25rem; }
	.day-list { flex: 1; display: grid; align-content: start; gap: .65rem; padding: 1.2rem 0; }
	.agenda-item { display: grid; grid-template-columns: 4px 48px minmax(0,1fr) auto; align-items: start; gap: .65rem; width: 100%; padding: .9rem .6rem .9rem 0; color: var(--ink); background: white; border: 1px solid var(--line); border-radius: .7rem; text-align: left; }
	.agenda-item:hover { box-shadow: 0 7px 18px rgba(51,35,78,.08); transform: translateY(-1px); }
	.event-bar { align-self: stretch; margin: -.25rem 0; border-radius: 0 4px 4px 0; background: var(--violet); }.event-bar.blue{background:#5b9bd1}.event-bar.green{background:#62a789}.event-bar.amber{background:#daa74d}.event-bar.rose{background:#d66b85}
	.event-time { display: grid; padding-top: .05rem; font-size: .68rem; font-weight: 800; }.event-time small { margin-top: .12rem; color: #a39baa; font-size: .6rem; font-weight: 500; }
	.event-copy { display: grid; min-width: 0; gap: .25rem; }.event-copy strong { overflow: hidden; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }.event-copy small { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: .63rem; font-weight: 450; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
	.event-more { color: #ada5b5; font-weight: 800; letter-spacing: .08em; }
	.empty-day { color: var(--muted); font-size: .8rem; }
	.empty-state { align-self: center; padding: 2rem .5rem; color: var(--muted); text-align: center; }
	.empty-state > span { display: grid; place-items: center; width: 3.2rem; height: 3.2rem; margin: 0 auto .9rem; color: var(--violet); background: #f0ebff; border-radius: 50%; font-size: 1.6rem; }
	.empty-state h3 { margin: 0; color: var(--ink); font-family: Georgia,serif; font-size: 1.1rem; font-weight: 500; }.empty-state p { margin: .45rem auto 1rem; max-width: 210px; font-size: .72rem; line-height: 1.5; }.empty-state button { padding: .62rem .85rem; color: var(--violet-dark); background: #f0ebff; border-radius: .5rem; font-size: .68rem; font-weight: 750; }
	.day-tip { margin: auto 0 0; color: #aaa2b2; font-size: .61rem; line-height: 1.45; text-align: center; }

	.modal-backdrop { position: fixed; z-index: 20; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(31,22,45,.48); backdrop-filter: blur(4px); }
	.modal { width: min(520px,100%); max-height: calc(100vh - 2rem); overflow-y: auto; padding: 1.6rem; background: white; border-radius: 1rem; box-shadow: 0 30px 80px rgba(30,18,48,.28); }
	.modal-head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.4rem; }
	.modal-head h2 { margin: .3rem 0 0; font-family: Georgia,serif; font-size: 1.65rem; font-weight: 500; }
	.modal-head > button { width: 2rem; height: 2rem; color: #817888; background: #f4f1f7; border-radius: .5rem; font-size: 1.25rem; }
	.form-row { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: .75rem; }
	.modal textarea { resize: vertical; }
	.optional { color: #9e96a6; font-weight: 450; }
	.modal-actions { display: flex; align-items: center; gap: .55rem; margin-top: .5rem; }.modal-actions > span { flex: 1; }
	.modal-actions button { padding: .72rem .9rem; border-radius: .55rem; font-size: .73rem; font-weight: 750; }
	.delete-button { color: #b23a52; background: #fff0f3; }.cancel-button { color: #665e70; background: #f2eff5; }.save-button { color: white; background: var(--violet); }

	@media (max-width: 1050px) {
		.workspace { grid-template-columns: 1fr; }
		.day-panel { border-top: 1px solid var(--line); border-left: 0; min-height: 360px; }
		.day-list { grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); }
		.day-tip { display: none; }
	}
	@media (max-width: 780px) {
		.auth-page { grid-template-columns: 1fr; }
		.auth-story { display: none; }
		.auth-panel { min-height: 100vh; }
		.mobile-brand { display: flex; align-items: center; gap: .65rem; margin-bottom: 3rem; }
		.calendar-heading { align-items: start; flex-direction: column; }
		.calendar-actions { width: 100%; flex-wrap: wrap; }
		.new-button { margin-left: auto; }
		.day-cell { min-height: 86px; padding: .35rem; }
		.mini-event { padding: .22rem; font-size: 0; }
		.mini-event i { width: 6px; height: 6px; }
	}
	@media (max-width: 520px) {
		.user-copy { display: none; }
		.calendar-panel { padding-inline: .6rem; }
		.calendar-heading { padding-inline: .4rem; }
		.new-button { width: 100%; order: 3; }
		.calendar-actions { display: grid; grid-template-columns: 1fr auto; }
		.day-cell { min-height: 68px; }
		.day-events { display: flex; gap: 3px; flex-wrap: wrap; }
		.mini-event { width: 8px; height: 8px; border-radius: 50%; }
		.mini-event i { display: none; }
		.day-events > small { display: none; }
		.day-panel { padding-inline: 1rem; }
		.form-row { grid-template-columns: 1fr 1fr; }
		.form-row label:first-child { grid-column: 1/-1; }
		.modal-actions { flex-wrap: wrap; }.modal-actions > span { display: none; }.modal-actions button { flex: 1; }.delete-button { flex-basis: 100% !important; }
	}
</style>
