<svelte:head>
	<title>{data.draft ? 'Edit Draft' : 'Compose'} - C!mail</title>
</svelte:head>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Sidebar, Header } from '$lib';

	let { data } = $props();

	let draftId = $state<string | null>(null);
	let fromAccount = $state<'me' | 'noreply'>('me');
	let toRecipients = $state<string[]>([]);
	let ccRecipients = $state<string[]>([]);
	let bccRecipients = $state<string[]>([]);
	let toInput = $state('');
	let ccInput = $state('');
	let bccInput = $state('');
	let showCc = $state(false);
	let showBcc = $state(false);
	let subject = $state('');
	let trackOpens = $state(true);
	let sending = $state(false);
	let status = $state<string | null>(null);
	let fileInput: HTMLInputElement | null = $state(null);
	let attachments = $state<{ filename: string; contentType: string; contentBase64: string }[]>([]);
	let bodyEditor: HTMLDivElement | null = $state(null);
	let bodyInitialized = $state(false);
	let draftLoaded = $state(false);

	// Load draft data if present
	$effect(() => {
		if (data.draft && !draftLoaded) {
			draftId = data.draft.id;
			fromAccount = data.draft.account === 'noreply' ? 'noreply' : 'me';
			toRecipients = Array.isArray(data.draft.to_emails) ? data.draft.to_emails : [];
			ccRecipients = Array.isArray(data.draft.cc_emails) ? data.draft.cc_emails : [];
			bccRecipients = Array.isArray(data.draft.bcc_emails) ? data.draft.bcc_emails : [];
			subject = data.draft.subject ?? '';
			if (data.draft.attachments) {
				attachments = data.draft.attachments;
			}
			if (ccRecipients.length > 0) showCc = true;
			if (bccRecipients.length > 0) showBcc = true;
			draftLoaded = true;
		}
	});

	// Initialize body from draft or URL params
	$effect(() => {
		if (bodyEditor && !bodyInitialized) {
			if (data.draft?.body_html) {
				bodyEditor.innerHTML = data.draft.body_html;
				bodyInitialized = true;
			} else {
				const urlBody = $page.url.searchParams.get('body');
				if (urlBody) {
					bodyEditor.innerHTML = urlBody;
					bodyInitialized = true;
				}
			}
		}
	});

	// Initialize subject from URL params (only if no draft)
	$effect(() => {
		if (!data.draft) {
			const urlSubject = $page.url.searchParams.get('subject');
			if (urlSubject && !subject) {
				subject = urlSubject;
			}
		}
	});

	const isValidEmail = (email: string): boolean => {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
	};

	const addRecipient = (type: 'to' | 'cc' | 'bcc') => {
		let input = type === 'to' ? toInput : type === 'cc' ? ccInput : bccInput;
		const emails = input.split(/[,;\s]+/).map(e => e.trim()).filter(e => e);
		
		for (const email of emails) {
			if (!isValidEmail(email)) continue;
			
			if (type === 'to' && !toRecipients.includes(email)) {
				toRecipients = [...toRecipients, email];
			} else if (type === 'cc' && !ccRecipients.includes(email)) {
				ccRecipients = [...ccRecipients, email];
			} else if (type === 'bcc' && !bccRecipients.includes(email)) {
				bccRecipients = [...bccRecipients, email];
			}
		}
		
		if (type === 'to') toInput = '';
		else if (type === 'cc') ccInput = '';
		else bccInput = '';
	};

	const handleRecipientKeydown = (e: KeyboardEvent, type: 'to' | 'cc' | 'bcc') => {
		if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
			e.preventDefault();
			addRecipient(type);
		} else if (e.key === 'Backspace') {
			const input = type === 'to' ? toInput : type === 'cc' ? ccInput : bccInput;
			if (!input) {
				if (type === 'to' && toRecipients.length > 0) {
					toRecipients = toRecipients.slice(0, -1);
				} else if (type === 'cc' && ccRecipients.length > 0) {
					ccRecipients = ccRecipients.slice(0, -1);
				} else if (type === 'bcc' && bccRecipients.length > 0) {
					bccRecipients = bccRecipients.slice(0, -1);
				}
			}
		}
	};

	const removeRecipient = (type: 'to' | 'cc' | 'bcc', email: string) => {
		if (type === 'to') {
			toRecipients = toRecipients.filter(e => e !== email);
		} else if (type === 'cc') {
			ccRecipients = ccRecipients.filter(e => e !== email);
		} else {
			bccRecipients = bccRecipients.filter(e => e !== email);
		}
	};

	const execCommand = (command: string, value?: string) => {
		document.execCommand(command, false, value);
		bodyEditor?.focus();
	};

	const saveToDrafts = async () => {
		const bodyHtml = getBodyHtml();
		const hasContent = toRecipients.length > 0 || subject || bodyHtml || attachments.length > 0;
		if (!hasContent) {
			goto('/inbox');
			return;
		}
		
		status = 'Saving draft...';
		try {
			const res = await fetch('/api/drafts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id: draftId, // Include draft ID if editing existing draft
					fromAccount,
					to: toRecipients.join(', '),
					cc: ccRecipients.join(', '),
					bcc: bccRecipients.join(', '),
					subject,
					html: bodyHtml ? `<div>${bodyHtml}</div>` : '<div></div>',
					attachments
				})
			});
			
			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: 'Failed to save draft' }));
				status = err.error ?? 'Failed to save draft';
				return;
			}
			
			goto('/drafts');
		} catch (e) {
			status = e instanceof Error ? e.message : 'Failed to save draft';
		}
	};

	const getBodyHtml = (): string => {
		return bodyEditor?.innerHTML ?? '';
	};

	const sendNow = async () => {
		status = null;
		
		// Add any pending input as recipients
		if (toInput.trim()) addRecipient('to');
		if (ccInput.trim()) addRecipient('cc');
		if (bccInput.trim()) addRecipient('bcc');
		
		if (toRecipients.length === 0) {
			status = 'Please enter at least one recipient.';
			return;
		}
		if (!subject.trim()) {
			status = 'Please enter a subject.';
			return;
		}
		if (sending) return;
		sending = true;
		try {
			const html = getBodyHtml();
			const res = await fetch('/api/send', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					fromAccount,
					to: toRecipients.join(', '),
					cc: ccRecipients.join(', '),
					bcc: bccRecipients.join(', '),
					subject,
					html: html ? `<div>${html}</div>` : '<div></div>',
					trackOpens,
					attachments
				})
			});
			if (!res.ok) {
				status = await res.text().catch(() => 'Send failed');
				return;
			}
			
			// Delete draft after successful send
			if (draftId) {
				await fetch('/api/drafts', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ id: draftId })
				}).catch(() => {}); // Ignore delete errors
			}
			
			status = 'Sent successfully!';
			setTimeout(() => goto('/sent'), 1500);
		} catch (e) {
			status = e instanceof Error ? e.message : 'Send failed';
		} finally {
			sending = false;
		}
	};

	const discard = async () => {
		const hasContent = toRecipients.length > 0 || subject || getBodyHtml() || attachments.length > 0;
		if (hasContent || draftId) {
			if (!confirm('Discard this draft?')) return;
		}
		
		// Delete the draft from database if it exists
		if (draftId) {
			await fetch('/api/drafts', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id: draftId })
			}).catch(() => {}); // Ignore delete errors
		}
		
		goto('/inbox');
	};

	const pickFile = () => {
		fileInput?.click();
	};

	const fileChanged = async (e: Event) => {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.onload = () => resolve(String(reader.result));
			reader.readAsDataURL(file);
		});

		const comma = dataUrl.indexOf(',');
		attachments = [...attachments, {
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			contentBase64: comma >= 0 ? dataUrl.slice(comma + 1) : ''
		}];
		
		input.value = '';
	};

	const removeAttachment = (index: number) => {
		attachments = attachments.filter((_, i) => i !== index);
	};

	const formatFileSize = (base64: string) => {
		const bytes = Math.ceil(base64.length * 0.75);
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};
</script>

