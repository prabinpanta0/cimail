<svelte:head>
	<title>{data.subject ?? 'Thread'} - C!mail</title>
</svelte:head>

<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Sidebar, Header } from '$lib';

	let { data } = $props();
	let replyText = $state('');
	let sending = $state(false);
	let showReplyBox = $state(false);
	let actionLoading = $state<string | null>(null);
	let expandedDetails = $state<Set<number>>(new Set());
	let replyFileInput: HTMLInputElement | null = $state(null);
	let replyAttachments = $state<{ filename: string; contentType: string; contentBase64: string }[]>([]);

	// Get back URL and active page from fromFolder
	const getBackUrl = () => `/${data.fromFolder ?? 'inbox'}`;
	const getActivePage = (): 'inbox' | 'sent' | 'starred' | 'drafts' | 'trash' | 'compose' | 'thread' | 'archive' => {
		const folder = data.fromFolder ?? 'inbox';
		if (['inbox', 'sent', 'starred', 'drafts', 'trash', 'archive'].includes(folder)) {
			return folder as any;
		}
		return 'inbox';
	};

	const formatDate = (value: string | null) => {
		if (!value) return '';
		const dt = new Date(value);
		if (Number.isNaN(dt.getTime())) return '';
		const now = new Date();
		const diffMs = now.getTime() - dt.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const dayName = dayNames[dt.getDay()];
		const monthName = monthNames[dt.getMonth()];
		const day = dt.getDate();
		const year = dt.getFullYear();
		const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
		
		let ago = '';
		if (diffHours < 1) {
			const diffMins = Math.floor(diffMs / (1000 * 60));
			ago = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
		} else if (diffHours < 24) {
			ago = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
		} else {
			const diffDays = Math.floor(diffHours / 24);
			ago = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
		}
		
		return `${dayName} ${day} ${monthName} ${year}, ${time} (${ago})`;
	};

	const formatFullDate = (value: string | null) => {
		if (!value) return '';
		const dt = new Date(value);
		if (Number.isNaN(dt.getTime())) return '';
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${dt.getDate()} ${monthNames[dt.getMonth()]} ${dt.getFullYear()}, ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
	};

	const formatAttachmentSize = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	const getSenderName = (email: string | null | undefined) => {
		if (!email) return 'Unknown';
		const match = email.match(/^([^<]+)</);
		if (match) return match[1].trim();
		return email.split('@')[0];
	};

	const parseRecipients = (value: any): string[] => {
		if (!value) return [];
		if (typeof value === 'string') {
			try {
				return JSON.parse(value);
			} catch {
				return value.split(',').map((s: string) => s.trim()).filter(Boolean);
			}
		}
		if (Array.isArray(value)) return value;
		return [];
	};

	const goToPrev = () => {
		if (data.prevThreadId) {
			goto(`/thread/${data.prevThreadId}`);
		}
	};

	const goToNext = () => {
		if (data.nextThreadId) {
			goto(`/thread/${data.nextThreadId}`);
		}
	};

	const performAction = async (action: string, messageId?: string) => {
		const id = messageId ?? data.messages?.[0]?.gmail_message_id;
		if (!id || actionLoading) return;
		
		actionLoading = action;
		try {
			const res = await fetch('/api/actions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, messageId: id })
			});
			
			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: 'Action failed' }));
				alert(err.error ?? 'Action failed');
				return;
			}
			
			if (action === 'trash' || action === 'delete' || action === 'archive') {
				goto(getBackUrl());
			} else {
				await invalidateAll();
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Action failed');
		} finally {
			actionLoading = null;
		}
	};

	// Perform action on all messages in thread
	const performThreadAction = async (action: string) => {
		if (actionLoading) return;
		actionLoading = action;
		
		try {
			for (const m of data.messages ?? []) {
				if (!m.gmail_message_id) continue;
				await fetch('/api/actions', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ action, messageId: m.gmail_message_id })
				});
			}
			await invalidateAll();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Action failed');
		} finally {
			actionLoading = null;
		}
	};

	const isStarred = () => {
		return (data.messages ?? []).some((m: any) => m.is_starred);
	};

	const isUnread = () => {
		return (data.messages ?? []).some((m: any) => !m.is_read);
	};

	const toggleStar = () => {
		performAction(isStarred() ? 'unstar' : 'star');
	};

	const toggleRead = () => {
		performThreadAction(isUnread() ? 'markRead' : 'markUnread');
	};

	const toggleDetails = (index: number) => {
		const next = new Set(expandedDetails);
		if (next.has(index)) {
			next.delete(index);
		} else {
			next.add(index);
		}
		expandedDetails = next;
	};

	const printThread = () => {
		window.print();
	};

	const getLabels = (m: any): string[] => {
		const labels = m.label_ids ?? [];
		const hidden = ['SENT', 'UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_PROMOTIONS', 'CATEGORY_FORUMS'];
		return labels.filter((l: string) => !hidden.includes(l));
	};

	const getLabelColor = (label: string): string => {
		const colors: Record<string, string> = {
			'INBOX': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
			'STARRED': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
			'IMPORTANT': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
			'DRAFT': 'bg-gray-100 dark:bg-gray-700/30 text-gray-800 dark:text-gray-200',
			'TRASH': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
		};
		return colors[label] ?? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
	};

	const getTrackingStatus = (m: any): { seen: boolean; openCount: number; firstOpenedAt: string | null } => {
		if (m.direction !== 'outbound') return { seen: false, openCount: 0, firstOpenedAt: null };
		const tracking = data.trackingInfo?.[m.id];
		if (!tracking) return { seen: false, openCount: 0, firstOpenedAt: null };
		return {
			seen: tracking.openCount > 0,
			openCount: tracking.openCount,
			firstOpenedAt: tracking.firstOpenedAt
		};
	};

	const formatTrackingTime = (dateStr: string | null): string => {
		if (!dateStr) return '';
		const dt = new Date(dateStr);
		if (Number.isNaN(dt.getTime())) return '';
		return dt.toLocaleString('en-US', { 
			month: 'short', 
			day: 'numeric', 
			hour: '2-digit', 
			minute: '2-digit',
			hour12: false 
		});
	};

	const sendReply = async () => {
		if (!replyText.trim() || sending) return;
		sending = true;
		
		try {
			// Get the last message in thread to reply to
			const lastMsg = data.messages?.[data.messages.length - 1];
			if (!lastMsg) {
				alert('No message to reply to');
				sending = false;
				return;
			}
			
			// Determine who to reply to
			const replyTo = lastMsg.direction === 'outbound'
				? parseRecipients(lastMsg.to_emails)[0] ?? ''
				: lastMsg.from_email ?? '';
			
			if (!replyTo) {
				alert('Could not determine reply address');
				sending = false;
				return;
			}
			
			// Build reply subject
			const subject = lastMsg.subject?.startsWith('Re:') 
				? lastMsg.subject 
				: `Re: ${lastMsg.subject ?? ''}`;
			
			// Build reply HTML with quoted content
			const quotedContent = lastMsg.body_html ?? lastMsg.body_text ?? lastMsg.snippet ?? '';
			const html = `
<div>${replyText.replace(/\n/g, '<br>')}</div>
<br><br>
<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 0; color: #666;">
On ${formatFullDate(lastMsg.internal_date)}, ${getSenderName(lastMsg.from_email)} wrote:<br><br>
${quotedContent}
</div>
`.trim();
			
			const res = await fetch('/api/send', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					fromAccount: 'me',
					to: replyTo,
					subject,
					html,
					threadId: data.threadId,
					inReplyTo: lastMsg.gmail_message_id,
					attachments: replyAttachments.length > 0 ? replyAttachments : undefined
				})
			});
			
			if (!res.ok) {
				const err = await res.text();
				alert(`Failed to send reply: ${err}`);
				return;
			}
			
			// Clear reply box and reload
			replyText = '';
			replyAttachments = [];
			showReplyBox = false;
			await invalidateAll();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to send reply');
		} finally {
			sending = false;
		}
	};

	const pickReplyAttachment = () => {
		replyFileInput?.click();
	};

	const replyFileChanged = async (e: Event) => {
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
		replyAttachments = [...replyAttachments, {
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			contentBase64: comma >= 0 ? dataUrl.slice(comma + 1) : ''
		}];
		
		input.value = '';
	};

	const removeReplyAttachment = (index: number) => {
		replyAttachments = replyAttachments.filter((_, i) => i !== index);
	};

	const handleForward = () => {
		const lastMsg = data.messages?.[data.messages.length - 1];
		if (!lastMsg) return;
		
		const fwdSubject = lastMsg.subject?.startsWith('Fwd:') ? lastMsg.subject : `Fwd: ${lastMsg.subject ?? ''}`;
		
		// Build forwarded message content
		const fromEmail = lastMsg.from_email ?? 'Unknown';
		const toEmails = parseRecipients(lastMsg.to_emails).join(', ') || 'Unknown';
		const dateStr = formatFullDate(lastMsg.internal_date);
		const origSubject = lastMsg.subject ?? '(no subject)';
		const origBody = lastMsg.body_html ?? lastMsg.body_text ?? lastMsg.snippet ?? '';
		
		const forwardedContent = `
<br><br>
---------- Forwarded message ---------<br>
From: ${fromEmail}<br>
Date: ${dateStr}<br>
Subject: ${origSubject}<br>
To: ${toEmails}<br>
<br>
${origBody}
`.trim();
		
		const params = new URLSearchParams();
		params.set('subject', fwdSubject);
		params.set('body', forwardedContent);
		goto(`/compose?${params.toString()}`);
	};
