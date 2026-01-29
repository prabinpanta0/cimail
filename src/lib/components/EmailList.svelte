<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	interface EmailMessage {
		gmail_message_id?: string;
		gmail_thread_id?: string;
		from_email?: string;
		to_emails?: string[];
		subject?: string;
		snippet?: string;
		internal_date?: string;
		direction?: string;
		account?: string;
		is_starred?: boolean;
		is_read?: boolean;
		is_trashed?: boolean;
		is_archived?: boolean;
		is_draft?: boolean;
		label_ids?: string[];
	}

	interface Props {
		messages: EmailMessage[];
		emptyMessage?: string;
		showCheckboxes?: boolean;
		selectedIds?: Set<string>;
		onToggleSelect?: (id: string) => void;
		onToggleAll?: () => void;
		fromFolder?: string;
	}

	let {
		messages = [],
		emptyMessage = 'No messages',
		showCheckboxes = true,
		selectedIds = new Set<string>(),
		onToggleSelect,
		onToggleAll,
		fromFolder = 'inbox'
	}: Props = $props();

	let actionLoading = $state<string | null>(null);

	const rowId = (m: EmailMessage) => String(m.gmail_message_id ?? m.gmail_thread_id ?? '');
	
	const getThreadUrl = (m: EmailMessage) => {
		// For drafts, link to compose page for editing
		if (m.is_draft || fromFolder === 'drafts') {
			const id = (m as any).id ?? m.gmail_message_id;
			return `/compose?draft=${id}`;
		}
		const threadId = m.gmail_thread_id ?? m.gmail_message_id;
		return `/thread/${threadId}?from=${fromFolder}`;
	};

	const formatDate = (value: string | null | undefined) => {
		if (!value) return '';
		const dt = new Date(value);
		if (Number.isNaN(dt.getTime())) return '';
		
		const now = new Date();
		const isToday = dt.toDateString() === now.toDateString();
		
		if (isToday) {
			return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		}
		
		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		const isYesterday = dt.toDateString() === yesterday.toDateString();
		
		if (isYesterday) {
			return 'Yesterday';
		}
		
		return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
	};

	const getSenderDisplay = (m: EmailMessage) => {
		if (m.direction === 'outbound') {
			const to = m.to_emails?.[0] ?? '';
			return `To: ${to}`;
		}
		return m.from_email ?? 'Unknown sender';
	};

	const isAllSelected = () => {
		const ids = messages.map(rowId).filter(Boolean);
		if (ids.length === 0) return false;
		for (const id of ids) if (!selectedIds.has(id)) return false;
		return true;
	};

	const handleAction = async (messageId: string, action: string, e: Event) => {
		e.preventDefault();
		e.stopPropagation();
		
		if (actionLoading) return;
		actionLoading = `${messageId}-${action}`;
		
		try {
			const res = await fetch('/api/actions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId, action })
			});
			
			if (res.ok) {
				await invalidateAll();
			} else {
				console.error('Action failed:', await res.text());
			}
		} catch (err) {
			console.error('Action error:', err);
		} finally {
			actionLoading = null;
		}
	};
</script>

{#if messages.length === 0}
	<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
		<span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">mail</span>
		<p class="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
	</div>
{:else}
	<div class="flex-1 overflow-y-auto">
		{#each messages as m}
			{@const id = rowId(m)}
			{@const isUnread = !m.is_read}
			<div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-border-dark transition-colors group {isUnread ? 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50' : 'bg-white dark:bg-[#0f1115] hover:bg-gray-50 dark:hover:bg-[#16191f]'}">
				{#if showCheckboxes}
					<input
						class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-[#282e39] dark:border-gray-600 cursor-pointer"
						type="checkbox"
						checked={selectedIds.has(id)}
						onchange={() => onToggleSelect?.(id)}
					/>
				{/if}
				
				<button
					class="text-gray-400 hover:text-yellow-500 transition-colors disabled:opacity-50"
					type="button"
					disabled={actionLoading === `${m.gmail_message_id}-star` || actionLoading === `${m.gmail_message_id}-unstar`}
					onclick={(e) => handleAction(m.gmail_message_id ?? '', m.is_starred ? 'unstar' : 'star', e)}
					title={m.is_starred ? 'Unstar' : 'Star'}
				>
					<span class={m.is_starred ? 'material-symbols-filled text-yellow-500' : 'material-symbols-outlined'}>star</span>
				</button>

				<a href={getThreadUrl(m)} class="flex-1 min-w-0 flex flex-col gap-0.5">
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm truncate {isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}">{getSenderDisplay(m)}</span>
						<span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(m.internal_date)}</span>
					</div>
					<div class="flex items-center gap-2 overflow-hidden">
						<span class="text-sm truncate {isUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-600 dark:text-gray-400'}">{m.subject ?? '(no subject)'}</span>
						{#if m.snippet}
							<span class="text-sm text-gray-400 dark:text-gray-500 truncate hidden sm:inline">- {m.snippet}</span>
						{/if}
					</div>
				</a>

				<!-- Unread indicator dot -->
				{#if isUnread}
					<div class="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></div>
				{/if}

				<div class="hidden group-hover:flex items-center gap-1">
					<button
						class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-500 transition-colors disabled:opacity-50"
						title={m.is_read ? 'Mark as unread' : 'Mark as read'}
						type="button"
						disabled={actionLoading?.startsWith(m.gmail_message_id ?? '')}
						onclick={(e) => handleAction(m.gmail_message_id ?? '', m.is_read ? 'markUnread' : 'markRead', e)}
					>
						<span class="material-symbols-outlined text-[18px]">{m.is_read ? 'mark_email_unread' : 'mark_email_read'}</span>
					</button>
					<button
						class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-500 transition-colors disabled:opacity-50"
						title="Archive"
						type="button"
						disabled={actionLoading?.startsWith(m.gmail_message_id ?? '')}
						onclick={(e) => handleAction(m.gmail_message_id ?? '', 'archive', e)}
					>
						<span class="material-symbols-outlined text-[18px]">archive</span>
					</button>
					<button
						class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282e39] text-gray-500 transition-colors disabled:opacity-50"
						title="Delete"
						type="button"
						disabled={actionLoading?.startsWith(m.gmail_message_id ?? '')}
						onclick={(e) => handleAction(m.gmail_message_id ?? '', 'trash', e)}
					>
						<span class="material-symbols-outlined text-[18px]">delete</span>
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