<div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display h-screen flex overflow-hidden selection:bg-primary/30">
	<!-- Sidebar -->
	<div class="hidden md:flex">
		<Sidebar
			meAddress={data.meAddress}
			noreplyAddress={data.noreplyAddress}
			activePage="compose"
			showAccountFilter={false}
		/>
	</div>

	<!-- Main Content Area -->
	<main class="flex-1 flex flex-col h-full relative overflow-hidden">
		<header class="md:hidden h-16 border-b border-border-dark flex items-center px-4 bg-surface-dark">
			<a href="/inbox" class="text-white p-2">
				<span class="material-symbols-outlined">arrow_back</span>
			</a>
			<span class="ml-4 font-bold text-lg">Compose</span>
		</header>

		<div class="flex-1 overflow-hidden p-4 md:p-8 flex justify-center bg-background-light dark:bg-background-dark">
			<div class="w-full max-w-5xl flex flex-col h-full max-h-[900px] bg-white dark:bg-[#151921] rounded-xl shadow-2xl border border-gray-200 dark:border-border-dark overflow-hidden">
				<!-- Header -->
				<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-border-dark bg-gray-50 dark:bg-surface-dark shrink-0">
					<h1 class="text-lg font-bold text-gray-900 dark:text-white">New Message</h1>
					<button class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-[#282e39] transition-colors" type="button" onclick={saveToDrafts} title="Close (saves as draft)">
						<span class="material-symbols-outlined text-[20px]">close</span>
					</button>
				</div>

				{#if status}
					<div class={`px-6 py-3 text-sm border-b border-gray-100 dark:border-border-dark shrink-0 ${status === 'Sent successfully!' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300'}`}>
						{#if status === 'Sent successfully!'}
							<span class="material-symbols-outlined text-[18px] mr-2 align-middle">check_circle</span>
						{/if}
						{status}
					</div>
				{/if}

				<!-- Form fields -->
				<div class="px-6 py-4 space-y-4 bg-white dark:bg-surface-dark shrink-0">
					<div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
						<label class="text-sm font-medium text-gray-500 dark:text-gray-400 w-16 pt-2 md:pt-0" for="compose-from">From</label>
						<div class="relative flex-1">
							<select bind:value={fromAccount} id="compose-from" class="w-full bg-gray-50 dark:bg-[#101622] border border-gray-200 dark:border-border-dark rounded-lg py-2.5 px-4 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer">
								<option value="me">{data.meAddress}</option>
								<option value="noreply">{data.noreplyAddress}</option>
							</select>
							<div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
								<span class="material-symbols-outlined text-[20px]">arrow_drop_down</span>
							</div>
						</div>
					</div>

					<!-- To Recipients -->
					<div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
						<label class="text-sm font-medium text-gray-500 dark:text-gray-400 w-16 pt-3" for="compose-to">To</label>
						<div class="flex-1 flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-[#101622] border border-gray-200 dark:border-border-dark rounded-lg min-h-[46px] focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
							{#each toRecipients as email}
								<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300 text-sm">
									{email}
									<button type="button" class="hover:text-red-500 transition-colors" onclick={() => removeRecipient('to', email)}>
										<span class="material-symbols-outlined text-[16px]">close</span>
									</button>
								</span>
							{/each}
							<input 
								bind:value={toInput} 
								id="compose-to" 
								class="bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-500 min-w-[120px] p-1 flex-1" 
								placeholder={toRecipients.length === 0 ? "Add recipients (press Enter or comma to add)" : ""}
								type="email"
								onkeydown={(e) => handleRecipientKeydown(e, 'to')}
								onblur={() => addRecipient('to')}
							/>
						</div>
						<div class="hidden md:flex gap-2 pt-2">
							<button class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary" type="button" onclick={() => (showCc = !showCc)}>Cc</button>
							<button class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary" type="button" onclick={() => (showBcc = !showBcc)}>Bcc</button>
						</div>
					</div>

					<!-- Cc Recipients -->
					{#if showCc}
						<div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
							<label class="text-sm font-medium text-gray-500 dark:text-gray-400 w-16 pt-3" for="compose-cc">Cc</label>
							<div class="flex-1 flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-[#101622] border border-gray-200 dark:border-border-dark rounded-lg min-h-[46px] focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
								{#each ccRecipients as email}
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300 text-sm">
										{email}
										<button type="button" class="hover:text-red-500 transition-colors" onclick={() => removeRecipient('cc', email)}>
											<span class="material-symbols-outlined text-[16px]">close</span>
										</button>
									</span>
								{/each}
								<input 
									bind:value={ccInput} 
									id="compose-cc" 
									class="bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-500 min-w-[120px] p-1 flex-1" 
									placeholder={ccRecipients.length === 0 ? "Cc recipients" : ""}
									type="email"
									onkeydown={(e) => handleRecipientKeydown(e, 'cc')}
									onblur={() => addRecipient('cc')}
								/>
							</div>
						</div>
					{/if}

					<!-- Bcc Recipients -->
					{#if showBcc}
						<div class="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
							<label class="text-sm font-medium text-gray-500 dark:text-gray-400 w-16 pt-3" for="compose-bcc">Bcc</label>
							<div class="flex-1 flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-[#101622] border border-gray-200 dark:border-border-dark rounded-lg min-h-[46px] focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
								{#each bccRecipients as email}
									<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300 text-sm">
										{email}
										<button type="button" class="hover:text-red-500 transition-colors" onclick={() => removeRecipient('bcc', email)}>
											<span class="material-symbols-outlined text-[16px]">close</span>
										</button>
									</span>
								{/each}
								<input 
									bind:value={bccInput} 
									id="compose-bcc" 
									class="bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-500 min-w-[120px] p-1 flex-1" 
									placeholder={bccRecipients.length === 0 ? "Bcc recipients" : ""}
									type="email"
									onkeydown={(e) => handleRecipientKeydown(e, 'bcc')}
									onblur={() => addRecipient('bcc')}
								/>
							</div>
						</div>
					{/if}

					<div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
						<label class="text-sm font-medium text-gray-500 dark:text-gray-400 w-16 pt-2 md:pt-0" for="compose-subject">Subject</label>
						<input bind:value={subject} id="compose-subject" class="flex-1 bg-transparent border-0 border-b border-gray-200 dark:border-border-dark px-0 py-2 text-lg font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 focus:border-primary transition-colors" placeholder="What is this about?" type="text" />
					</div>
				</div>

				<!-- Formatting toolbar -->
				<div class="px-6 py-2 border-y border-gray-100 dark:border-border-dark bg-gray-50 dark:bg-[#181b23] flex items-center gap-1 overflow-x-auto shrink-0">
					<button class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Bold" type="button" onclick={() => execCommand('bold')}>
						<span class="material-symbols-outlined text-[20px]">format_bold</span>
					</button>
					<button class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Italic" type="button" onclick={() => execCommand('italic')}>
						<span class="material-symbols-outlined text-[20px]">format_italic</span>
					</button>
					<button class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Underline" type="button" onclick={() => execCommand('underline')}>
						<span class="material-symbols-outlined text-[20px]">format_underlined</span>
					</button>
					<div class="w-px h-5 bg-gray-300 dark:bg-border-dark mx-1"></div>
					<button class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Bullet List" type="button" onclick={() => execCommand('insertUnorderedList')}>
						<span class="material-symbols-outlined text-[20px]">format_list_bulleted</span>
					</button>
					<button class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Numbered List" type="button" onclick={() => execCommand('insertOrderedList')}>
						<span class="material-symbols-outlined text-[20px]">format_list_numbered</span>
					</button>
					<div class="w-px h-5 bg-gray-300 dark:bg-border-dark mx-1"></div>
					<button class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Remove Formatting" type="button" onclick={() => execCommand('removeFormat')}>
						<span class="material-symbols-outlined text-[20px]">format_clear</span>
					</button>
				</div>

				<!-- Message body - Rich Text Editor -->
				<div class="flex-1 px-6 py-4 bg-white dark:bg-surface-dark overflow-y-auto min-h-0">
					<div
						bind:this={bodyEditor}
						contenteditable="true"
						class="w-full min-h-[200px] bg-transparent text-base text-gray-800 dark:text-gray-200 leading-relaxed focus:outline-none prose prose-sm dark:prose-invert max-w-none"
						data-placeholder="Write your message…"
						role="textbox"
						aria-multiline="true"
					></div>
				</div>

				<!-- Attachments section - always visible above footer -->
				{#if attachments.length > 0}
					<div class="px-6 py-3 border-t border-gray-100 dark:border-border-dark bg-gray-50 dark:bg-[#181b23] shrink-0">
						<div class="flex items-center gap-2 mb-2">
							<span class="material-symbols-outlined text-[18px] text-gray-500">attach_file</span>
							<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Attachments ({attachments.length})</span>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each attachments as att, i}
								<div class="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-border-dark px-3 py-2 bg-white dark:bg-[#151921]">
									<span class="material-symbols-outlined text-[18px] text-gray-500">description</span>
									<div class="min-w-0">
										<div class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">{att.filename}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(att.contentBase64)}</div>
									</div>
									<button class="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-500 hover:text-red-500 transition-colors" type="button" onclick={() => removeAttachment(i)} title="Remove">
										<span class="material-symbols-outlined text-[18px]">close</span>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Footer with actions -->
				<div class="px-6 py-4 border-t border-gray-100 dark:border-border-dark bg-gray-50 dark:bg-surface-dark flex flex-wrap items-center justify-between gap-4 shrink-0">
					<div class="flex items-center gap-2">
						<input bind:this={fileInput} class="hidden" type="file" onchange={fileChanged} />
						<button class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" title="Attach File" type="button" onclick={pickFile}>
							<span class="material-symbols-outlined">attach_file</span>
						</button>
						<button class="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Discard Draft" type="button" onclick={discard}>
							<span class="material-symbols-outlined">delete</span>
						</button>
					</div>

					<div class="flex items-center gap-4">
						<div class="flex items-center gap-3 bg-white dark:bg-[#151921] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-border-dark shadow-sm">
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Track Opens</span>
							<label class="relative inline-flex items-center select-none cursor-pointer">
								<input bind:checked={trackOpens} id="tracking-toggle" type="checkbox" class="sr-only peer" />
								<div class="w-10 h-5 rounded-full bg-gray-300 peer-checked:bg-primary transition-colors"></div>
								<div class="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
							</label>
						</div>

						<button 
							class="bg-primary hover:bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed" 
							type="button" 
							disabled={sending} 
							onclick={sendNow}
						>
							{#if sending}
								<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
								<span>Sending...</span>
							{:else}
								<span>Send</span>
								<span class="material-symbols-outlined text-[18px]">send</span>
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	</main>
</div>