</script>

<div class="bg-white dark:bg-background-dark text-gray-900 dark:text-white overflow-hidden h-screen flex flex-col font-display">
	<Header 
		searchPlaceholder="Search mail"
		activePage="thread"
		meAddress={data.meAddress}
		noreplyAddress={data.noreplyAddress}
	/>

	<div class="flex flex-1 overflow-hidden">
		<!-- Sidebar -->
		<div class="hidden md:flex">
			<Sidebar
				meAddress={data.meAddress}
				noreplyAddress={data.noreplyAddress}
				activePage={getActivePage()}
				showAccountFilter={false}
			/>
		</div>

		<!-- Thread Content -->
		<main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0f1115]">
			<!-- Top Toolbar -->
			<div class="flex items-center justify-between border-b border-gray-200 dark:border-border-dark px-3 md:px-4 py-2 bg-white dark:bg-[#111318] shrink-0">
				<div class="flex items-center gap-1">
					<a 
						class="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors" 
						href={getBackUrl()} 
						title="Back"
					>
						<span class="material-symbols-outlined text-[20px]">arrow_back</span>
					</a>
					<button 
						class="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors disabled:opacity-50" 
						title="Archive" 
						type="button"
						disabled={actionLoading === 'archive'}
						onclick={() => performAction('archive')}
					>
						<span class="material-symbols-outlined text-[20px]">{actionLoading === 'archive' ? 'progress_activity' : 'archive'}</span>
					</button>
					<button 
						class="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors disabled:opacity-50" 
						title="Delete" 
						type="button"
						disabled={actionLoading === 'trash'}
						onclick={() => performAction('trash')}
					>
						<span class="material-symbols-outlined text-[20px]">{actionLoading === 'trash' ? 'progress_activity' : 'delete'}</span>
					</button>
					<div class="w-px h-5 bg-gray-300 dark:bg-border-dark mx-1 hidden md:block"></div>
					<button 
						class="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors hidden md:flex disabled:opacity-50" 
						title={isUnread() ? 'Mark as read' : 'Mark as unread'}
						type="button"
						disabled={actionLoading === 'markRead' || actionLoading === 'markUnread'}
						onclick={toggleRead}
					>
						<span class="material-symbols-outlined text-[20px]">{isUnread() ? 'mark_email_read' : 'mark_email_unread'}</span>
					</button>
					<button 
						class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors hidden md:flex disabled:opacity-50 {isStarred() ? 'text-amber-500 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}" 
						title={isStarred() ? 'Unstar' : 'Star'}
						type="button"
						disabled={actionLoading === 'star' || actionLoading === 'unstar'}
						onclick={toggleStar}
					>
						<span class="material-symbols-outlined text-[20px]">{isStarred() ? 'star' : 'star_border'}</span>
					</button>
					<button 
						class="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors hidden md:flex" 
						title="Print" 
						type="button"
						onclick={printThread}
					>
						<span class="material-symbols-outlined text-[20px]">print</span>
					</button>
				</div>
				<div class="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm">
					<span class="hidden sm:inline">{data.position} of {data.totalCount}</span>
					<button 
						class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
						type="button"
						disabled={!data.prevThreadId}
						onclick={goToPrev}
						title="Newer"
					>
						<span class="material-symbols-outlined text-[20px]">chevron_left</span>
					</button>
					<button 
						class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
						type="button"
						disabled={!data.nextThreadId}
						onclick={goToNext}
						title="Older"
					>
						<span class="material-symbols-outlined text-[20px]">chevron_right</span>
					</button>
				</div>
			</div>

			<!-- Thread Messages -->
			<div class="flex-1 overflow-y-auto">
				<div class="max-w-4xl mx-auto px-4 md:px-6 py-4">
					<!-- Subject Line -->
					<div class="flex items-start gap-3 mb-2">
						<h1 class="text-xl md:text-2xl font-normal text-gray-900 dark:text-white flex-1">{data.subject ?? '(no subject)'}</h1>
					</div>

					<!-- Label Tags -->
					{#if data.messages?.[0]}
						{@const labels = getLabels(data.messages[0])}
						{#if labels.length > 0}
							<div class="flex items-center gap-2 mb-6 flex-wrap">
								{#each labels as label}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium {getLabelColor(label)}">
										{label}
									</span>
								{/each}
							</div>
						{/if}
					{/if}

					{#if data.error}
						<div class="px-4 py-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
							<span class="material-symbols-outlined text-[18px] mr-2 align-middle">error</span>
							{data.error}
						</div>
					{:else if !data.messages || data.messages.length === 0}
						<div class="px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">No messages found for this thread.</div>
					{:else}
						{#each data.messages as m, i}
							<!-- Message Card -->
							<div class="mb-4">
								<div class="flex items-start gap-3 py-3">
									<!-- Avatar -->
									<div class="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0 flex items-center justify-center text-gray-700 dark:text-gray-200 text-sm font-medium overflow-hidden">
										<span class="material-symbols-outlined text-[24px]">person</span>
									</div>

									<!-- Message Content -->
									<div class="flex-1 min-w-0">
										<!-- Header Row -->
										<div class="flex items-center justify-between gap-2 mb-1">
											<div class="flex items-center gap-2 min-w-0">
												<span class="font-medium text-gray-900 dark:text-white truncate">{getSenderName(m.from_email)}</span>
												<button 
													class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 text-sm" 
													type="button"
													onclick={() => toggleDetails(i)}
												>
													<span class="text-gray-500 dark:text-gray-400">{m.direction === 'outbound' ? 'to ' + (parseRecipients(m.to_emails)[0]?.split('@')[0] ?? 'recipient') : 'to me'}</span>
													<span class="material-symbols-outlined text-[16px]">{expandedDetails.has(i) ? 'expand_less' : 'expand_more'}</span>
												</button>
												<!-- Tracking status for outbound messages -->
												{#if m.direction === 'outbound'}
													{@const tracking = getTrackingStatus(m)}
													{#if tracking.seen}
														<span class="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title="Opened {tracking.openCount} time{tracking.openCount !== 1 ? 's' : ''} - First: {formatTrackingTime(tracking.firstOpenedAt)}">
															<span class="material-symbols-outlined text-[14px]">done_all</span>
															<span class="hidden sm:inline">Seen</span>
														</span>
													{:else}
														<span class="inline-flex items-center gap-1 text-xs text-gray-400" title="Not opened yet">
															<span class="material-symbols-outlined text-[14px]">done</span>
															<span class="hidden sm:inline">Sent</span>
														</span>
													{/if}
												{/if}
											</div>
											<div class="flex items-center gap-1 shrink-0">
												<span class="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">{formatDate(m.internal_date ?? null)}</span>
												<button 
													class="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors {m.is_starred ? 'text-amber-500' : 'text-gray-400'}" 
													title={m.is_starred ? 'Unstar' : 'Star'}
													type="button"
													onclick={() => performAction(m.is_starred ? 'unstar' : 'star', m.gmail_message_id)}
												>
													<span class="material-symbols-outlined text-[18px]">{m.is_starred ? 'star' : 'star_border'}</span>
												</button>
												<button 
													class="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors text-gray-400" 
													title="Reply" 
													type="button"
													onclick={() => showReplyBox = true}
												>
													<span class="material-symbols-outlined text-[18px]">reply</span>
												</button>
											</div>
										</div>

										<!-- Expandable Details -->
										{#if expandedDetails.has(i)}
											<div class="bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-border-dark rounded-lg p-3 mb-3 text-sm">
												<table class="w-full">
													<tbody>
														<tr>
															<td class="text-gray-500 dark:text-gray-400 pr-4 py-0.5 align-top whitespace-nowrap">from:</td>
															<td class="text-gray-900 dark:text-white py-0.5">{m.from_email ?? 'Unknown'}</td>
														</tr>
														<tr>
															<td class="text-gray-500 dark:text-gray-400 pr-4 py-0.5 align-top whitespace-nowrap">to:</td>
															<td class="text-gray-900 dark:text-white py-0.5">{parseRecipients(m.to_emails).join(', ') || data.meAddress}</td>
														</tr>
														{#if parseRecipients(m.cc_emails).length > 0}
															<tr>
																<td class="text-gray-500 dark:text-gray-400 pr-4 py-0.5 align-top whitespace-nowrap">cc:</td>
																<td class="text-gray-900 dark:text-white py-0.5">{parseRecipients(m.cc_emails).join(', ')}</td>
															</tr>
														{/if}
														<tr>
															<td class="text-gray-500 dark:text-gray-400 pr-4 py-0.5 align-top whitespace-nowrap">date:</td>
															<td class="text-gray-900 dark:text-white py-0.5">{formatFullDate(m.internal_date)}</td>
														</tr>
														<tr>
															<td class="text-gray-500 dark:text-gray-400 pr-4 py-0.5 align-top whitespace-nowrap">subject:</td>
															<td class="text-gray-900 dark:text-white py-0.5">{m.subject ?? '(no subject)'}</td>
														</tr>
													</tbody>
												</table>
											</div>
										{/if}

										<!-- Body -->
										<div class="text-sm leading-relaxed">
											{#if m.body_html}
												<div class="email-content-wrapper rounded-lg overflow-hidden">
													{@html m.body_html}
												</div>
											{:else}
												<div class="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
													{m.body_text ?? m.snippet ?? ''}
												</div>
											{/if}
										</div>

										<!-- Attachments -->
										{#if m.attachments && m.attachments.length > 0}
											<div class="mt-4 border-t border-gray-200 dark:border-border-dark pt-4">
												<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
													<span class="material-symbols-outlined text-[16px]">attach_file</span>
													{m.attachments.length} Attachment{m.attachments.length > 1 ? 's' : ''}
												</p>
												
												<!-- Image attachments displayed inline -->
												{#if m.attachments.some((att: any) => att.mimeType?.startsWith('image/') && (att.attachmentId || att.contentBase64))}
													<div class="flex flex-wrap gap-3 mb-3">
														{#each m.attachments.filter((att: any) => att.mimeType?.startsWith('image/') && (att.attachmentId || att.contentBase64)) as att}
															{@const imgSrc = att.contentBase64 
																? `data:${att.mimeType};base64,${att.contentBase64}` 
																: `/api/attachment/${m.gmail_message_id}/${att.attachmentId}`}
															<a 
																href={imgSrc}
																target="_blank"
																class="block max-w-xs rounded-lg overflow-hidden border border-gray-200 dark:border-border-dark hover:border-primary transition-colors"
															>
																<img 
																	src={imgSrc}
																	alt={att.filename}
																	class="max-w-full max-h-64 object-contain"
																	loading="lazy"
																/>
															</a>
														{/each}
													</div>
												{/if}
												
												<!-- Other attachments as file chips -->
												<div class="flex flex-wrap gap-2">
													{#each m.attachments as att}
														{@const downloadHref = att.contentBase64 
															? `data:${att.mimeType || 'application/octet-stream'};base64,${att.contentBase64}` 
															: (att.attachmentId ? `/api/attachment/${m.gmail_message_id}/${att.attachmentId}` : '#')}
														<a 
															href={downloadHref}
															download={att.filename}
															class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-border-dark hover:border-primary transition-colors"
														>
															<span class="material-symbols-outlined text-[20px] text-gray-500">
																{att.mimeType?.startsWith('image/') ? 'image' : 
																 att.mimeType?.startsWith('video/') ? 'movie' :
																 att.mimeType?.includes('pdf') ? 'picture_as_pdf' :
																 att.mimeType?.includes('word') || att.mimeType?.includes('document') ? 'description' :
																 att.mimeType?.includes('sheet') || att.mimeType?.includes('excel') ? 'table_chart' :
																 'draft'}
															</span>
															<div class="flex flex-col">
																<span class="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{att.filename}</span>
																<span class="text-xs text-gray-500">{formatAttachmentSize(att.size)}</span>
															</div>
														</a>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>

								<!-- Reply Buttons (shown at bottom of last message) -->
								{#if i === data.messages.length - 1}
									<div class="flex items-center gap-2 mt-4 ml-13 flex-wrap">
										<button 
											class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors text-sm font-medium"
											onclick={() => showReplyBox = true}
											type="button"
										>
											<span class="material-symbols-outlined text-[18px]">reply</span>
											Reply
										</button>
										<button 
											class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-border-dark text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors text-sm font-medium"
											onclick={handleForward}
											type="button"
										>
											<span class="material-symbols-outlined text-[18px]">forward</span>
											Forward
										</button>
									</div>
								{/if}
							</div>
						{/each}
					{/if}

					<!-- Reply Box -->
					{#if showReplyBox}
						<div class="mt-6 border border-gray-300 dark:border-border-dark rounded-2xl bg-white dark:bg-[#1a1d24] shadow-sm overflow-hidden">
							<textarea 
								class="w-full bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none border-0 resize-none p-4 min-h-[120px]" 
								placeholder="Reply..."
								bind:value={replyText}
							></textarea>
							
							<!-- Reply Attachments -->
							{#if replyAttachments.length > 0}
								<div class="px-4 pb-2 flex flex-wrap gap-2">
									{#each replyAttachments as att, i}
										<div class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-surface-dark rounded-lg text-sm">
											<span class="material-symbols-outlined text-[18px] text-gray-500">draft</span>
											<span class="text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{att.filename}</span>
											<button 
												class="text-gray-400 hover:text-red-500 transition-colors"
												type="button"
												onclick={() => removeReplyAttachment(i)}
											>
												<span class="material-symbols-outlined text-[16px]">close</span>
											</button>
										</div>
									{/each}
								</div>
							{/if}
							
							<div class="flex justify-between items-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-[#181b23]">
								<div class="flex items-center gap-1">
									<input bind:this={replyFileInput} class="hidden" type="file" onchange={replyFileChanged} />
									<button 
										class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-600 dark:text-gray-400 transition-colors" 
										title="Attach" 
										type="button"
										onclick={pickReplyAttachment}
									>
										<span class="material-symbols-outlined text-[20px]">attach_file</span>
									</button>
								</div>
								<div class="flex items-center gap-2">
									<button 
										class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-2"
										onclick={() => { showReplyBox = false; replyText = ''; replyAttachments = []; }}
										type="button"
									>
										<span class="material-symbols-outlined text-[20px]">delete</span>
									</button>
									<button 
										class="px-5 py-2 rounded-full bg-primary text-white font-medium hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-60" 
										type="button"
										disabled={!replyText.trim() || sending}
										onclick={sendReply}
									>
										Send
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</main>
	</div>
</div>
